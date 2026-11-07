import { supabase, type Transaction } from './supabase';
import { fetchTransactions } from './database';
import type { VoucherReference } from './voucher-utils';
import { voucherRows } from './voucher-utils';

export type UnitOption = { id: string; item_id: string; name: string; factor_to_base: number; is_default: boolean };
export type SavedUnit = { voucher_id: string; item_id: string; unit_name: string; entered_quantity: number; factor_to_base: number; base_quantity: number };

export async function listUnits(itemId: string): Promise<UnitOption[]> {
  const { data, error } = await supabase.from('item_units').select('id,item_id,name,factor_to_base,is_default').eq('item_id', itemId).order('factor_to_base');
  if (error) throw error;
  return (data ?? []) as UnitOption[];
}

export async function listAllUnits(): Promise<UnitOption[]> {
  const result: UnitOption[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('item_units')
      .select('id,item_id,name,factor_to_base,is_default')
      .order('item_id', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    result.push(...((data ?? []) as UnitOption[]));
    if ((data ?? []).length < pageSize) return result;
  }
}

export async function saveUnit(unit: Omit<UnitOption, 'id'> & { id?: string }): Promise<void> {
  const payload = { item_id: unit.item_id, name: unit.name.trim(), factor_to_base: unit.factor_to_base, is_default: unit.is_default };
  const query = unit.id ? supabase.from('item_units').update(payload).eq('id', unit.id) : supabase.from('item_units').insert(payload);
  const { error } = await query;
  if (error) throw error;
}
export async function removeUnit(id: string): Promise<void> {
  const { error } = await supabase.from('item_units').delete().eq('id', id);
  if (error) throw error;
}

/** Fetch the complete voucher by its immutable ID when available. Legacy rows are
 * looked up separately; a missing modern voucher must never silently match a number. */
export async function loadVoucher(ref: VoucherReference): Promise<{ rows: Transaction[]; unitSnapshots: SavedUnit[]; generalNotes: string | null }> {
  let rows: Transaction[] = [];
  if (ref.id) {
    const { data, error } = await supabase.from('transactions').select(`
      *,
      items:transactions_item_id_fkey(name, code, unit),
      warehouses:transactions_warehouse_id_fkey(name, code),
      departments:transactions_department_id_fkey(name, code),
      to_warehouses:transactions_to_warehouse_id_fkey(name, code)
    `).eq('voucher_id', ref.id).order('created_at', { ascending: true });
    if (!error && data?.length) rows = data as unknown as Transaction[];
    // A legacy caller may pass a transaction-row ID, not a voucher ID.
    if (!rows.length) {
      const all = await fetchTransactions();
      const exactRow = all.find((row) => row.id === ref.id);
      if (exactRow) rows = voucherRows(all, { id: exactRow.id });
    }
  } else if (ref.number && ref.type) {
    // Never match a voucher using the number alone: older sequences may collide.
    const all = await fetchTransactions();
    rows = voucherRows(all, { number: ref.number, type: ref.type });
  }
  if (!rows.length) return { rows: [], unitSnapshots: [], generalNotes: null };
  const voucherId = rows[0].voucher_id;
  if (!voucherId) return { rows, unitSnapshots: [], generalNotes: null };
  const [unitResult, voucherResult] = await Promise.all([
    supabase.from('voucher_unit_snapshots').select('*').eq('voucher_id', voucherId),
    supabase.from('vouchers').select('notes').eq('id', voucherId).maybeSingle(),
  ]);
  if (rows[0].to_department_id) {
    const { data: dept } = await supabase.from('departments').select('name,code').eq('id', rows[0].to_department_id).maybeSingle();
    if (dept) rows = rows.map((row) => ({ ...row, to_departments: dept }));
  }
  return {
    rows,
    unitSnapshots: unitResult.error ? [] : (unitResult.data ?? []) as SavedUnit[],
    generalNotes: voucherResult.error ? null : (voucherResult.data?.notes ?? null),
  };
}
