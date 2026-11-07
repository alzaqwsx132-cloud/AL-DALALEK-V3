import { useVoucher } from '@/components/VoucherViewer';
import { useEffect, useState } from 'react';
import { Search, Scale, Building2, Warehouse as WarehouseIcon, TrendingUp, TrendingDown, Printer, Calendar, FileBarChart } from 'lucide-react';
import { fetchBalances, fetchDepartmentBalances, fetchTransactions } from '@/lib/database';
import { useToast } from '@/components/Toast';
import type { TransactionType } from '@/lib/supabase';

type BalanceRow = {
  item_id: string;
  item_name: string;
  item_code: string;
  item_unit: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_code: string;
  balance: number;
};

type DeptBalanceRow = {
  department_id: string;
  department_name: string;
  department_code: string;
  item_id: string;
  item_name: string;
  item_code: string;
  item_unit: string;
  balance: number;
};

type TxnRow = {
  id: string;
  transaction_number: string;
  voucher_id?: string | null;
  transaction_type: TransactionType;
  quantity: number;
  date: string;
  item_id: string;
  item_name: string;
  item_code: string;
  item_unit: string;
  warehouse_name: string;
  department_name: string | null;
};

const monthNames = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const typeLabels: Record<string, string> = {
  receipt: 'إدخال',
  issue: 'صرف',
  return: 'استرجاع',
  transfer_wh: 'تحويل مستودعات',
  transfer_dept: 'تحويل أقسام',
};

export default function BalancesPage() {
  const { show } = useToast();
  const { openVoucher } = useVoucher();
  const [tab, setTab] = useState<'warehouses' | 'departments' | 'monthly'>('warehouses');
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [deptBalances, setDeptBalances] = useState<DeptBalanceRow[]>([]);
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [b, db, txns] = await Promise.all([fetchBalances(), fetchDepartmentBalances(), fetchTransactions()]);
        setBalances(b);
        setDeptBalances(db);
        setTransactions(txns.map((t) => ({
          id: t.id,
          transaction_number: t.transaction_number,
          voucher_id: t.voucher_id,
          transaction_type: t.transaction_type,
          quantity: Number(t.quantity),
          date: t.date,
          item_id: t.item_id,
          item_name: t.items?.name ?? '—',
          item_code: t.items?.code ?? '',
          item_unit: t.items?.unit ?? '',
          warehouse_name: t.warehouses?.name ?? '—',
          department_name: t.departments?.name ?? null,
        })));
      } catch {
        show('فشل تحميل الأرصدة', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const monthlyTxns = transactions.filter((t) => t.date.startsWith(selectedMonth));

  const filteredWarehouse = balances.filter(
    (b) =>
      b.item_name.toLowerCase().includes(search.toLowerCase()) ||
      b.warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
      b.item_code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDept = deptBalances.filter(
    (b) =>
      b.item_name.toLowerCase().includes(search.toLowerCase()) ||
      b.department_name.toLowerCase().includes(search.toLowerCase()) ||
      b.item_code.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = new Set(balances.map((b) => b.item_id)).size;
  const totalWarehouses = new Set(balances.map((b) => b.warehouse_id)).size;
  const totalDepts = new Set(deptBalances.map((b) => b.department_id)).size;

  // Monthly report aggregation
  // Number of unique vouchers; summing quantities of different items/units is misleading.
  const monthlyCounts = new Map<string, TransactionType>();
  for (const tx of monthlyTxns) {
    const key = tx.voucher_id || `${tx.transaction_type}:${tx.date}:${tx.transaction_number}`;
    if (!monthlyCounts.has(key)) monthlyCounts.set(key, tx.transaction_type);
  }
  const monthlyByType = {
    receipt: [...monthlyCounts.values()].filter((t) => t === 'receipt').length,
    issue: [...monthlyCounts.values()].filter((t) => t === 'issue').length,
    return: [...monthlyCounts.values()].filter((t) => t === 'return').length,
    transfer: [...monthlyCounts.values()].filter((t) => t === 'transfer_wh' || t === 'transfer_dept').length,
  };

  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthLabel = `${monthNames[parseInt(monthStr) - 1]} ${yearStr}`;

  const cardClass = "bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3";
  const inputClass = "px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 text-sm bg-white dark:bg-slate-700 dark:text-slate-100";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">الأرصدة والتقارير</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">أرصدة المستودعات والأقسام والتقارير الشهرية</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors font-medium text-sm shadow-sm">
          <Printer className="w-4 h-4" />
          طباعة
        </button>
      </div>

      {/* Printable header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-center">
          {tab === 'warehouses' ? 'تقرير أرصدة المستودعات' : tab === 'departments' ? 'تقرير أرصدة الأقسام' : `التقرير الشهري — ${monthLabel}`}
        </h1>
        <p className="text-sm text-center text-gray-600">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{totalItems}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">أصناف لها أرصدة</p>
          </div>
        </div>
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <WarehouseIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{totalWarehouses}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">مستودعات نشطة</p>
          </div>
        </div>
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{totalDepts}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">أقسام لها أرصدة</p>
          </div>
        </div>
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{balances.filter(b => b.balance > 0).length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">أرصدة موجبة</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          <button onClick={() => setTab('warehouses')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'warehouses' ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}>
            أرصدة المستودعات
          </button>
          <button onClick={() => setTab('departments')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'departments' ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}>
            أرصدة الأقسام
          </button>
          <button onClick={() => setTab('monthly')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'monthly' ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}>
            تقارير شهرية
          </button>
        </div>
        {tab !== 'monthly' && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
              className="w-full pr-10 pl-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'monthly' ? (
        <div className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 dark:text-slate-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">اختر الشهر:</label>
            </div>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={inputClass} />
          </div>

          {/* Monthly summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{monthlyByType.receipt.toLocaleString('ar')}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">عدد سندات الإدخال</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{monthlyByType.issue.toLocaleString('ar')}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">عدد سندات الصرف</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <TrendingDown className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-2 rotate-180" />
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{monthlyByType.return.toLocaleString('ar')}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">عدد سندات الاسترجاع</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
              <FileBarChart className="w-5 h-5 text-slate-600 dark:text-slate-300 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{monthlyByType.transfer.toLocaleString('ar')}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">عدد سندات التحويل</p>
            </div>
          </div>

          {/* Monthly transactions table */}
          <div className="print-table bg-white dark:bg-slate-800 print:bg-white rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden overflow-x-auto">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
                <p className="text-sm">جاري التحميل...</p>
              </div>
            ) : monthlyTxns.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
                <FileBarChart className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
                <p className="text-sm">لا توجد حركات في {monthLabel}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">#</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">رقم السند</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">النوع</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الصنف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الكمية</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">المستودع</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                  {monthlyTxns.map((t, idx) => (
                    <tr key={t.id} className="table-row transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 font-mono"><button onClick={() => openVoucher({id:t.voucher_id || t.id,number:t.transaction_number,type:t.transaction_type})} className="text-blue-700 dark:text-blue-300 font-semibold print:text-black" title="فتح السند">{t.transaction_number} · فتح السند</button></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.transaction_type === 'receipt' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                          t.transaction_type === 'issue' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          t.transaction_type === 'return' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {typeLabels[t.transaction_type] ?? t.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">{t.item_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300 font-medium">{t.quantity.toLocaleString('ar')} {t.item_unit}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{t.warehouse_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{t.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Date filter for warehouse/dept tabs */}
          <div className="flex items-center gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              <label className="text-sm text-gray-600 dark:text-slate-400">من تاريخ:</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
              <label className="text-sm text-gray-600 dark:text-slate-400">إلى تاريخ:</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Table */}
          <div className="print-table bg-white dark:bg-slate-800 print:bg-white rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
                <Scale className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600 animate-pulse" />
                <p className="text-sm">جاري التحميل...</p>
              </div>
            ) : tab === 'warehouses' ? (
              filteredWarehouse.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
                  <WarehouseIcon className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
                  <p className="text-sm">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد أرصدة بعد. أضف سندات لإنشاء أرصدة.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">#</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الصنف</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الكود</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">المستودع</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                      {filteredWarehouse.map((b, idx) => (
                        <tr key={`${b.item_id}-${b.warehouse_id}`} className="table-row transition-colors">
                          <td className="px-6 py-3 text-sm text-gray-400 dark:text-slate-500">{idx + 1}</td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">{b.item_name}</td>
                          <td className="px-6 py-3 text-sm text-gray-600 dark:text-slate-400"><code className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{b.item_code}</code></td>
                          <td className="px-6 py-3 text-sm text-gray-600 dark:text-slate-400">{b.warehouse_name}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${b.balance > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                              {b.balance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {b.balance.toLocaleString('ar')} {b.item_unit}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : filteredDept.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
                <p className="text-sm">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد أرصدة أقسام. استخدم سندات الصرف لإصدار أصناف للأقسام.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">#</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">القسم</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الصنف</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الكود</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                    {filteredDept.map((b, idx) => (
                      <tr key={`${b.department_id}-${b.item_id}`} className="table-row transition-colors">
                        <td className="px-6 py-3 text-sm text-gray-400 dark:text-slate-500">{idx + 1}</td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">{b.department_name}</td>
                        <td className="px-6 py-3 text-sm text-gray-700 dark:text-slate-300">{b.item_name}</td>
                        <td className="px-6 py-3 text-sm text-gray-600 dark:text-slate-400"><code className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{b.item_code}</code></td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            {b.balance.toLocaleString('ar')} {b.item_unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Print footer */}
      <div className="hidden print:block mt-6 text-center text-xs text-gray-500">
        <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المستودع — {new Date().toLocaleString('ar-EG')}</p>
      </div>
    </div>
  );
}
