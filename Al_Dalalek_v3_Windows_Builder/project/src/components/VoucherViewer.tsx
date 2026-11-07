import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FileText, Printer, X, AlertCircle, Layers, Settings2 } from 'lucide-react';
import { loadVoucher, type SavedUnit } from '@/lib/voucher-data';
import type { Transaction } from '@/lib/supabase';
import { VOUCHER_LABELS, type VoucherReference } from '@/lib/voucher-utils';
import { useAuth } from '@/lib/auth';

type VoucherPrintSettings = { orientation: 'portrait' | 'landscape'; includeNotes: boolean; includeHeader: boolean };
const DEFAULT_PRINT: VoucherPrintSettings = { orientation: 'portrait', includeNotes: true, includeHeader: true };
function readPrintSettings(): VoucherPrintSettings {
  try {
    const s = JSON.parse(localStorage.getItem('aldalalek_voucher_print_settings') || '{}');
    return {
      orientation: s.orientation === 'landscape' ? 'landscape' : 'portrait',
      includeNotes: s.includeNotes !== false, includeHeader: s.includeHeader !== false,
    };
  } catch { return DEFAULT_PRINT; }
}

const VoucherContext = createContext<{ openVoucher: (ref: VoucherReference) => void } | null>(null);
export function useVoucher() {
  const ctx = useContext(VoucherContext);
  if (!ctx) throw new Error('VoucherProvider missing');
  return ctx;
}

export function VoucherProvider({ children }: { children: ReactNode }) {
  const [reference, setReference] = useState<VoucherReference | null>(null);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [units, setUnits] = useState<SavedUnit[]>([]);
  const [generalNotes, setGeneralNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printSettings, setPrintSettings] = useState<VoucherPrintSettings>(readPrintSettings);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const updatePrintSettings = (next: VoucherPrintSettings) => {
    setPrintSettings(next);
    localStorage.setItem('aldalalek_voucher_print_settings', JSON.stringify(next));
  };
  const { hasTransactionTypePermission } = useAuth();

  useEffect(() => {
    if (!reference) return;
    let active = true;
    setLoading(true); setRows([]); setUnits([]); setError(''); setGeneralNotes(null);
    loadVoucher(reference).then((result) => {
      if (!active) return;
      setRows(result.rows); setUnits(result.unitSnapshots); setGeneralNotes(result.generalNotes);
      if (!result.rows.length) setError('لم يُعثر على السند المرتبط بهذه الإشارة.');
    }).catch(() => { if (active) setError('تعذر جلب السند من قاعدة البيانات.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reference]);

  const voucher = rows[0];
  const allowed = voucher && hasTransactionTypePermission(voucher.transaction_type, 'view');
  const snapFor = (row: Transaction): SavedUnit | undefined => units.find((unit) => unit.item_id === row.item_id);
  return (
    <VoucherContext.Provider value={{ openVoucher: setReference }}>
      {children}
      {reference && <style>{`@media print { @page { size: A4 ${printSettings.orientation}; margin: 12mm; } }`}</style>}
      {reference && <div className="voucher-print-overlay fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-5" dir="rtl" role="dialog" aria-modal="true" aria-label="فتح السند">
        <div className="absolute inset-0 bg-slate-950/70 print:hidden" onClick={() => setReference(null)} />
        <div className="voucher-print relative flex flex-col w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl border border-blue-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-2xl text-slate-900 dark:text-slate-100 print:max-h-none print:border-0 print:shadow-none print:overflow-visible">
          <div className={`flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-l from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-blue-100 dark:border-slate-700 ${!printSettings.includeHeader ? 'print:hidden' : ''}`}>
            <div className="flex items-center gap-3"><FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" /><div><h2 className="text-lg sm:text-xl font-bold">إدارة السندات — عرض سند (حركة مخزون)</h2><p className="text-xs text-slate-500 dark:text-slate-300">عرض للقراءة فقط — السند محفوظ في قاعدة البيانات</p></div></div>
            <button type="button" onClick={() => setReference(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 print:hidden" aria-label="إغلاق"><X className="w-5 h-5" /></button>
          </div>
          {showPrintSettings && <div className="print:hidden px-5 py-3 flex flex-wrap items-center gap-4 text-sm bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-2"><span>اتجاه الورقة</span><select value={printSettings.orientation} onChange={(e) => updatePrintSettings({ ...printSettings, orientation: e.target.value as VoucherPrintSettings['orientation'] })} className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 bg-white dark:bg-slate-700"><option value="portrait">عمودي A4</option><option value="landscape">أفقي A4</option></select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={printSettings.includeNotes} onChange={(e) => updatePrintSettings({ ...printSettings, includeNotes: e.target.checked })}/>طباعة الملاحظات العامة</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={printSettings.includeHeader} onChange={(e) => updatePrintSettings({ ...printSettings, includeHeader: e.target.checked })}/>طباعة الترويسة</label>
            <span className="text-slate-500 dark:text-slate-400">الخط: العناوين 16، التفاصيل 14</span>
          </div>}
          <div className="overflow-auto p-4 sm:p-6 space-y-5 print:overflow-visible">
            {loading ? <div className="py-16 text-center">جاري تحميل السند...</div> : error ? <p className="flex items-center gap-2 text-red-600"><AlertCircle />{error}</p> : !allowed ? <p className="text-red-600">ليس لديك صلاحية عرض هذا النوع من السندات.</p> : voucher && <>
              <div className="rounded-xl border border-blue-100 dark:border-slate-700 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 dark:bg-slate-800">
                <div><p className="text-slate-500 dark:text-slate-400">رقم السند</p><strong dir="ltr" className="block text-right">{voucher.transaction_number}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">نوع السند</p><strong>{VOUCHER_LABELS[voucher.transaction_type]}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">التاريخ</p><strong>{voucher.date}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">حالة السند</p><strong>{voucher.voucher_id ? 'معتمد / محفوظ' : 'سند قديم'}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">المستودع</p><strong>{voucher.warehouses?.name || '—'}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">المستودع المستلم</p><strong>{voucher.to_warehouses?.name || '—'}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">القسم</p><strong>{voucher.departments?.name || '—'}</strong></div>
                <div><p className="text-slate-500 dark:text-slate-400">القسم المستلم</p><strong>{voucher.to_departments?.name || '—'}</strong></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-blue-200 dark:border-slate-700">
                <table data-voucher-type={voucher.transaction_type} className="w-full min-w-[760px] text-sm text-right"><thead><tr className="bg-blue-100 dark:bg-slate-700">{['رقم المادة','اسم المادة','المستودع','الكمية','الوحدة','الملاحظات'].map((h) => <th key={h} className="p-3 border-l border-blue-200 dark:border-slate-600">{h}</th>)}</tr></thead>
                <tbody>{rows.map((row) => { const u = snapFor(row); return <tr key={row.id} className="odd:bg-white even:bg-blue-50/50 dark:odd:bg-slate-900 dark:even:bg-slate-800/80 border-t border-blue-100 dark:border-slate-700"><td className="p-3">{row.items?.code || '—'}</td><td className="p-3 font-semibold">{row.items?.name || '—'}</td><td className="p-3">{row.warehouses?.name || '—'}</td><td className="p-3">{u ? Number(u.entered_quantity) : Number(row.quantity)}</td><td className="p-3">{u?.unit_name || row.items?.unit || '—'}</td><td className="p-3">{row.notes || '—'}</td></tr>; })}</tbody></table>
              </div>
              <div className="grid sm:grid-cols-2 gap-4"><div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700"><h3 className="font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-blue-600" />ملخص الحركة</h3><p className="text-sm mt-2">عدد المواد: {rows.length}</p><p className="text-sm">الكمية لكل مادة موضحة في الجدول بوحدتها، ولا تُجمع كميات مواد مختلفة</p></div><div className={`p-4 rounded-xl border border-slate-200 dark:border-slate-700 ${!printSettings.includeNotes ? 'print:hidden' : ''}`}><h3 className="font-bold">ملاحظات السند العامة</h3><p className="text-sm mt-2 whitespace-pre-wrap">{generalNotes || '—'}</p></div></div>
              {!voucher.voucher_id && <p className="text-xs text-amber-700 dark:text-amber-300">تنبيه: هذه حركة قديمة بلا معرّف سند موحّد؛ تم البحث برقم الحركة ونوعها. الوحدات التاريخية غير محفوظة لهذه الحركة.</p>}
              {voucher.voucher_id && units.length < rows.length && <p className="text-xs text-amber-700 dark:text-amber-300">بعض الأسطر لا تتوفر لها لقطة وحدة تاريخية؛ عُرضت الكمية الأساسية مع وحدة الصنف الحالية.</p>}
            </>}
          </div>
          <div className="flex flex-wrap gap-3 justify-end px-5 py-3 border-t border-slate-200 dark:border-slate-700 print:hidden">
            {voucher && allowed && hasTransactionTypePermission(voucher.transaction_type, 'print') && <button type="button" onClick={() => setShowPrintSettings(!showPrintSettings)} className="flex gap-2 items-center px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600"><Settings2 className="w-4 h-4"/>إعدادات الطباعة</button>}
            {voucher && allowed && hasTransactionTypePermission(voucher.transaction_type, 'print') && <button type="button" onClick={() => window.print()} className="flex gap-2 items-center px-5 py-2 rounded-lg border border-blue-200 text-blue-700 dark:text-blue-300"><Printer className="w-4 h-4" />طباعة</button>}
            <button type="button" onClick={() => setReference(null)} className="px-5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 dark:text-slate-100">إغلاق</button>
          </div>
        </div>
      </div>}
    </VoucherContext.Provider>
  );
}
