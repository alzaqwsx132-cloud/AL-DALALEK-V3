-- SAFETY GATE: intentionally disabled until the real authentication/RLS model and
-- create_voucher() signature are reviewed against the production schema.
-- This file is a REVIEW TEMPLATE, not an approved migration.
DO $$ BEGIN
  RAISE EXCEPTION 'Migration intentionally blocked: review live voucher RPC, auth, and RLS; remove this guard ONLY after an authorized backup and review';
END $$;

-- OPTIONAL upgrade — review current live schema and take a verified backup before applying.
-- IMPORTANT: The uploaded project lacks the existing vouchers/create_voucher migrations.
-- Verify the current create_voucher signature and its user authorization first.
-- This preserves the old RPC and does not renumber, update, or delete historical vouchers.
-- Existing app custom username/password is not Supabase Auth; do not treat its RLS as secure.

CREATE TABLE IF NOT EXISTS public.item_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  factor_to_base numeric(18,6) NOT NULL CHECK (factor_to_base > 0),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_units_item_name_unique UNIQUE (item_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS item_units_one_default ON public.item_units(item_id) WHERE is_default;
ALTER TABLE public.item_units ENABLE ROW LEVEL SECURITY;
-- Compatibility with the original application's current anon data-access model.
-- This requires replacing with authenticated, server-enforced policies before commercial production.
DROP POLICY IF EXISTS item_units_compat_read ON public.item_units;
CREATE POLICY item_units_compat_read ON public.item_units FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS item_units_compat_insert ON public.item_units;
CREATE POLICY item_units_compat_insert ON public.item_units FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS item_units_compat_update ON public.item_units;
CREATE POLICY item_units_compat_update ON public.item_units FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS item_units_compat_delete ON public.item_units;
CREATE POLICY item_units_compat_delete ON public.item_units FOR DELETE TO anon, authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_units TO anon, authenticated;

-- Historical stock movements use the original base-unit denomination, not renamed units.
CREATE OR REPLACE FUNCTION public.prevent_historical_base_unit_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.unit IS DISTINCT FROM OLD.unit AND EXISTS (SELECT 1 FROM public.transactions WHERE item_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot change base unit for an item with historical transactions';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS items_protect_base_unit_history ON public.items;
CREATE TRIGGER items_protect_base_unit_history BEFORE UPDATE OF unit ON public.items
FOR EACH ROW EXECUTE FUNCTION public.prevent_historical_base_unit_change();

CREATE TABLE IF NOT EXISTS public.voucher_unit_snapshots (
  voucher_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_name text NOT NULL,
  entered_quantity numeric(18,6) NOT NULL CHECK (entered_quantity > 0),
  factor_to_base numeric(18,6) NOT NULL CHECK (factor_to_base > 0),
  base_quantity numeric(15,3) NOT NULL CHECK (base_quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (voucher_id, item_id)
);
CREATE INDEX IF NOT EXISTS voucher_unit_snapshots_item ON public.voucher_unit_snapshots(item_id);
ALTER TABLE public.voucher_unit_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voucher_unit_snapshots_read ON public.voucher_unit_snapshots;
CREATE POLICY voucher_unit_snapshots_read ON public.voucher_unit_snapshots FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.voucher_unit_snapshots TO anon, authenticated;

-- Add referential integrity only if vouchers table exists in this database.
DO $$ BEGIN
  IF to_regclass('public.vouchers') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='voucher_unit_snapshots_voucher_id_fkey'
  ) THEN
    ALTER TABLE public.voucher_unit_snapshots ADD CONSTRAINT voucher_unit_snapshots_voucher_id_fkey
    FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- One single transaction: checks each item/unit and precision, calls existing secure stock RPC,
-- then snapshots entered units. On any error, all changes roll back together.
-- Adjust p_user_id/p_request_id types if the live RPC's signature differs.
CREATE OR REPLACE FUNCTION public.create_voucher_with_units(
  p_user_id uuid,
  p_request_id uuid,
  p_voucher_type text,
  p_voucher_date date,
  p_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_department_id uuid,
  p_to_department_id uuid,
  p_notes text,
  p_lines jsonb,
  p_approve boolean DEFAULT true
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  row_json jsonb;
  converted jsonb := '[]'::jsonb;
  snapshots jsonb := '[]'::jsonb;
  entered numeric;
  factor numeric;
  base_quantity numeric;
  item_uuid uuid;
  unit_label text;
  base_unit text;
  seen_items uuid[] := ARRAY[]::uuid[];
  result_id text;
  snapshot_row jsonb;
BEGIN
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Voucher requires at least one item';
  END IF;
  FOR row_json IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    item_uuid := (row_json->>'item_id')::uuid;
    IF item_uuid = ANY(seen_items) THEN RAISE EXCEPTION 'Duplicate item in voucher'; END IF;
    seen_items := array_append(seen_items, item_uuid);
    SELECT i.unit INTO STRICT base_unit FROM public.items i WHERE i.id=item_uuid;
    unit_label := COALESCE(nullif(trim(row_json->>'unit_name'), ''), base_unit);
    entered := COALESCE((row_json->>'entered_quantity')::numeric, (row_json->>'quantity')::numeric);
    IF unit_label = base_unit THEN
      factor := 1;
    ELSE
      SELECT u.factor_to_base INTO factor FROM public.item_units u
      WHERE u.item_id=item_uuid AND u.name=unit_label FOR KEY SHARE;
      IF factor IS NULL THEN RAISE EXCEPTION 'Unit is not valid for item'; END IF;
    END IF;
    IF entered IS NULL OR entered <= 0 OR factor <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    base_quantity := entered * factor;
    IF base_quantity <> trunc(base_quantity,3) OR base_quantity > 999999999999.999 THEN
      RAISE EXCEPTION 'Converted quantity exceeds stock precision';
    END IF;
    converted := converted || jsonb_build_array((row_json - 'entered_quantity' - 'unit_name') || jsonb_build_object('quantity',base_quantity));
    snapshots := snapshots || jsonb_build_array(jsonb_build_object('item_id',item_uuid,'unit_name',unit_label,'entered_quantity',entered,'factor_to_base',factor,'base_quantity',base_quantity));
  END LOOP;

  -- Existing function remains the only authority for inventory validation and posting.
  SELECT public.create_voucher(
    p_user_id => p_user_id, p_request_id => p_request_id,
    p_voucher_type => p_voucher_type, p_voucher_date => p_voucher_date,
    p_warehouse_id => p_warehouse_id, p_to_warehouse_id => p_to_warehouse_id,
    p_department_id => p_department_id, p_to_department_id => p_to_department_id,
    p_notes => p_notes, p_lines => converted, p_approve => p_approve
  ) INTO result_id;

  IF result_id IS NULL THEN RAISE EXCEPTION 'Voucher RPC returned no ID'; END IF;
  FOR snapshot_row IN SELECT value FROM jsonb_array_elements(snapshots) LOOP
    INSERT INTO public.voucher_unit_snapshots (voucher_id,item_id,unit_name,entered_quantity,factor_to_base,base_quantity)
    VALUES (result_id::uuid,(snapshot_row->>'item_id')::uuid,snapshot_row->>'unit_name',
      (snapshot_row->>'entered_quantity')::numeric,(snapshot_row->>'factor_to_base')::numeric,(snapshot_row->>'base_quantity')::numeric)
    ON CONFLICT (voucher_id,item_id) DO NOTHING;
  END LOOP;
  RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.create_voucher_with_units(uuid,uuid,text,date,uuid,uuid,uuid,uuid,text,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_voucher_with_units(uuid,uuid,text,date,uuid,uuid,uuid,uuid,text,jsonb,boolean) TO anon, authenticated;

-- No existing voucher numbers or quantities are changed by this migration.

-- Set the default unit for an item using a single transaction and per-item lock.
CREATE OR REPLACE FUNCTION public.set_item_default_unit(p_item_id uuid, p_unit_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_item_id::text));
  IF p_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.item_units WHERE id=p_unit_id AND item_id=p_item_id) THEN
    RAISE EXCEPTION 'Unit not associated with this item';
  END IF;
  UPDATE public.item_units SET is_default=false WHERE item_id=p_item_id AND is_default;
  IF p_unit_id IS NOT NULL THEN UPDATE public.item_units SET is_default=true WHERE id=p_unit_id AND item_id=p_item_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_item_default_unit(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_item_default_unit(uuid,uuid) TO anon, authenticated;
