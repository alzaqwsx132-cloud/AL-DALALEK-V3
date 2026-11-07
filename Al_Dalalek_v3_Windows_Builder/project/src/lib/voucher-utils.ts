import type { Transaction, TransactionType } from './supabase';

export type VoucherReference = { id?: string; number?: string; type?: TransactionType };
export const VOUCHER_TYPES: TransactionType[] = ['receipt', 'issue', 'return', 'transfer_wh', 'transfer_dept'];
export const VOUCHER_LABELS: Record<TransactionType, string> = {
  receipt: 'إدخال', issue: 'صرف', return: 'استرجاع', transfer_wh: 'تحويل بين المستودعات', transfer_dept: 'تحويل بين الأقسام',
};
export const VOUCHER_PREFIXES: Record<TransactionType, string> = {
  receipt: 'IN', issue: 'OUT', return: 'RET', transfer_wh: 'WTR', transfer_dept: 'DTR',
};

// Real voucher IDs always take priority over the legacy transaction-number grouping.
export function voucherRows(all: Transaction[], ref: VoucherReference): Transaction[] {
  let selected: Transaction | undefined;
  if (ref.id) selected = all.find((t) => t.voucher_id === ref.id || t.id === ref.id);
  if (!selected && ref.number) selected = all.find((t) => t.transaction_number === ref.number && (!ref.type || t.transaction_type === ref.type));
  if (!selected) return [];
  if (selected.voucher_id) return all.filter((t) => t.voucher_id === selected.voucher_id);
  // For legacy rows without voucher_id, grouping is a best effort only.
  return all.filter((t) => !t.voucher_id && t.transaction_number === selected.transaction_number && t.transaction_type === selected.transaction_type && t.date === selected.date);
}

export type RenumberPreview = { voucherId: string; oldNumber: string; proposedNumber: string; type: TransactionType; date: string };
export function previewHistoricalNumbers(rows: Transaction[]): RenumberPreview[] {
  const seen = new Map<string, Transaction>();
  for (const t of rows) {
    const key = t.voucher_id ?? `${t.transaction_type}/${t.date}/${t.transaction_number}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  const sorted = [...seen.entries()].sort(([ak, a], [bk, b]) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at) || ak.localeCompare(bk));
  const counters: Record<string, number> = {};
  return sorted.map(([key, row]) => {
    const year = row.date.substring(0, 4);
    const group = `${row.transaction_type}/${year}`;
    counters[group] = (counters[group] || 0) + 1;
    return { voucherId: key, oldNumber: row.transaction_number, proposedNumber: `${VOUCHER_PREFIXES[row.transaction_type]}-${year}-${String(counters[group]).padStart(5, '0')}`, type: row.transaction_type, date: row.date };
  });
}

export function toBaseQuantity(entered: number, factor: number): number {
  if (!Number.isFinite(entered) || entered <= 0 || !Number.isFinite(factor) || factor <= 0) throw new Error('الكمية أو معامل التحويل غير صالح');
  const converted = entered * factor;
  if (!Number.isFinite(converted) || converted > 999999999999.999 || Math.abs(converted * 1000 - Math.round(converted * 1000)) > 1e-6) {
    throw new Error('التحويل ينتج أجزاءً أصغر من دقة المخزون (0.001)؛ غيّر الكمية أو الوحدة');
  }
  return Math.round(converted * 1000) / 1000;
}
