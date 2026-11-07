import { useVoucher } from '@/components/VoucherViewer';
import { useEffect, useState } from 'react';
import { ArrowRight, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { VOUCHER_LABELS } from '@/lib/voucher-utils';
import { fetchDepartmentStatement, fetchDepartments } from '@/lib/database';
import type { DepartmentStatement, Department } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

export default function DepartmentStatementPage({
  departmentId,
  departmentName,
  onBack,
}: {
  departmentId: string;
  departmentName: string;
  onBack: () => void;
}) {
  const { show } = useToast();
  const { openVoucher } = useVoucher();
  const [statements, setStatements] = useState<DepartmentStatement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState(departmentId);
  const [selectedName, setSelectedName] = useState(departmentName);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const deps = await fetchDepartments();
        setDepartments(deps);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedDept) return;
      try {
        setLoading(true);
        const data = await fetchDepartmentStatement(selectedDept);
        setStatements(data);
      } catch {
        show('فشل تحميل كشف الحساب', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDept]);

  const handleDeptChange = (id: string) => {
    const dept = departments.find((d) => d.id === id);
    if (dept) {
      setSelectedDept(id);
      setSelectedName(dept.name);
    }
  };

  // Counts, not a sum of quantities measured in incompatible units.
  const issueLines = statements.filter((s) => s.transaction_type === 'issue').length;
  const returnLines = statements.filter((s) => s.transaction_type === 'return').length;
  const transferLines = statements.filter((s) => s.transaction_type === 'transfer_dept').length;

  return (
    <div className="space-y-6">
      {/* Header — non-printable controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">كشف حساب قسم</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">حركة الأصناف للقسم</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => handleDeptChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors font-medium text-sm shadow-sm"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden print:border-0">
        {/* Print header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 print:border-b-2 print:border-gray-300">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">كشف حساب قسم: {selectedName}</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-600">نظام إدارة المستودع</p>
              <p className="text-xs text-gray-400">إدارة المخزون</p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 p-6 print:grid-cols-3">
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700">{issueLines.toLocaleString('ar')}</p>
            <p className="text-xs text-emerald-600 mt-1">حركات الصرف</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingDown className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{returnLines.toLocaleString('ar')}</p>
            <p className="text-xs text-blue-600 mt-1">حركات الاسترجاع</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{transferLines.toLocaleString('ar')}</p>
            <p className="text-xs text-slate-600 mt-1">حركات التحويل</p>
          </div>
        </div>

        {/* Statement table */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm">جاري التحميل...</p>
            </div>
          ) : statements.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm">لا توجد حركات لهذا القسم</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 print:border-b-2 print:border-gray-300">
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">رقم السند</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">التاريخ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">النوع</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الصنف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">المستودع</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الكمية</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الرصيد</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                  {statements.map((s, idx) => (
                    <tr key={s.id} className="table-row transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 font-mono"><button onClick={() => openVoucher({id:s.voucher_id || s.id,number:s.transaction_number,type:s.transaction_type})} className="text-blue-700 dark:text-blue-300 font-bold print:text-black" title="فتح السند">{s.transaction_number} · فتح السند</button></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.transaction_type === 'issue' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        }`}>
                          {s.transaction_type === 'transfer_dept' ? (s.movement_direction === 'incoming' ? 'تحويل وارد' : 'تحويل صادر') : VOUCHER_LABELS[s.transaction_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.item_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.warehouse_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">{s.quantity} {s.item_unit}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">{s.balance_after.toLocaleString('ar')} {s.item_unit}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate">{s.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Print footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 print:border-t-2 print:border-gray-300 print:flex print:justify-between">
          <p className="text-xs text-gray-400">تم إنشاء هذا التقرير بواسطة نظام إدارة المستودع</p>
        </div>
      </div>
    </div>
  );
}
