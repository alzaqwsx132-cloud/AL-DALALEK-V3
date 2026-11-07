import { useEffect, useState } from 'react';
import { Search, FileText, Package, Warehouse, Building2 } from 'lucide-react';
import { supabase, type TransactionType } from '@/lib/supabase';
import { useVoucher } from './VoucherViewer';
import { useAuth } from '@/lib/auth';

type VoucherMatch = { id: string; voucher_id: string | null; transaction_number: string; transaction_type: TransactionType; date: string };
type NameMatch = { id: string; name: string; code?: string };
type Matches = { vouchers: VoucherMatch[]; items: NameMatch[]; warehouses: NameMatch[]; departments: NameMatch[] };
const empty: Matches = { vouchers: [], items: [], warehouses: [], departments: [] };

export default function GlobalSearch({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { openVoucher } = useVoucher();
  const { hasTransactionTypePermission, hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Matches>(empty);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setResults(empty); setBusy(false); return; }
    let current = true;
    const handle = setTimeout(async () => {
      setBusy(true);
      const pattern = `%${text.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      try {
        const [v, i, w, d] = await Promise.all([
          supabase.from('transactions').select('id,voucher_id,transaction_number,transaction_type,date').ilike('transaction_number', pattern).order('date', { ascending: false }).limit(40),
          supabase.from('items').select('id,name,code').ilike('name', pattern).limit(10),
          supabase.from('warehouses').select('id,name,code').ilike('name', pattern).limit(10),
          supabase.from('departments').select('id,name,code').ilike('name', pattern).limit(10),
        ]);
        if (!current) return;
        const byVoucher = new Map<string, VoucherMatch>();
        for (const row of (v.data ?? []) as VoucherMatch[]) {
          if (!hasTransactionTypePermission(row.transaction_type, 'view')) continue;
          const key = row.voucher_id || `${row.transaction_type}:${row.date}:${row.transaction_number}`;
          if (!byVoucher.has(key)) byVoucher.set(key, row);
        }
        setResults({
          vouchers: Array.from(byVoucher.values()),
          items: hasPermission('items', 'view') ? (i.data ?? []) : [],
          warehouses: hasPermission('warehouses', 'view') ? (w.data ?? []) : [],
          departments: hasPermission('departments', 'view') ? (d.data ?? []) : [],
        });
      } catch { if (current) setResults(empty); }
      finally { if (current) setBusy(false); }
    }, 250);
    return () => { current = false; clearTimeout(handle); };
  }, [query, hasTransactionTypePermission, hasPermission]);
  const close = () => { setActive(false); setQuery(''); };
  const navigate = (key: string) => { onNavigate(key); close(); };
  const count = results.vouchers.length + results.items.length + results.warehouses.length + results.departments.length;
  return <div dir="rtl" className="relative flex-1 max-w-xl min-w-0" role="search">
    <Search className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"/>
    <input aria-label="بحث شامل في النظام" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setActive(true)} onBlur={() => setTimeout(() => setActive(false), 170)} placeholder="بحث شامل (سند، مادة، مستودع، قسم...)" className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm pr-9 pl-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
    {active && query.trim().length >= 2 && <div className="absolute top-full mt-2 right-0 left-0 z-[55] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-xl max-h-[65vh] overflow-auto p-2 text-slate-900 dark:text-slate-100" role="listbox">
      {busy && <p className="text-sm p-3">جارٍ البحث...</p>}
      {!busy && count === 0 && <p className="text-sm p-3 text-slate-500 dark:text-slate-300">لا توجد نتائج مطابقة</p>}
      {results.vouchers.map((v) => <button type="button" role="option" aria-selected="false" key={v.voucher_id || v.id} onClick={() => { openVoucher({ id: v.voucher_id || v.id, number: v.transaction_number, type: v.transaction_type }); close(); }} className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 text-sm"><FileText className="w-4 h-4 text-blue-600"/><span>فتح السند {v.transaction_number}</span><span className="text-xs text-slate-400 mr-auto">{v.date}</span></button>)}
      {([{list: results.items, icon: Package, page: 'items', label: 'صنف'}, {list: results.warehouses, icon: Warehouse, page: 'warehouses', label: 'مستودع'}, {list: results.departments, icon: Building2, page: 'departments', label: 'قسم'}] as const).map(({list, icon: Icon, page, label}) => list.map((item) => <button type="button" role="option" aria-selected="false" key={`${page}:${item.id}`} onClick={() => navigate(page)} className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 text-sm"><Icon className="w-4 h-4 text-blue-600"/><span>{label}: {item.name}</span></button>))}
    </div>}
  </div>;
}
