import type { BalanceRow, Item, LowStockAlert } from './supabase';

/** This preference is local to this browser until settings are stored server-side. */
export const SELECTED_ALERT_WAREHOUSE = 'aldalalek_selected_alert_warehouse';
export const ALERT_SETTINGS_CHANGED = 'aldalalek:alert-settings-changed';

export function selectedAlertWarehouse(): string {
  try { return localStorage.getItem(SELECTED_ALERT_WAREHOUSE) ?? ''; }
  catch { return ''; }
}

export function setSelectedAlertWarehouse(warehouseId: string): void {
  localStorage.setItem(SELECTED_ALERT_WAREHOUSE, warehouseId);
  window.dispatchEvent(new Event(ALERT_SETTINGS_CHANGED));
}

/** Only balances in the chosen warehouse count. Includes items with zero stock. */
export function alertsForWarehouse(items: Item[], balances: BalanceRow[], warehouseId: string): LowStockAlert[] {
  if (!warehouseId) return [];
  const balanceByItem = new Map<string, number>();
  balances.filter((row) => row.warehouse_id === warehouseId).forEach((row) => {
    balanceByItem.set(row.item_id, (balanceByItem.get(row.item_id) || 0) + Number(row.balance));
  });
  return items.flatMap((item) => {
    const min = Number(item.reorder_level);
    if (!Number.isFinite(min) || min <= 0) return [];
    const balance = balanceByItem.get(item.id) ?? 0;
    return balance <= min ? [{ item_id: item.id, item_name: item.name, item_code: item.code,
      item_unit: item.unit, reorder_level: min, total_balance: balance, warehouse_count: 1 }] : [];
  }).sort((a, b) => a.total_balance - b.total_balance || a.item_name.localeCompare(b.item_name, 'ar'));
}
