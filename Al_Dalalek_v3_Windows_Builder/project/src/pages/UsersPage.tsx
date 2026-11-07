import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Shield, Power, Lock, Users } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, resetUserPassword, fetchUserPermissions, updateUserPermission, createUserPermissions, logAudit, ensureTransactionTypePermissions, updateTransactionTypePermission, describeDatabaseError } from '@/lib/database';
import type { AppUser, UserPermission, PermissionModule, TransactionTypePermission, TransactionType } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

type FormData = { username: string; full_name: string; password: string; role: 'admin' | 'user' };
const emptyForm: FormData = { username: '', full_name: '', password: '', role: 'user' };

const permissionLabels: Record<PermissionModule, string> = {
  items: 'الأصناف',
  warehouses: 'المستودعات',
  departments: 'الأقسام',
  transactions: 'السندات',
  transfers: 'التحويل المخزني',
  balances: 'الأرصدة',
  reports: 'التقارير',
  users: 'المستخدمون',
  settings: 'الإعدادات',
  audit_log: 'سجل التدقيق',
};

const allModules = Object.keys(permissionLabels) as PermissionModule[];
const transactionTypeLabels: Record<TransactionType, string> = {
  receipt: 'سند إدخال',
  issue: 'سند صرف',
  return: 'سند استرجاع',
  transfer_wh: 'سند تحويل بين المستودعات',
  transfer_dept: 'سند تحويل بين الأقسام',
};
const permissionActions = [
  { key: 'can_view', label: 'عرض' },
  { key: 'can_add', label: 'إضافة' },
  { key: 'can_edit', label: 'تعديل' },
  { key: 'can_delete', label: 'حذف' },
  { key: 'can_print', label: 'طباعة' },
  { key: 'can_approve', label: 'اعتماد' },
  { key: 'can_cancel', label: 'إلغاء' },
  { key: 'can_export', label: 'تصدير' },
] as const;

const transactionPermissionActions = [
  { key: 'can_view', label: 'عرض' },
  { key: 'can_add', label: 'إضافة' },
  { key: 'can_edit', label: 'تعديل' },
  { key: 'can_delete', label: 'حذف' },
  { key: 'can_print', label: 'طباعة' },
] as const;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { show } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [permsTarget, setPermsTarget] = useState<AppUser | null>(null);
  const [perms, setPerms] = useState<UserPermission[]>([]);
  const [transactionPerms, setTransactionPerms] = useState<TransactionTypePermission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setUsers(await fetchUsers());
    } catch {
      show('فشل تحميل المستخدمين', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ username: u.username, full_name: u.full_name, password: '', role: u.role });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.full_name.trim()) {
      show('الرجاء إدخال جميع البيانات', 'error');
      return;
    }
    if (!editing && !form.password.trim()) {
      show('الرجاء إدخال كلمة المرور', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, { full_name: form.full_name.trim(), role: form.role });
        await logAudit('update', 'users', `تعديل المستخدم ${editing.username}`, currentUser?.username, editing.id);
        show('تم تعديل المستخدم بنجاح');
      } else {
        const newUser = await createUser(form.username.trim(), form.full_name.trim(), form.password, form.role);
        for (const module of allModules) {
          await createUserPermissions(newUser.id, module);
        }
        if (form.role === 'admin') {
          const userPerms = await fetchUserPermissions(newUser.id);
          for (const p of userPerms) {
            await updateUserPermission(p.id, { can_view: true, can_add: true, can_edit: true, can_delete: true, can_print: true, can_approve: true, can_cancel: true, can_export: true });
          }
        }
        await logAudit('create', 'users', `إضافة مستخدم ${form.username}`, currentUser?.username, newUser.id);
        show('تم إضافة المستخدم بنجاح');
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      show(describeDatabaseError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      show('لا يمكن حذف حسابك الحالي', 'error');
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteUser(deleteTarget.id);
      await logAudit('delete', 'users', `حذف المستخدم ${deleteTarget.username}`, currentUser?.username, deleteTarget.id);
      show('تم حذف المستخدم بنجاح');
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      show(describeDatabaseError(err), 'error');
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      await logAudit(u.is_active ? 'deactivate' : 'activate', 'users', `${u.is_active ? 'تعطيل' : 'تفعيل'} المستخدم ${u.username}`, currentUser?.username, u.id);
      show(u.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
      await load();
    } catch (err: unknown) {
      show(describeDatabaseError(err), 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!passwordTarget || !newPassword.trim()) {
      show('الرجاء إدخال كلمة المرور الجديدة', 'error');
      return;
    }
    try {
      await resetUserPassword(passwordTarget.id, newPassword);
      await logAudit('reset_password', 'users', `إعادة تعيين كلمة مرور ${passwordTarget.username}`, currentUser?.username, passwordTarget.id);
      show('تم تغيير كلمة المرور بنجاح');
      setPasswordTarget(null);
      setNewPassword('');
    } catch (err: unknown) {
      show(describeDatabaseError(err), 'error');
    }
  };

  const openPerms = async (u: AppUser) => {
    setPermsTarget(u);
    setPermsLoading(true);
    try {
      let userPerms = await fetchUserPermissions(u.id);
      if (userPerms.length === 0) {
        for (const module of allModules) {
          await createUserPermissions(u.id, module);
        }
        userPerms = await fetchUserPermissions(u.id);
      }
      const userTransactionPerms = await ensureTransactionTypePermissions(u.id);
      setPerms(userPerms);
      setTransactionPerms(userTransactionPerms);
    } catch {
      show('فشل تحميل الصلاحيات', 'error');
    } finally {
      setPermsLoading(false);
    }
  };

  const togglePerm = async (perm: UserPermission, actionKey: keyof UserPermission) => {
    const updates = { [actionKey]: !perm[actionKey] } as Partial<Omit<UserPermission, 'id' | 'user_id' | 'module' | 'created_at'>>;
    try {
      await updateUserPermission(perm.id, updates);
    } catch (err: unknown) {
      show(describeDatabaseError(err), 'error');
      return;
    }
    setPerms(perms.map((p) => p.id === perm.id ? { ...p, ...updates } : p));
  };

  const toggleTransactionPerm = async (perm: TransactionTypePermission, actionKey: keyof TransactionTypePermission) => {
    const updates = { [actionKey]: !perm[actionKey] } as Partial<Pick<TransactionTypePermission, 'can_view' | 'can_add' | 'can_edit' | 'can_delete' | 'can_print'>>;
    try {
      await updateTransactionTypePermission(perm.id, updates);
    } catch (err: unknown) {
      show(describeDatabaseError(err), 'error');
      return;
    }
    setTransactionPerms(transactionPerms.map((p) => p.id === perm.id ? { ...p, ...updates } : p));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">المستخدمون</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">إدارة الحسابات والصلاحيات</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          إضافة مستخدم
        </button>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-6 py-12 text-center text-gray-400 dark:text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600 animate-pulse" />
          <p className="text-sm">جاري التحميل...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">#</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الاسم</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">اسم المستخدم</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الدور</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {users.map((u, idx) => (
                <tr key={u.id} className="table-row transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-400 dark:text-slate-500">{idx + 1}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">{u.full_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-slate-300 font-mono">{u.username}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                      {u.role === 'admin' && <Shield className="w-3 h-3" />}
                      {u.role === 'admin' ? 'مدير النظام' : 'مستخدم'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.is_active ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                      {u.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="تعديل">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setPasswordTarget(u)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="تغيير كلمة المرور">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => openPerms(u)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="الصلاحيات">
                        <Lock className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleActive(u)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title={u.is_active ? 'تعطيل' : 'تفعيل'}>
                        <Power className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
        footer={
          <>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors font-medium text-sm disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm">إلغاء</button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">الاسم الكامل <span className="text-red-500">*</span></label>
            <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="الاسم الكامل"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">اسم المستخدم <span className="text-red-500">*</span></label>
            <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" disabled={!!editing}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">كلمة المرور {editing ? '(اتركها فارغة)' : <span className="text-red-500">*</span>}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">الدور</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setForm({ ...form, role: 'admin' })} className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${form.role === 'admin' ? 'border-slate-400 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                مدير النظام
              </button>
              <button onClick={() => setForm({ ...form, role: 'user' })} className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${form.role === 'user' ? 'border-slate-400 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                مستخدم
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Password Reset Modal */}
      <Modal open={!!passwordTarget} onClose={() => { setPasswordTarget(null); setNewPassword(''); }} title={`تغيير كلمة المرور — ${passwordTarget?.username ?? ''}`}
        footer={
          <>
            <button onClick={handleResetPassword} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm">تغيير</button>
            <button onClick={() => { setPasswordTarget(null); setNewPassword(''); }} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm">إلغاء</button>
          </>
        }
      >
        <div className="py-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">كلمة المرور الجديدة</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoFocus
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 text-sm bg-white dark:bg-slate-700 dark:text-slate-100" />
        </div>
      </Modal>

      {/* Permissions Modal */}
      <Modal open={!!permsTarget} onClose={() => setPermsTarget(null)} title={`الصلاحيات — ${permsTarget?.full_name ?? ''}`}
        footer={
          <button onClick={() => setPermsTarget(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm">إغلاق</button>
        }
      >
        <div className="py-2">
          {permsLoading ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">جاري التحميل...</p>
          ) : permsTarget?.role === 'admin' ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center py-4">مدير النظام لديه جميع الصلاحيات تلقائياً</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400">الوحدة</th>
                    {permissionActions.map((a) => (
                      <th key={a.key} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 dark:text-slate-400">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                  {allModules.map((module) => {
                    const perm = perms.find((p) => p.module === module);
                    if (!perm) return null;
                    return (
                      <tr key={module}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300">{permissionLabels[module]}</td>
                        {permissionActions.map((a) => (
                          <td key={a.key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(perm[a.key])}
                              onChange={() => togglePerm(perm, a.key)}
                              className="w-4 h-4 rounded accent-slate-700 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-700">
                <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-3">صلاحيات أنواع السندات</h3>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400">نوع السند</th>
                      {transactionPermissionActions.map((a) => (
                        <th key={a.key} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 dark:text-slate-400">{a.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                    {(['receipt', 'issue', 'return', 'transfer_wh', 'transfer_dept'] as TransactionType[]).map((type) => {
                      const permission = transactionPerms.find((p) => p.transaction_type === type);
                      if (!permission) return null;
                      return (
                        <tr key={type}>
                          <td className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300">{transactionTypeLabels[type]}</td>
                          {transactionPermissionActions.map((a) => (
                            <td key={a.key} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(permission[a.key])}
                                onChange={() => toggleTransactionPerm(permission, a.key)}
                                className="w-4 h-4 rounded accent-slate-700 cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="حذف مستخدم" message={`هل أنت متأكد من حذف المستخدم "${deleteTarget?.username}"؟`} />
    </div>
  );
}
