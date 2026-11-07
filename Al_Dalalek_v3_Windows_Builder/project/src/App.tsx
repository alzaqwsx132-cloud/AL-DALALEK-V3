import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, Warehouse, Building2, FileText, Scale, Menu, X, Boxes, AlertTriangle, Moon, Sun, LogOut, Users, ScrollText, Shield } from 'lucide-react';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fetchLowStockAlerts } from '@/lib/database';
import { selectedAlertWarehouse, ALERT_SETTINGS_CHANGED } from '@/lib/stock-alerts';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';
import ItemsPage from '@/pages/ItemsPage';
import WarehousesPage from '@/pages/WarehousesPage';
import DepartmentsPage from '@/pages/DepartmentsPage';
import TransactionsPage from '@/pages/TransactionsPage';
import BalancesPage from '@/pages/BalancesPage';
import DepartmentStatementPage from '@/pages/DepartmentStatementPage';
import UsersPage from '@/pages/UsersPage';
import AuditLogPage from '@/pages/AuditLogPage';
import { VoucherProvider } from '@/components/VoucherViewer';
import GlobalSearch from '@/components/GlobalSearch';
import type { PermissionModule, TransactionType } from '@/lib/supabase';

type Page = 'dashboard' | 'items' | 'warehouses' | 'departments' | 'transactions' | 'balances' | 'dept-statement' | 'users' | 'audit-log';

const navItems: { key: Page; label: string; icon: typeof Package; module: PermissionModule; action: 'view' }[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, module: 'items', action: 'view' },
  { key: 'items', label: 'الأصناف', icon: Package, module: 'items', action: 'view' },
  { key: 'warehouses', label: 'المستودعات', icon: Warehouse, module: 'warehouses', action: 'view' },
  { key: 'departments', label: 'الأقسام', icon: Building2, module: 'departments', action: 'view' },
  { key: 'transactions', label: 'السندات', icon: FileText, module: 'transactions', action: 'view' },
  { key: 'balances', label: 'الأرصدة', icon: Scale, module: 'balances', action: 'view' },
];

const adminNavItems: { key: Page; label: string; icon: typeof Users; module: PermissionModule; action: 'view' }[] = [
  { key: 'users', label: 'المستخدمون', icon: Users, module: 'users', action: 'view' },
  { key: 'audit-log', label: 'سجل التدقيق', icon: ScrollText, module: 'audit_log', action: 'view' },
];

function AppContent() {
  const { theme, toggle } = useTheme();
  const { user, loading, logout, hasPermission, hasTransactionTypePermission } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [statementDeptId, setStatementDeptId] = useState('');
  const [statementDeptName, setStatementDeptName] = useState('');

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const loadAlerts = async () => {
      try {
        const alerts = await fetchLowStockAlerts(selectedAlertWarehouse());
        if (mounted) setAlertCount(alerts.length);
      } catch {
        if (mounted) setAlertCount(0);
      }
    };
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    window.addEventListener(ALERT_SETTINGS_CHANGED, loadAlerts);
    return () => { mounted = false; clearInterval(interval); window.removeEventListener(ALERT_SETTINGS_CHANGED, loadAlerts); };
  }, [user]);

  const navigate = (p: string) => {
    setPage(p as Page);
    setSidebarOpen(false);
  };

  const openStatement = (deptId: string, deptName: string) => {
    setStatementDeptId(deptId);
    setStatementDeptName(deptName);
    setPage('dept-statement');
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Boxes className="w-12 h-12 text-gray-300 dark:text-slate-600 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const transactionTypes: TransactionType[] = ['receipt', 'issue', 'return', 'transfer_wh', 'transfer_dept'];
  const canViewTransactions = hasPermission('transactions', 'view') || transactionTypes.some((type) => hasTransactionTypePermission(type, 'view'));
  const visibleNav = navItems.filter((item) => item.key === 'transactions' ? canViewTransactions : hasPermission(item.module, item.action));
  const visibleAdminNav = adminNavItems.filter((item) => hasPermission(item.module, item.action));

  const allNav = [...visibleNav, ...visibleAdminNav];
  const currentPageLabel = page === 'dept-statement'
    ? 'كشف حساب قسم'
    : allNav.find((n) => n.key === page)?.label ?? '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-30 w-64 bg-white dark:bg-slate-800 border-l border-gray-100 dark:border-slate-700 flex flex-col transition-transform duration-300 print:hidden ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-700 flex items-center justify-center">
            <Boxes className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 dark:text-slate-100 text-sm">نظام الدلالك</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500">إدارة المخزون</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
                {item.key === 'dashboard' && alertCount > 0 && (
                  <span className="mr-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    <AlertTriangle className="w-3 h-3" />
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}

          {visibleAdminNav.length > 0 && (
            <>
              <div className="pt-4 pb-2 px-3">
                <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase">الإدارة</span>
              </div>
              {visibleAdminNav.map((item) => {
                const Icon = item.icon;
                const active = page === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        {/* User info + logout */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              {user.role === 'admin' ? <Shield className="w-4 h-4 text-slate-600 dark:text-slate-300" /> : <Users className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{user.role === 'admin' ? 'مدير النظام' : 'مستخدم'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden print:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <span className="text-gray-300 dark:text-slate-600">الصفحة الحالية:</span>
            <span className="font-medium text-gray-700 dark:text-slate-200">{currentPageLabel}</span>
          </div>
          <GlobalSearch onNavigate={navigate} />
          <button
            onClick={toggle}
            className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title={theme === 'light' ? 'المظهر الداكن' : 'المظهر الفاتح'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {page === 'items' && <ItemsPage />}
          {page === 'warehouses' && <WarehousesPage />}
          {page === 'departments' && <DepartmentsPage onOpenStatement={openStatement} />}
          {page === 'transactions' && <TransactionsPage />}
          {page === 'balances' && <BalancesPage />}
          {page === 'dept-statement' && (
            <DepartmentStatementPage
              departmentId={statementDeptId}
              departmentName={statementDeptName}
              onBack={() => navigate('departments')}
            />
          )}
          {page === 'users' && <UsersPage />}
          {page === 'audit-log' && <AuditLogPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <VoucherProvider><AppContent /></VoucherProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
