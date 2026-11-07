import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle, ImagePlus, X, Upload, Printer, FileText, Download, Eye, ZoomIn, Warehouse } from 'lucide-react';
import { fetchItems, createItem, updateItem, deleteItem, uploadItemImage, deleteItemImage, uploadItemFile, fetchItemBalancesByWarehouse, logAudit } from '@/lib/database';
import type { Item } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import UnitsManager from '@/components/UnitsManager';
import { Ruler } from 'lucide-react';

type FormData = {
  name: string;
  code: string;
  unit: string;
  category: string;
  description: string;
  reorder_level: string;
  image_url: string;
  file_url: string;
  file_name: string;
};

const emptyForm: FormData = { name: '', code: '', unit: 'قطعة', category: '', description: '', reorder_level: '0', image_url: '', file_url: '', file_name: '' };

export default function ItemsPage() {
  const { user, hasPermission } = useAuth();
  const { show } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [balancesModal, setBalancesModal] = useState<{ item: Item; balances: { warehouse_id: string; warehouse_name: string; warehouse_code: string; balance: number }[] } | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [unitsItem, setUnitsItem] = useState<Item | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchItems();
      setItems(data);
    } catch (err) {
      show('فشل تحميل الأصناف', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      (i.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      code: item.code,
      unit: item.unit,
      category: item.category ?? '',
      description: item.description ?? '',
      reorder_level: String(item.reorder_level ?? 0),
      image_url: item.image_url ?? '',
      file_url: item.file_url ?? '',
      file_name: item.file_url ? item.file_url.split('/').pop() ?? '' : '',
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadItemImage(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      show('تم رفع الصورة بنجاح');
    } catch {
      show('فشل رفع الصورة', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const url = await uploadItemFile(file);
      setForm((prev) => ({ ...prev, file_url: url, file_name: file.name }));
      show('تم رفع الملف بنجاح');
    } catch {
      show('فشل رفع الملف', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveImage = () => {
    if (form.image_url) {
      deleteItemImage(form.image_url).catch(() => {});
    }
    setForm((prev) => ({ ...prev, image_url: '' }));
  };

  const handleRemoveFile = () => {
    if (form.file_url) {
      deleteItemImage(form.file_url).catch(() => {});
    }
    setForm((prev) => ({ ...prev, file_url: '', file_name: '' }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      show('الرجاء إدخال اسم الصنف', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim() || 'قطعة',
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        reorder_level: parseFloat(form.reorder_level) || 0,
        image_url: form.image_url || null,
        file_url: form.file_url || null,
      };
      if (editingItem) {
        await updateItem(editingItem.id, { ...payload, code: form.code.trim() });
        await logAudit('update', 'items', `تعديل الصنف ${form.name}`, user?.username, editingItem.id);
        show('تم تعديل الصنف بنجاح');
      } else {
        const newItem = await createItem({ ...payload, code: form.code.trim() || undefined });
        await logAudit('create', 'items', `إضافة الصنف ${form.name}`, user?.username, newItem.id);
        show('تم إضافة الصنف بنجاح');
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الحفظ';
      show(msg.includes('duplicate') || msg.includes('unique') ? 'كود الصنف مستخدم بالفعل' : 'فشل الحفظ', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.image_url) {
        deleteItemImage(deleteTarget.image_url).catch(() => {});
      }
      if (deleteTarget.file_url) {
        deleteItemImage(deleteTarget.file_url).catch(() => {});
      }
      await deleteItem(deleteTarget.id);
      await logAudit('delete', 'items', `حذف الصنف ${deleteTarget.name}`, user?.username, deleteTarget.id);
      show('تم حذف الصنف بنجاح');
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('restrict') || msg.includes('foreign key')) {
        show('لا يمكن حذف الصنف لوجود سندات مرتبطة به', 'error');
      } else {
        show('فشل حذف الصنف', 'error');
      }
      console.error(err);
    }
  };

  const showBalances = async (item: Item) => {
    setBalancesLoading(true);
    setBalancesModal({ item, balances: [] });
    try {
      const balances = await fetchItemBalancesByWarehouse(item.id);
      setBalancesModal({ item, balances });
    } catch {
      show('فشل تحميل الأرصدة', 'error');
      setBalancesModal(null);
    } finally {
      setBalancesLoading(false);
    }
  };

  const isImageFile = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  };

  const inputClass = "w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5";

  return (
    <div className="space-y-6">
      <UnitsManager item={unitsItem} onClose={() => setUnitsItem(null)} />
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">إدارة الأصناف</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">إضافة وتعديل وحذف أصناف المستودع — الكود يُولّد تلقائياً</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('items', 'edit') && <button onClick={() => { if(items.length) setUnitsItem(items[0]); else show('أضف صنفًا أولاً','error'); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 text-sm"><Ruler className="w-4 h-4"/>إدارة وحدات القياس</button>}
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors font-medium text-sm shadow-sm">
            <Printer className="w-4 h-4" />
            طباعة
          </button>
          {hasPermission('items', 'add') && (
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm">
              <Plus className="w-4 h-4" />
              إضافة صنف
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative print:hidden">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود أو الفئة..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
      </div>

      {/* Printable header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-center">قائمة الأصناف</h1>
        <p className="text-sm text-center text-gray-600">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      {/* Grid of item cards */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600 animate-pulse" />
          <p className="text-sm">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
          <p className="text-sm">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد أصناف بعد. اضغط "إضافة صنف" للبدء'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all group print:break-inside-avoid">
              {hasPermission('items', 'edit') && <button onClick={() => setUnitsItem(item)} type="button" className="absolute z-10 mt-2 mr-2 right-0 rounded-lg bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 px-2 py-1 text-xs text-blue-700 dark:text-blue-200 print:hidden">إدارة الوحدات</button>}
              {/* Image */}
              <div className="h-48 bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center relative overflow-hidden p-2">
                {item.image_url ? (
                  <>
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 cursor-zoom-in print:break-inside-avoid" onClick={() => setZoomImage(item.image_url!)} />
                    <button onClick={() => setZoomImage(item.image_url!)} className="absolute bottom-2 left-2 p-1.5 bg-white/90 dark:bg-slate-800/90 text-gray-600 dark:text-slate-300 rounded-lg shadow-sm print:hidden">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </>
                ) : item.file_url && isImageFile(item.file_url) ? (
                  <img src={item.file_url} alt={item.name} className="w-full h-full object-contain cursor-zoom-in" onClick={() => setZoomImage(item.file_url!)} />
                ) : item.file_url ? (
                  <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors">
                    <FileText className="w-12 h-12" />
                    <span className="text-xs">{item.file_url.split('/').pop()}</span>
                  </a>
                ) : (
                  <Package className="w-12 h-12 text-gray-200 dark:text-slate-600" />
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  {hasPermission('items', 'edit') && (
                    <button onClick={() => openEdit(item)} className="p-1.5 bg-white/90 dark:bg-slate-800/90 text-gray-600 dark:text-slate-300 hover:text-blue-600 rounded-lg shadow-sm transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {hasPermission('items', 'delete') && (
                    <button onClick={() => setDeleteTarget(item)} className="p-1.5 bg-white/90 dark:bg-slate-800/90 text-gray-600 dark:text-slate-300 hover:text-red-600 rounded-lg shadow-sm transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">{item.name}</h3>
                  <code className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-gray-500 dark:text-slate-400 shrink-0">{item.code}</code>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{item.unit}</span>
                  {item.category && (
                    <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-[10px]">{item.category}</span>
                  )}
                  {Number(item.reorder_level) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      حد: {item.reorder_level}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                )}
                {item.file_url && (
                  <div className="flex items-center gap-2 mt-2">
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                      <Eye className="w-3 h-3" />
                      عرض الملف
                    </a>
                    <a href={item.file_url} download className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400 hover:underline">
                      <Download className="w-3 h-3" />
                      تحميل
                    </a>
                  </div>
                )}
                <button onClick={() => showBalances(item)} className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg py-1.5 transition-colors print:hidden">
                  <Warehouse className="w-3.5 h-3.5" />
                  الكميات في المستودعات
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block mt-6 text-center text-xs text-gray-500">
        <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المستودع — {new Date().toLocaleString('ar-EG')}</p>
      </div>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in print:hidden" onClick={() => setZoomImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={zoomImage} alt="تكبير" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button onClick={() => setZoomImage(null)} className="absolute top-2 right-2 p-2 bg-white/90 text-gray-700 rounded-lg hover:bg-white shadow-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Balances Modal */}
      <Modal open={!!balancesModal} onClose={() => setBalancesModal(null)} title={`الكميات — ${balancesModal?.item.name ?? ''}`}
        footer={<button onClick={() => setBalancesModal(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm">إغلاق</button>}
      >
        <div className="py-2">
          {balancesLoading ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">جاري التحميل...</p>
          ) : balancesModal && balancesModal.balances.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400">المستودع</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {balancesModal.balances.map((b) => (
                  <tr key={b.warehouse_id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300">{b.warehouse_name}</td>
                    <td className="px-4 py-2">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${b.balance > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                        {b.balance.toLocaleString('ar')} {balancesModal.item.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">لا توجد أرصدة لهذا الصنف</p>
          )}
        </div>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'تعديل صنف' : 'إضافة صنف جديد'}
        footer={
          <>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm">إلغاء</button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {/* Image upload */}
          <div>
            <label className={labelClass}>صورة الصنف</label>
            {form.image_url ? (
              <div className="relative w-full h-44 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 group bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center p-2">
                <img src={form.image_url} alt="معاينة" className="w-full h-full object-contain" />
                <button type="button" onClick={handleRemoveImage} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
                    <Upload className="w-6 h-6 animate-pulse" />
                    <span className="text-xs">جاري الرفع...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs">اضغط لرفع صورة</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} />
              </label>
            )}
          </div>

          {/* File upload */}
          <div>
            <label className={labelClass}>ملف الصنف (اختياري — بدل الصورة)</label>
            {form.file_url ? (
              <div className="flex items-center gap-2 w-full p-3 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700/50">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-slate-300 flex-1 truncate">{form.file_name}</span>
                <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 rounded transition-colors">
                  <Eye className="w-4 h-4" />
                </a>
                <a href={form.file_url} download className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 rounded transition-colors">
                  <Download className="w-4 h-4" />
                </a>
                <button type="button" onClick={handleRemoveFile} className="p-1.5 text-red-500 hover:text-red-600 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
                {uploadingFile ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
                    <Upload className="w-6 h-6 animate-pulse" />
                    <span className="text-xs">جاري الرفع...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
                    <FileText className="w-6 h-6" />
                    <span className="text-xs">اضغط لرفع ملف (PDF, DOCX, ...)</span>
                  </div>
                )}
                <input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} />
              </label>
            )}
          </div>

          <div>
            <label className={labelClass}>اسم الصنف <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: جهاز كمبيوتر" className={inputClass} />
          </div>

          {editingItem && (
            <div>
              <label className={labelClass}>كود الصنف</label>
              <input type="text" value={form.code} readOnly className={`${inputClass} bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400`} />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">يُولّد تلقائياً عند الإضافة</p>
            </div>
          )}
          {!editingItem && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-600 dark:text-blue-300">سيتم توليد كود الصنف تلقائياً عند الحفظ</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>الوحدة</label>
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="قطعة" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>الفئة</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="مثال: إلكترونيات" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>حد إعادة الطلب</label>
            <input type="number" step="0.001" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="0" className={inputClass} />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">عند وصول الرصيد إلى هذا الحد أو أقل، يظهر تنبيه بنفاذ الكمية</p>
          </div>
          <div>
            <label className={labelClass}>الوصف</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف اختياري للصنف..." rows={3} className={`${inputClass} resize-none`} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="حذف الصنف" message={`هل أنت متأكد من حذف الصنف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`} />
    </div>
  );
}
