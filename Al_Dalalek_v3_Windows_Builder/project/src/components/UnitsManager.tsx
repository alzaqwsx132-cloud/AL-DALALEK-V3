import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import type { Item } from '@/lib/supabase';
import { listUnits, removeUnit, saveUnit, type UnitOption } from '@/lib/voucher-data';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import Modal from './Modal';

export default function UnitsManager({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [newName, setNewName] = useState('');
  const [newFactor, setNewFactor] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(true);
  const { show } = useToast();
  const load = async () => {
    if (!item) return;
    setLoading(true);
    try { setUnits(await listUnits(item.id)); setReady(true); }
    catch { setUnits([]); setReady(false); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [item?.id]);
  const addUnit = async () => {
    if (!item) return;
    const name = newName.trim(); const factor = Number(newFactor);
    if (!name || name === item.unit || !Number.isFinite(factor) || factor <= 0) { show('أدخل اسم وحدة مختلفًا ومعامل تحويل موجبًا', 'error'); return; }
    if (units.some((u) => u.name === name)) { show('هذه الوحدة موجودة بالفعل', 'error'); return; }
    try { await saveUnit({ item_id:item.id, name, factor_to_base:factor, is_default:false }); setNewName(''); setNewFactor(''); await load(); show('تم إضافة الوحدة'); }
    catch { show('تعذر حفظ وحدة القياس؛ تحقق من تفعيل الترحيل والصلاحيات', 'error'); }
  };
  const setDefault = async (unitId: string | null) => {
    if (!item) return;
    const { error } = await supabase.rpc('set_item_default_unit', { p_item_id: item.id, p_unit_id: unitId });
    if (error) { show('يلزم تفعيل دالة اختيار الوحدة الافتراضية', 'error'); return; }
    await load(); show('تم تعيين الوحدة الافتراضية');
  };
  const remove = async (u: UnitOption) => {
    if (!window.confirm(`حذف وحدة ${u.name} من الخيارات المستقبلية؟ السندات التاريخية لن تتغير.`)) return;
    try { await removeUnit(u.id); await load(); show('تم حذف الوحدة البديلة'); }
    catch { show('تعذر حذف الوحدة', 'error'); }
  };
  return <Modal open={!!item} onClose={onClose} title={`الأصناف ← إدارة وحدات القياس — ${item?.name ?? ''}`} size="xl">
    {item && <div dir="rtl" className="space-y-5 text-slate-900 dark:text-slate-100">
      <p className="text-sm bg-blue-50 dark:bg-slate-700 rounded-xl p-3">الوحدة الأساسية: <strong>{item.unit}</strong> — جميع الأرصدة المخزنية تحفظ بهذه الوحدة. معامل التحويل = عدد الوحدات الأساسية داخل وحدة واحدة من البديلة.</p>
      {!ready && <p className="text-sm text-amber-700 dark:text-amber-300 flex gap-2 items-center"><AlertTriangle className="w-4 h-4"/>جدول وحدات القياس غير مفعّل في قاعدة البيانات. راجع ملف الترحيل الاختياري المرفق قبل استخدام الميزة.</p>}
      <table className="w-full text-sm text-right"><thead className="bg-blue-100 dark:bg-slate-700"><tr><th className="p-3">الوحدة</th><th className="p-3">معامل التحويل</th><th className="p-3">الافتراضية</th><th className="p-3">إجراء</th></tr></thead><tbody className="divide-y dark:divide-slate-700"><tr><td className="p-3">{item.unit} (أساسية)</td><td className="p-3">1</td><td className="p-3"><input type="radio" checked={!units.some((u) => u.is_default)} onChange={()=>void setDefault(null)} disabled={!ready}/></td><td className="p-3">ثابتة</td></tr>{units.map((unit)=><tr key={unit.id}><td className="p-3">{unit.name}</td><td className="p-3">{unit.factor_to_base}</td><td className="p-3"><input type="radio" checked={unit.is_default} onChange={()=>void setDefault(unit.id)} disabled={!ready}/></td><td className="p-3"><button onClick={()=>void remove(unit)} className="text-red-600" title="حذف"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody></table>
      <div className="flex gap-2 flex-wrap"><input aria-label="اسم الوحدة البديلة" value={newName} onChange={(e)=>setNewName(e.target.value)} className="border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-600 flex-1 min-w-40" placeholder="اسم الوحدة البديلة (مثلاً شدة)"/><input aria-label="معامل التحويل" value={newFactor} onChange={(e)=>setNewFactor(e.target.value)} type="number" min="0.000001" step="any" className="border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-600 w-40" placeholder="معامل التحويل"/><button onClick={()=>void addUnit()} disabled={!ready || loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4"/>إضافة وحدة</button></div>
      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><Save className="w-4 h-4"/>لا تحوّل الحركات القديمة تلقائيًا. تحتفظ السندات الجديدة بوحدتها الأصلية وكميتها مع حفظ المكافئ الأساسي عند تفعيل ترحيل قاعدة البيانات.</p>
    </div>}
  </Modal>;
}
