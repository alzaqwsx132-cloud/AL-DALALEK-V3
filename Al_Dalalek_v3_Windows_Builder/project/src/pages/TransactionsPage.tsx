import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, TrendingUp, TrendingDown, Undo2, ArrowRightLeft, Building2, FileText, Eye, Printer, Save, RotateCcw, Layers, Download, AlertTriangle } from 'lucide-react';
import { fetchTransactions, createVoucher, fetchItems, fetchWarehouses, fetchDepartments, logAudit, describeDatabaseError } from '@/lib/database';
import { listAllUnits, type UnitOption } from '@/lib/voucher-data';
import type { Transaction, TransactionType, Item, Warehouse, Department } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { useVoucher } from '@/components/VoucherViewer';
import { VOUCHER_LABELS, VOUCHER_TYPES, previewHistoricalNumbers, toBaseQuantity } from '@/lib/voucher-utils';
import Modal from '@/components/Modal';

type FormData = {
  transaction_type: TransactionType;
  warehouse_id: string;
  to_warehouse_id: string;
  department_id: string;
  to_department_id: string;
  date: string;
  notes: string;
};
type LineData = { item_id: string; warehouse_id: string; quantity: string; unit_name: string; notes: string };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const emptyForm = (): FormData => ({ transaction_type: 'receipt', warehouse_id: '', to_warehouse_id: '', department_id: '', to_department_id: '', date: today(), notes: '' });
const emptyLine = (): LineData => ({ item_id: '', warehouse_id: '', quantity: '', unit_name: '', notes: '' });
const style: Record<TransactionType, { icon: typeof TrendingUp; active: string; inactive: string }> = {
  receipt: { icon: TrendingUp, active: 'bg-green-100 dark:bg-emerald-900/40 border-green-600 text-green-800 dark:text-green-200', inactive: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' },
  issue: { icon: TrendingDown, active: 'bg-red-100 dark:bg-red-900/40 border-red-600 text-red-800 dark:text-red-200', inactive: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-800 text-red-800 dark:text-red-200' },
  return: { icon: Undo2, active: 'bg-blue-100 dark:bg-blue-900/40 border-blue-600 text-blue-800 dark:text-blue-200', inactive: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200' },
  transfer_wh: { icon: ArrowRightLeft, active: 'bg-orange-100 dark:bg-orange-900/40 border-orange-600 text-orange-800 dark:text-orange-200', inactive: 'bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-800 text-orange-800 dark:text-orange-200' },
  transfer_dept: { icon: Building2, active: 'bg-violet-100 dark:bg-violet-900/40 border-violet-600 text-violet-800 dark:text-violet-200', inactive: 'bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-800 text-violet-800 dark:text-violet-200' },
};
const input = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400';

export default function TransactionsPage() {
  const { user, hasTransactionTypePermission } = useAuth();
  const { show } = useToast();
  const { openVoucher } = useVoucher();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [itemUnits, setItemUnits] = useState<UnitOption[]>([]);
  const [unitsReady, setUnitsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [lines, setLines] = useState<LineData[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [filterItem, setFilterItem] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [tx, it, wh, dep] = await Promise.all([fetchTransactions(), fetchItems(), fetchWarehouses(), fetchDepartments()]);
      setTransactions(tx); setItems(it); setWarehouses(wh); setDepartments(dep);
      // The original uploaded schema does not have this table. Base-unit saving remains available.
      try { setItemUnits(await listAllUnits()); setUnitsReady(true); }
      catch { setItemUnits([]); setUnitsReady(false); }
    } catch (err) { show(describeDatabaseError(err), 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = transactions.filter((t) => {
    const text = `${t.items?.name || ''} ${t.items?.code || ''} ${t.transaction_number}`.toLowerCase();
    return (typeFilter === 'all' || t.transaction_type === typeFilter) && text.includes(search.trim().toLowerCase()) && hasTransactionTypePermission(t.transaction_type, 'view');
  });
  // View by actual voucher ID, not a transaction line ID; only one list record per voucher.
  const vouchers = useMemo(() => {
    const groups = new Map<string, Transaction>();
    filtered.forEach((tx) => { const key = tx.voucher_id || `${tx.transaction_type}:${tx.date}:${tx.transaction_number}`; if (!groups.has(key)) groups.set(key, tx); });
    return Array.from(groups.values());
  }, [filtered]);
  const preview = useMemo(() => previewHistoricalNumbers(transactions), [transactions]);

  const openAdd = () => {
    const first = VOUCHER_TYPES.find((type) => hasTransactionTypePermission(type, 'add'));
    if (!first) { show('لا تمتلك صلاحية إنشاء السندات', 'error'); return; }
    setForm({ ...emptyForm(), transaction_type: first });
    setLines([emptyLine()]); setFilterItem(''); setRequestId(crypto.randomUUID()); setModalOpen(true);
  };
  const patchLine = (idx: number, values: Partial<LineData>) => setLines((current) => current.map((line, i) => idx === i ? { ...line, ...values } : line));
  const itemFor = (line: LineData) => items.find((item) => item.id === line.item_id);
  const unitsFor = (line: LineData) => {
    const item = itemFor(line);
    if (!item) return [];
    return [{ name: item.unit, factor: 1, isDefault: !itemUnits.some((u) => u.item_id === item.id && u.is_default) }, ...itemUnits.filter((u) => u.item_id === item.id && u.name !== item.unit).map((u) => ({ name: u.name, factor: Number(u.factor_to_base), isDefault: u.is_default }))];
  };
  const addItem = (item: Item) => {
    if (lines.some((line) => line.item_id === item.id)) { show('المادة موجودة بالفعل في السند', 'error'); return; }
    const defaultUnit = itemUnits.find((u) => u.item_id === item.id && u.is_default)?.name || item.unit;
    const newLine: LineData = { ...emptyLine(), item_id: item.id, unit_name: defaultUnit, warehouse_id: form.warehouse_id };
    setLines((old) => old.length === 1 && !old[0].item_id ? [newLine] : [...old, newLine]);
    setFilterItem('');
  };
  const validate = (): boolean => {
    const type = form.transaction_type;
    if (!form.date) { show('أدخل تاريخ السند', 'error'); return false; }
    if (['receipt', 'issue', 'return', 'transfer_wh'].includes(type) && !form.warehouse_id) { show('اختر المستودع', 'error'); return false; }
    if (type === 'transfer_wh' && (!form.to_warehouse_id || form.warehouse_id === form.to_warehouse_id)) { show('اختر مستودعين مختلفين', 'error'); return false; }
    if (['issue', 'return', 'transfer_dept'].includes(type) && !form.department_id) { show('اختر القسم', 'error'); return false; }
    if (type === 'transfer_dept' && (!form.to_department_id || form.department_id === form.to_department_id)) { show('اختر قسمين مختلفين', 'error'); return false; }
    if (!lines.length || lines.some((line) => !line.item_id || !line.quantity.trim())) { show('اختر المادة والكمية لكل سطر', 'error'); return false; }
    if (new Set(lines.map((line) => line.item_id)).size !== lines.length) { show('لا تكرر نفس المادة في السند', 'error'); return false; }
    try {
      lines.forEach((line) => {
        const unit = unitsFor(line).find((u) => u.name === line.unit_name);
        if (!unit) throw new Error('وحدة قياس غير صالحة للمادة');
        toBaseQuantity(Number(line.quantity), unit.factor);
      });
    } catch (err) { show(err instanceof Error ? err.message : 'كمية غير صالحة', 'error'); return false; }
    if (!hasTransactionTypePermission(type, 'add')) { show('ليس لديك صلاحية إنشاء هذا النوع من السندات', 'error'); return false; }
    return true;
  };
  const handleSave = async () => {
    if (saving || !validate() || !user) return;
    setSaving(true);
    try {
      const normalized = lines.map((line) => {
        const unit = unitsFor(line).find((u) => u.name === line.unit_name)!;
        return { itemId: line.item_id, warehouseId: line.warehouse_id || form.warehouse_id || null,
          toWarehouseId: form.to_warehouse_id || null, departmentId: form.department_id || null,
          toDepartmentId: form.to_department_id || null,
          quantity: toBaseQuantity(Number(line.quantity), unit.factor),
          enteredQuantity: Number(line.quantity), unitName: line.unit_name,
          notes: line.notes.trim() || null };
      });
      // The RPC wrapper atomically stores quantities in base units and unit snapshots.
      // Without this migration, base units only use the pre-existing create_voucher RPC.
      if (!unitsReady && lines.some((line) => line.unit_name !== itemFor(line)?.unit)) throw new Error('يجب تفعيل إدارة الوحدات في قاعدة البيانات أولاً');
      const voucherId = await createVoucher({ userId: user.id, requestId, transactionType: form.transaction_type,
        warehouseId: form.warehouse_id || null, toWarehouseId: form.to_warehouse_id || null,
        departmentId: form.department_id || null, toDepartmentId: form.to_department_id || null,
        date: form.date, notes: form.notes.trim() || null, lines: normalized,
        useUnitSnapshots: unitsReady && lines.some((line) => line.unit_name !== itemFor(line)?.unit) });
      try { await logAudit('create', 'transactions', `إضافة سند ${VOUCHER_LABELS[form.transaction_type]}`, user.username, voucherId); }
      catch { /* Saving already committed, audit RPC may be unavailable */ }
      show('تم حفظ السند واعتماده بنجاح');
      setModalOpen(false);
      await load();
      openVoucher({ id: voucherId });
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      show(details.includes('create_voucher_with_units') || details.includes('function') ? 'يلزم تطبيق ترحيل إدارة الوحدات قبل إنشاء السندات بهذه الواجهة' : details.includes('التحويل') ? details : describeDatabaseError(err), 'error');
    } finally { setSaving(false); }
  };
  const exportPreview = () => {
    const escapeCSV = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const contents = '\ufeff' + ['voucher_id,old_number,proposed_number,type,date', ...preview.map((row) => [row.voucherId, row.oldNumber, row.proposedNumber, row.type, row.date].map(escapeCSV).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'preview_voucher_renumbering.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return <div dir="rtl" className="space-y-5 text-slate-900 dark:text-slate-100">
    <div className="flex gap-3 justify-between flex-wrap print:hidden"><div><h1 className="text-2xl font-bold">إدارة السندات</h1><p className="text-sm text-slate-500 dark:text-slate-400">إدخال · صرف · استرجاع · تحويل بين المستودعات والأقسام</p></div><div className="flex gap-2 flex-wrap">{user?.role === 'admin' && <button onClick={() => setPreviewOpen(true)} className="rounded-lg border border-amber-300 text-amber-800 dark:text-amber-200 dark:bg-slate-800 px-3 py-2 text-sm flex items-center gap-2"><Layers className="w-4 h-4"/>معاينة الترقيم القديم</button>}<button onClick={() => window.print()} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm flex items-center gap-2"><Printer className="w-4 h-4"/>طباعة القائمة</button>{VOUCHER_TYPES.some((t) => hasTransactionTypePermission(t,'add')) && <button onClick={openAdd} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus className="w-4 h-4"/>إضافة سند</button>}</div></div>
    <div className="flex flex-wrap items-center gap-2 print:hidden"><div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">{[{ key:'all', label:'الكل' }, ...VOUCHER_TYPES.map((t) => ({key:t, label:VOUCHER_LABELS[t]}))].filter((t) => t.key==='all' || hasTransactionTypePermission(t.key as TransactionType,'view')).map((tab) => <button key={tab.key} onClick={() => setTypeFilter(tab.key)} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm ${typeFilter===tab.key ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-200 shadow' : 'text-slate-600 dark:text-slate-300'}`}>{tab.label}</button>)}</div><div className="relative flex-1 min-w-[190px]"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input className={`${input} pr-10`} placeholder="بحث برقم السند أو اسم المادة" value={search} onChange={(e) => setSearch(e.target.value)}/></div></div>
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-800"><table className="w-full min-w-[770px] text-right text-sm"><thead><tr className="bg-blue-50 dark:bg-slate-700">{['رقم السند','نوع السند','التاريخ','القسم','المستودع','عدد المواد','إجراءات'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{loading ? <tr><td colSpan={7} className="p-10 text-center">جاري التحميل...</td></tr> : vouchers.length===0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">لا توجد سندات مطابقة</td></tr> : vouchers.map((t) => { const count = transactions.filter((s) => (t.voucher_id ? s.voucher_id === t.voucher_id : s.transaction_number === t.transaction_number && s.transaction_type === t.transaction_type && s.date === t.date && !s.voucher_id)).length; const Icon = style[t.transaction_type].icon; return <tr key={t.voucher_id || t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-4 py-3 font-mono text-xs">{t.transaction_number}</td><td className="px-4 py-3"><span className="inline-flex gap-2 items-center"><Icon className="w-4 h-4 text-blue-600"/>{VOUCHER_LABELS[t.transaction_type]}</span></td><td className="px-4 py-3">{t.date}</td><td className="px-4 py-3">{t.departments?.name || '—'}</td><td className="px-4 py-3">{t.warehouses?.name || '—'}</td><td className="px-4 py-3">{count}</td><td className="px-4 py-3"><button onClick={() => openVoucher({ id: t.voucher_id || t.id, number: t.transaction_number, type: t.transaction_type })} className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 font-bold print:hidden" title="فتح السند"><Eye className="w-4 h-4"/>فتح السند</button></td></tr>; })}</tbody></table></div>
    <Modal open={modalOpen} onClose={() => { if(!saving) setModalOpen(false); }} title="إدارة السندات — إدخال سند (حركة مخزون)" size="xl" footer={<div className="w-full flex gap-2 flex-wrap justify-between"><button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600">إلغاء</button><div className="flex gap-2"><button type="button" onClick={() => {setLines([emptyLine()]); setForm({...emptyForm(), transaction_type:form.transaction_type});}} disabled={saving} className="px-4 py-2 rounded-lg border dark:border-slate-600 flex items-center gap-1"><RotateCcw className="w-4 h-4"/>جديد</button><button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4"/>{saving ? 'جاري الحفظ...' : 'حفظ واعتماد'}</button></div></div>}>
      <div dir="rtl" className="space-y-4 text-slate-900 dark:text-slate-100">
        <p className="text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-slate-700 p-2 rounded-lg text-xs">تصميم السند الموحد · الرقم النهائي ينشئه الخادم عند نجاح الحفظ فقط</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{VOUCHER_TYPES.filter((type) => hasTransactionTypePermission(type,'add')).map((type) => { const Icon=style[type].icon; return <button type="button" key={type} onClick={() => setForm((old) => ({...old, transaction_type:type}))} className={`rounded-lg border-2 px-2 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 ${form.transaction_type === type ? style[type].active : style[type].inactive}`}><Icon className="w-5 h-5 shrink-0"/>{VOUCHER_LABELS[type]}</button>; })}</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div><label className="field-label">رقم السند</label><input className={input} value="تلقائي بعد الحفظ" disabled/></div>
          <div><label className="field-label">التاريخ *</label><input className={input} type="date" value={form.date} onChange={(e) => setForm({...form,date:e.target.value})}/></div>
          {form.transaction_type !== 'transfer_dept' && <div><label className="field-label">{form.transaction_type==='transfer_wh' ? 'المستودع المصدر *' : 'المستودع *'}</label><select className={input} value={form.warehouse_id} onChange={(e) => setForm({...form,warehouse_id:e.target.value})}><option value="">اختر المستودع</option>{warehouses.map((w)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>}
          {form.transaction_type === 'transfer_wh' && <div><label className="field-label">المستودع المستلم *</label><select className={input} value={form.to_warehouse_id} onChange={(e)=>setForm({...form,to_warehouse_id:e.target.value})}><option value="">اختر المستودع</option>{warehouses.filter((w)=>w.id!==form.warehouse_id).map((w)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>}
          {['issue','return','transfer_dept'].includes(form.transaction_type) && <div><label className="field-label">{form.transaction_type==='transfer_dept' ? 'القسم المصدر *' : 'القسم *'}</label><select className={input} value={form.department_id} onChange={(e)=>setForm({...form,department_id:e.target.value})}><option value="">اختر القسم</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
          {form.transaction_type==='transfer_dept' && <div><label className="field-label">القسم المستلم *</label><select className={input} value={form.to_department_id} onChange={(e)=>setForm({...form,to_department_id:e.target.value})}><option value="">اختر القسم</option>{departments.filter((d)=>d.id!==form.department_id).map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
        </div>
        <div className="rounded-xl border border-blue-200 dark:border-slate-700 overflow-hidden"><div className="flex justify-between flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-slate-800"><button type="button" onClick={()=>setLines([...lines,emptyLine()])} className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm"><Plus className="w-4 h-4"/>إضافة مادة</button><div className="flex gap-2 items-center"><Search className="w-4 h-4 text-slate-500"/><input className={`${input} max-w-[260px]`} placeholder="بحث عن مادة بالاسم أو الرقم" value={filterItem} onChange={(e)=>setFilterItem(e.target.value)}/></div></div>
          {filterItem.trim() && <div className="max-h-36 overflow-auto border-b dark:border-slate-700 bg-white dark:bg-slate-800">{items.filter((i)=>`${i.name} ${i.code}`.toLowerCase().includes(filterItem.toLowerCase())).slice(0,15).map((i)=><button type="button" onClick={()=>addItem(i)} key={i.id} className="w-full px-4 py-1 text-right hover:bg-blue-100 dark:hover:bg-slate-700 text-sm">{i.code} — {i.name}</button>)}</div>}
          <div className="overflow-x-auto"><table className="w-full text-sm text-right min-w-[920px]"><thead><tr className="bg-blue-100 dark:bg-slate-700">{['رقم المادة','اسم المادة','المستودع','الكمية','الوحدة','الملاحظات'].map((h)=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{lines.map((line,index)=>{ const item=itemFor(line); return <tr key={index} className="even:bg-blue-50/30 dark:even:bg-slate-800/70 border-t border-blue-100 dark:border-slate-700"><td className="p-1 min-w-[96px] text-xs">{item?.code || '—'}</td><td className="p-1 min-w-[200px]"><select className={input} value={line.item_id} onChange={(e)=>{const itm=items.find((i)=>i.id===e.target.value); const d= itemUnits.find((u)=>u.item_id===itm?.id && u.is_default); patchLine(index,{item_id:e.target.value,unit_name:d?.name || itm?.unit || '',warehouse_id:form.warehouse_id});}}><option value="">اختر المادة</option>{items.map((i)=><option key={i.id} value={i.id}>{i.name} — {i.code}</option>)}</select></td><td className="p-1 min-w-[150px]"><select className={input} value={line.warehouse_id || form.warehouse_id} onChange={(e)=>patchLine(index,{warehouse_id:e.target.value})} disabled={form.transaction_type!=='transfer_dept'}><option value="">{form.transaction_type==='transfer_dept' ? 'اختياري' : 'المستودع'}</option>{warehouses.map((w)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></td><td className="p-1"><input className={`${input} min-w-[110px]`} type="number" min="0.001" step="any" value={line.quantity} onChange={(e)=>patchLine(index,{quantity:e.target.value})}/></td><td className="p-1 min-w-[125px]"><select value={line.unit_name} className={input} onChange={(e)=>patchLine(index,{unit_name:e.target.value})} disabled={!item}><option value="">اختر الوحدة</option>{unitsFor(line).map((u)=><option key={u.name} value={u.name}>{u.name}</option>)}</select></td><td className="p-1"><div className="flex items-center gap-1"><input className={`${input} min-w-[150px]`} placeholder="ملاحظات المادة" value={line.notes} onChange={(e)=>patchLine(index,{notes:e.target.value})}/><button type="button" onClick={()=>setLines((old)=>old.length===1 ? [emptyLine()] : old.filter((_,i)=>i!==index))} className="text-red-600 dark:text-red-400 font-bold px-1 print:hidden" title="حذف السطر" aria-label="حذف السطر">×</button></div></td></tr>;})}</tbody></table></div>
        </div>
        <div className="grid md:grid-cols-3 gap-3"><div className="md:col-span-2 rounded-xl p-3 border border-slate-200 dark:border-slate-700"><label className="font-bold text-sm">ملاحظات السند</label><textarea className={`${input} mt-2 min-h-[80px]`} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="ملاحظات عامة على السند"/></div><div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800"><h3 className="font-bold flex gap-2 items-center"><Layers className="w-4 h-4 text-blue-500"/>ملخص الحركة والمخزون</h3><p className="mt-3 text-sm">عدد المواد: <strong>{lines.filter((l)=>l.item_id).length}</strong></p><p className="mt-2 text-sm">حالة السند: <strong>جديد</strong></p><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">الرصيد يحسب بوحدته الأساسية؛ لا تجمع كميات مواد بوحدات مختلفة.</p></div></div>
        {!unitsReady && <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0"/>إدارة الوحدات الإضافية غير مفعلة في قاعدة البيانات؛ تتوفر الوحدات الأساسية فقط.</p>}
      </div>
    </Modal>
    <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)} size="xl" title="معاينة إعادة الترقيم التاريخي — غير منفذة">
      <div className="space-y-3 text-slate-900 dark:text-slate-100"><p className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">هذه قائمة أولية من الحركات المتاحة حاليًا، وقد لا تشمل السندات الملغاة والمؤرشفة أو صفحات النتائج غير المُحمّلة. لا يجوز تطبيق الأرقام قبل نسخة احتياطية والتحقق من كل السندات والحصول على موافقتك الصريحة. <strong>لن يتم تغيير أي رقم من هذه الشاشة.</strong></p><div className="flex justify-between items-center"><p className="text-sm">عدد السندات التي شملتها المعاينة: {preview.length}</p><button onClick={exportPreview} className="px-4 py-2 rounded-lg bg-blue-600 text-white flex gap-1 items-center text-sm"><Download className="w-4 h-4"/>تنزيل CSV للمعاينة</button></div><div className="max-h-80 overflow-auto"><table className="w-full text-sm text-right"><thead className="bg-blue-100 dark:bg-slate-700"><tr>{['التاريخ','نوع السند','الرقم الحالي','الرقم المقترح'].map((h)=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{preview.map((p)=><tr key={p.voucherId} className="border-b dark:border-slate-700"><td className="p-2">{p.date}</td><td className="p-2">{VOUCHER_LABELS[p.type]}</td><td className="p-2">{p.oldNumber}</td><td className="p-2 text-blue-700 dark:text-blue-300">{p.proposedNumber}</td></tr>)}</tbody></table></div></div>
    </Modal>
  </div>;
}
