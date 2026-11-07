import { useVoucher } from '@/components/VoucherViewer';
import { useEffect, useState } from 'react';
import { Package, Warehouse, Building2, FileText, TrendingUp, TrendingDown, Undo2, Boxes, BarChart3, AlertTriangle, ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { fetchItems, fetchWarehouses, fetchDepartments, fetchTransactions, fetchLowStockAlerts } from '@/lib/database';
import { selectedAlertWarehouse, setSelectedAlertWarehouse } from '@/lib/stock-alerts';
import type { Transaction, LowStockAlert, Warehouse as WarehouseType } from '@/lib/supabase';
import BarChart from '@/components/BarChart';

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { openVoucher } = useVoucher();
  const [stats, setStats] = useState({
    items: 0,
    warehouses: 0,
    departments: 0,
    transactions: 0,
    receipts: 0,
    issues: 0,
    returns: 0,
    warehouseTransfers: 0,
    departmentTransfers: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseType[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(selectedAlertWarehouse);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [items, warehouses, departments, transactions] = await Promise.all([
          fetchItems(),
          fetchWarehouses(),
          fetchDepartments(),
          fetchTransactions(),
        ]);
        setWarehouseOptions(warehouses);
        const voucherMap = new Map<string, Transaction>();
        for (const tx of transactions) {
          const key = tx.voucher_id || `${tx.transaction_type}:${tx.transaction_number}`;
          if (!voucherMap.has(key)) voucherMap.set(key, tx);
        }
        const vouchers = Array.from(voucherMap.values());
        setStats({
          items: items.length,
          warehouses: warehouses.length,
          departments: departments.length,
          transactions: vouchers.length,
          receipts: vouchers.filter((t) => t.transaction_type === 'receipt').length,
          issues: vouchers.filter((t) => t.transaction_type === 'issue').length,
          returns: vouchers.filter((t) => t.transaction_type === 'return').length,
          warehouseTransfers: vouchers.filter((t) => t.transaction_type === 'transfer_wh').length,
          departmentTransfers: vouchers.filter((t) => t.transaction_type === 'transfer_dept').length,
        });
        setRecentTransactions(vouchers.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let current = true;
    setLowStockAlerts([]);
    if (!selectedWarehouse) return;
    void fetchLowStockAlerts(selectedWarehouse).then((alerts) => { if (current) setLowStockAlerts(alerts); })
      .catch((error) => console.error('Low-stock alerts could not load', error));
    return () => { current = false; };
  }, [selectedWarehouse]);

  const cards = [
    { label: 'الأصناف', value: stats.items, icon: Package, color: 'blue', page: 'items' },
    { label: 'المستودعات', value: stats.warehouses, icon: Warehouse, color: 'emerald', page: 'warehouses' },
    { label: 'الأقسام', value: stats.departments, icon: Building2, color: 'amber', page: 'departments' },
    { label: 'السندات', value: stats.transactions, icon: FileText, color: 'slate', page: 'transactions' },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100' },
  };

  const typeLabels: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
    receipt: { label: 'إدخال', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    issue: { label: 'صرف', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
    return: { label: 'استرجاع', icon: Undo2, color: 'text-blue-600 bg-blue-50' },
    transfer_wh: { label: 'تحويل مستودعات', icon: ArrowRightLeft, color: 'text-orange-600 bg-orange-50' },
    transfer_dept: { label: 'تحويل أقسام', icon: Building2, color: 'text-violet-600 bg-violet-50' },
  };

  const chartData = [
    { label: 'إدخال', value: stats.receipts, color: 'bg-emerald-500' },
    { label: 'صرف', value: stats.issues, color: 'bg-red-500' },
    { label: 'استرجاع', value: stats.returns, color: 'bg-blue-500' },
    { label: 'تحويل مستودعات', value: stats.warehouseTransfers, color: 'bg-orange-500' },
    { label: 'تحويل أقسام', value: stats.departmentTransfers, color: 'bg-violet-500' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">لوحة التحكم</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">نظرة عامة على نظام إدارة المستودع</p>
      </div>

      {/* Alerts always use one explicitly selected warehouse and each item's own minimum. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-4">
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600"/>تنبيهات المخزون</h2>
            {selectedWarehouse && <span className="text-xs text-slate-500 dark:text-slate-300">{lowStockAlerts.length} مادة بلغت الحد الأدنى أو أقل</span>}
          </div>
          {!selectedWarehouse ? <p className="text-sm text-amber-800 dark:text-amber-200 p-3 rounded-lg bg-amber-50 dark:bg-slate-700">اختر مستودعًا من إعدادات تنبيهات المخزون لعرض تنبيهاته فقط.</p> :
           !warehouseOptions.some((w) => w.id === selectedWarehouse) ? <p className="text-sm text-red-700 dark:text-red-300">المستودع المحدد لم يعد موجودًا. اختر مستودعًا آخر.</p> :
           lowStockAlerts.length === 0 ? <p className="text-sm text-emerald-700 dark:text-emerald-300">لا توجد مواد دون الحد الأدنى في المستودع المحدد.</p> :
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{lowStockAlerts.slice(0, 12).map((alert) => <div key={alert.item_id} className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex justify-between gap-2 items-center bg-amber-50/70 dark:bg-slate-900/50">
             <div><div className="text-sm font-bold text-slate-800 dark:text-slate-100">{alert.item_name}</div><p className="text-xs text-slate-600 dark:text-slate-300">{alert.item_code} · الرصيد {alert.total_balance.toLocaleString('ar')} {alert.item_unit} · الحد {alert.reorder_level.toLocaleString('ar')}</p></div>
             <span className={`text-xs whitespace-nowrap font-bold ${alert.total_balance <= 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>{alert.total_balance <= 0 ? 'نفاد' : 'منخفض'}</span>
           </div>)}</div>}
          {lowStockAlerts.length > 12 && <button className="mt-2 text-blue-700 dark:text-blue-300 text-sm" onClick={() => onNavigate('items')}>عرض الأصناف</button>}
        </section>
        <aside className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4 space-y-3" aria-label="إعدادات تنبيهات المخزون">
          <h2 className="font-bold text-blue-900 dark:text-slate-100">إعدادات تنبيهات المخزون</h2>
          <label htmlFor="alert-warehouse" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">المستودع المحدد</label>
          <select id="alert-warehouse" value={selectedWarehouse} onChange={(e) => { const id = e.target.value; setSelectedWarehouse(id); setSelectedAlertWarehouse(id); }} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 text-sm">
            <option value="">اختر مستودعًا</option>{warehouseOptions.map((w) => <option value={w.id} key={w.id}>{w.name}</option>)}
          </select>
          <p className="text-xs text-slate-600 dark:text-slate-300">التنبيه يراقب هذا المستودع وحده، ويقارن رصيد كل صنف مع الحد الأدنى الموجود في بطاقة الصنف. لا يجمع أرصدة المستودعات.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">هذا الاختيار محفوظ على جهازك الحالي.</p>
        </aside>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const c = colorMap[card.color];
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onNavigate(card.page)}
              className={`bg-white dark:bg-slate-800 rounded-xl border ${c.border} dark:border-slate-700 p-5 hover:shadow-lg transition-all text-right group`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${c.text}`} />
                </div>
                <Boxes className="w-5 h-5 text-gray-200 group-hover:text-gray-300 transition-colors" />
              </div>
              <p className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-1">{loading ? '—' : card.value}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* Chart + Transaction type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-bold text-gray-800 dark:text-slate-100">مخطط السندات حسب النوع</h2>
          </div>
          <BarChart data={chartData} height={220} emptyMessage="لا توجد سندات بعد" />
        </div>

        {/* Transaction type breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-800 dark:text-slate-100 mb-4">توزيع السندات</h2>
          <div className="space-y-3">
            {Object.entries(typeLabels).map(([type, info]) => {
              const Icon = info.icon;
              const count = type === 'receipt' ? stats.receipts : type === 'issue' ? stats.issues : type === 'return' ? stats.returns : type === 'transfer_wh' ? stats.warehouseTransfers : stats.departmentTransfers;
              const total = stats.transactions || 1;
              const pct = Math.round((count / total) * 100);
              const barColor = type === 'receipt' ? 'bg-emerald-500' : type === 'issue' ? 'bg-red-500' : type === 'return' ? 'bg-blue-500' : type === 'transfer_wh' ? 'bg-orange-500' : 'bg-violet-500';              return (
                <div key={type} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${info.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{info.label}</span>
                      <span className="text-sm text-gray-500 dark:text-slate-400">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-700`}
                        style={{ width: loading ? '0%' : `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-slate-100">أحدث السندات</h2>
          <button onClick={() => onNavigate('transactions')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            عرض الكل
          </button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 dark:text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
            <p className="text-sm">لا توجد سندات بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentTransactions.map((t) => {
              const info = typeLabels[t.transaction_type];
              const Icon = info.icon;
              return (
                <div key={t.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${info.color} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                        {t.items?.name ?? '—'} — {t.quantity} {t.items?.unit ?? ''}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{t.transaction_number} · {t.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${info.color}`}>{info.label}</span><button onClick={() => openVoucher({id:t.voucher_id || t.id,number:t.transaction_number,type:t.transaction_type})} className="text-xs text-blue-700 dark:text-blue-300 font-bold print:hidden">فتح السند</button></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
