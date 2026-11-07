import { useVoucher } from '@/components/VoucherViewer';
import { useEffect, useState } from 'react';
import { Search, ScrollText } from 'lucide-react';
import { fetchAuditLog } from '@/lib/database';
import type { AuditLogEntry } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const actionLabels: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  activate: 'تفعيل',
  deactivate: 'تعطيل',
  reset_password: 'إعادة تعيين كلمة مرور',
  approve: 'اعتماد',
  cancel: 'إلغاء',
};

const moduleLabels: Record<string, string> = {
  items: 'الأصناف',
  warehouses: 'المستودعات',
  departments: 'الأقسام',
  transactions: 'السندات',
  transfers: 'التحويل المخزني',
  users: 'المستخدمون',
  audit_log: 'سجل التدقيق',
};

export default function AuditLogPage() {
  const { show } = useToast();
  const { openVoucher } = useVoucher();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchAuditLog();
        setEntries(data);
      } catch {
        show('فشل تحميل سجل التدقيق', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = entries.filter((e) => {
    const matchModule = moduleFilter === 'all' || e.module === moduleFilter;
    const matchSearch =
      (e.user_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase());
    return matchModule && matchSearch;
  });

  const modules = Array.from(new Set(entries.map((e) => e.module)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">سجل التدقيق</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">سجل جميع العمليات في النظام</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="all">كل الوحدات</option>
          {modules.map((m) => (
            <option key={m} value={m}>{moduleLabels[m] ?? m}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full pr-10 pl-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
            <ScrollText className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600 animate-pulse" />
            <p className="text-sm">جاري التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
            <ScrollText className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
            <p className="text-sm">لا توجد سجلات</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">#</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">المستخدم</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">العملية</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الوحدة</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الوصف</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {filtered.map((e, idx) => (
                <tr key={e.id} className="table-row transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-slate-300">{e.user_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      e.action === 'delete' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      e.action === 'create' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                      e.action === 'update' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                      e.action === 'deactivate' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                      'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {actionLabels[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{moduleLabels[e.module] ?? e.module}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{e.description ?? '—'}
                    {(e.module === 'transactions' || e.module === 'transfers') && e.record_id && <button type="button" onClick={() => openVoucher({id:e.record_id!})} className="mr-2 text-blue-700 dark:text-blue-300 font-bold text-xs">فتح السند</button>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-500">
                    {new Date(e.created_at).toLocaleString('ar-EG')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
