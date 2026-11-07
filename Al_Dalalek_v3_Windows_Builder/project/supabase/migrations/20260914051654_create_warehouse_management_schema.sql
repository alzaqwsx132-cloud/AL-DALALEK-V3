/*
# نظام إدارة المستودع - Warehouse Management System Schema

1. New Tables
- `warehouses` (المستودعات): Stores warehouse information with name, code, and location.
- `departments` (الأقسام): Stores department information with name and code.
- `items` (الأصناف): Stores item/product information with name, code, unit, category, and description.
- `transactions` (السندات/الحركات): Records stock movements - receipts (استلام), issues (صرف), and transfers (تحويل).

2. Relationships
- transactions.item_id → items.id (RESTRICT: cannot delete item with transactions)
- transactions.warehouse_id → warehouses.id (RESTRICT)
- transactions.department_id → departments.id (SET NULL on delete)
- transactions.to_warehouse_id → warehouses.id (SET NULL on delete, for transfers)

3. Security
- All tables have RLS enabled.
- Single-tenant app (no auth): all policies use TO anon, authenticated with USING (true).
- This is an intentionally shared/public warehouse management system.

4. Notes
- transaction_type: 'receipt' (استلام - increases stock), 'issue' (صرف - decreases stock), 'transfer' (تحويل - moves stock between warehouses)
- quantity must be positive (CHECK constraint)
- transaction_number is auto-generated and unique
*/

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  location text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_warehouses" ON warehouses;
CREATE POLICY "anon_select_warehouses" ON warehouses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_warehouses" ON warehouses;
CREATE POLICY "anon_insert_warehouses" ON warehouses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_warehouses" ON warehouses;
CREATE POLICY "anon_update_warehouses" ON warehouses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_warehouses" ON warehouses;
CREATE POLICY "anon_delete_warehouses" ON warehouses FOR DELETE
  TO anon, authenticated USING (true);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_departments" ON departments;
CREATE POLICY "anon_select_departments" ON departments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_departments" ON departments;
CREATE POLICY "anon_insert_departments" ON departments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_departments" ON departments;
CREATE POLICY "anon_update_departments" ON departments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_departments" ON departments;
CREATE POLICY "anon_delete_departments" ON departments FOR DELETE
  TO anon, authenticated USING (true);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  unit text NOT NULL DEFAULT 'قطعة',
  category text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_items" ON items;
CREATE POLICY "anon_select_items" ON items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_items" ON items;
CREATE POLICY "anon_insert_items" ON items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_items" ON items;
CREATE POLICY "anon_update_items" ON items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_items" ON items;
CREATE POLICY "anon_delete_items" ON items FOR DELETE
  TO anon, authenticated USING (true);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text UNIQUE NOT NULL DEFAULT ('TR-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8))),
  transaction_type text NOT NULL CHECK (transaction_type IN ('receipt', 'issue', 'transfer')),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity numeric(15,3) NOT NULL CHECK (quantity > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO anon, authenticated USING (true);

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_warehouse_id ON transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
