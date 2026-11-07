import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { AppUser, UserPermission, PermissionModule, TransactionType, TransactionTypePermission } from './supabase';
import { ensureTransactionTypePermissions } from './database';

type AuthContextValue = {
  user: AppUser | null;
  permissions: UserPermission[];
  transactionTypePermissions: TransactionTypePermission[];
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (module: PermissionModule, action: 'view' | 'add' | 'edit' | 'delete' | 'print' | 'approve' | 'cancel' | 'export') => boolean;
  hasTransactionTypePermission: (transactionType: TransactionType, action: 'view' | 'add' | 'edit' | 'delete' | 'print') => boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [transactionTypePermissions, setTransactionTypePermissions] = useState<TransactionTypePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    const { data: permData } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId);
    setPermissions(permData ?? []);
    try {
      setTransactionTypePermissions(await ensureTransactionTypePermissions(userId));
    } catch {
      setTransactionTypePermissions([]);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('warehouse_auth_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser;
        const safeUser = { ...parsed, password_hash: '' };
        setUser(safeUser);
        localStorage.setItem('warehouse_auth_user', JSON.stringify(safeUser));
        loadUserData(parsed.id).catch(() => {});
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !data) return false;

    const user = data as AppUser;
    if (!user.is_active) return false;

    const { data: validData, error: validError } = await supabase
      .rpc('verify_password', {
        input_password: password,
        stored_hash: user.password_hash,
      });

    if (validError || !validData) return false;

    const safeUser = { ...user, password_hash: '' };
    setUser(safeUser);
    localStorage.setItem('warehouse_auth_user', JSON.stringify(safeUser));
    await loadUserData(user.id);
    return true;
  };

  const logout = () => {
    setUser(null);
    setPermissions([]);
    setTransactionTypePermissions([]);
    localStorage.removeItem('warehouse_auth_user');
  };

  const refreshUser = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      const safeUser = { ...(data as AppUser), password_hash: '' };
      setUser(safeUser);
      localStorage.setItem('warehouse_auth_user', JSON.stringify(safeUser));
      await loadUserData(data.id);
    }
  };

  const hasPermission = (module: PermissionModule, action: 'view' | 'add' | 'edit' | 'delete' | 'print' | 'approve' | 'cancel' | 'export'): boolean => {
    if (user?.role === 'admin') return true;
    const perm = permissions.find((p) => p.module === module);
    if (!perm) return false;
    const key = `can_${action}` as keyof UserPermission;
    return Boolean(perm[key]);
  };

  const hasTransactionTypePermission = (transactionType: TransactionType, action: 'view' | 'add' | 'edit' | 'delete' | 'print'): boolean => {
    if (user?.role === 'admin') return true;
    const permission = transactionTypePermissions.find((p) => p.transaction_type === transactionType);
    if (!permission) return false;
    return Boolean(permission[`can_${action}` as keyof TransactionTypePermission]);
  };

  return (
    <AuthContext.Provider value={{ user, permissions, transactionTypePermissions, loading, login, logout, hasPermission, hasTransactionTypePermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
