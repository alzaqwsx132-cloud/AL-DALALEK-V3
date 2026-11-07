import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Building2, FileText } from 'lucide-react';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/lib/database';
import type { Department } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

type FormData = { name: string; code: string };
const emptyForm: FormData = { name: '', code: '' };

export default function DepartmentsPage({ onOpenStatement }: { onOpenStatement?: (deptId: string, deptName: string) => void }) {
  const { show } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setDepartments(await fetchDepartments());
    } catch {
      show('فشل تحميل الأقسام', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = departments.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      show('الرجاء إدخال اسم القسم', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDepartment(editing.id, { name: form.name.trim() });
        show('تم تعديل القسم بنجاح');
      } else {
        await createDepartment({ name: form.name.trim(), code: '' });
        show('تم إضافة القسم بنجاح');
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      show(msg.includes('duplicate') || msg.includes('unique') ? 'كود القسم مستخدم بالفعل' : 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDepartment(deleteTarget.id);
      show('تم حذف القسم بنجاح');
      setDeleteTarget(null);
      await load();
    } catch {
      show('فشل حذف القسم — قد تكون هناك سندات مرتبطة', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">إدارة الأقسام</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">إضافة وتعديل وحذف الأقسام — الكود يُولّد تلقائياً</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          إضافة قسم
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600 animate-pulse" />
          <p className="text-sm">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
          <p className="text-sm">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد أقسام بعد'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">اسم القسم</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الكود</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((d, idx) => (
                  <tr key={d.id} className="table-row transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{d.code}</code>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {onOpenStatement && (
                          <button
                            onClick={() => onOpenStatement(d.id, d.name)}
                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="كشف حساب"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEdit(d)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(d)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل قسم' : 'إضافة قسم جديد'}
        footer={
          <>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">إلغاء</button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم القسم <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: قسم تقنية المعلومات"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 text-sm" />
          </div>
          {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كود القسم</label>
              <input type="text" value={form.code} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm" />
              <p className="text-xs text-gray-400 mt-1">يُولّد تلقائياً عند الإضافة</p>
            </div>
          )}
          {!editing && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-600">سيتم توليد كود القسم تلقائياً عند الحفظ</p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="حذف القسم" message={`هل أنت متأكد من حذف القسم "${deleteTarget?.name}"؟`} />
    </div>
  );
}
