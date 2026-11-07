import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Warehouse, MapPin } from 'lucide-react';
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/lib/database';
import type { Warehouse as WarehouseType } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

type FormData = { name: string; code: string; location: string };
const emptyForm: FormData = { name: '', code: '', location: '' };

export default function WarehousesPage() {
  const { show } = useToast();
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseType | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseType | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setWarehouses(await fetchWarehouses());
    } catch {
      show('فشل تحميل المستودعات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = warehouses.filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (w: WarehouseType) => {
    setEditing(w);
    setForm({ name: w.name, code: w.code, location: w.location ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      show('الرجاء إدخال اسم المستودع', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateWarehouse(editing.id, {
          name: form.name.trim(),
          location: form.location.trim() || null,
        });
        show('تم تعديل المستودع بنجاح');
      } else {
        await createWarehouse({
          name: form.name.trim(),
          code: '',
          location: form.location.trim() || null,
        });
        show('تم إضافة المستودع بنجاح');
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      show(msg.includes('duplicate') || msg.includes('unique') ? 'كود المستودع مستخدم بالفعل' : 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWarehouse(deleteTarget.id);
      show('تم حذف المستودع بنجاح');
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('restrict') || msg.includes('foreign key')) {
        show('لا يمكن حذف المستودع لوجود سندات مرتبطة به', 'error');
      } else {
        show('فشل حذف المستودع', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">إدارة المستودعات</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">إضافة وتعديل وحذف المستودعات — الكود يُولّد تلقائياً</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          إضافة مستودع
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الكود..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
        />
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600 animate-pulse" />
          <p className="text-sm">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
          <p className="text-sm">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد مستودعات بعد'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <div key={w.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 hover:shadow-lg transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Warehouse className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(w)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(w)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-gray-800 dark:text-slate-100 text-lg mb-1">{w.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{w.code}</code>
              </div>
              {w.location && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {w.location}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'تعديل مستودع' : 'إضافة مستودع جديد'}
        footer={
          <>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">
              إلغاء
            </button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستودع <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: المستودع الرئيسي"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-sm" />
          </div>
          {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كود المستودع</label>
              <input type="text" value={form.code} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm" />
              <p className="text-xs text-gray-400 mt-1">يُولّد تلقائياً عند الإضافة</p>
            </div>
          )}
          {!editing && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <p className="text-xs text-emerald-600">سيتم توليد كود المستودع تلقائياً عند الحفظ</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مثال: الطابق الأول"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-sm" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف المستودع"
        message={`هل أنت متأكد من حذف المستودع "${deleteTarget?.name}"؟`}
      />
    </div>
  );
}
