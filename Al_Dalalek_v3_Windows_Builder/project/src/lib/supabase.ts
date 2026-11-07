import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  created_at: string;
};

export type Department = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type Item = {
  id: string;
  name: string;
  code: string;
  unit: string;
  category: string | null;
  description: string | null;
  reorder_level: number;
  image_url: string | null;
  file_url: string | null;
  created_at: string;
};

export type DepartmentStatement = {
  id: string;
  voucher_id?: string | null;
  movement_direction?: 'incoming' | 'outgoing';
  transaction_number: string;
  transaction_type: TransactionType;
  item_name: string;
  item_code: string;
  item_unit: string;
  warehouse_name: string;
  quantity: number;
  date: string;
  notes: string | null;
  balance_after: number;
};

export type LowStockAlert = {
  item_id: string;
  item_name: string;
  item_code: string;
  item_unit: string;
  reorder_level: number;
  total_balance: number;
  warehouse_count: number;
};

export type TransactionType = 'receipt' | 'issue' | 'return' | 'transfer_wh' | 'transfer_dept';

export type Transaction = {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  voucher_id?: string | null;
  to_department_id?: string | null;
  item_id: string;
  warehouse_id: string;
  department_id: string | null;
  to_warehouse_id: string | null;
  quantity: number;
  date: string;
  notes: string | null;
  created_at: string;
  // Joined fields
  items?: Pick<Item, 'name' | 'code' | 'unit'>;
  warehouses?: Pick<Warehouse, 'name' | 'code'>;
  departments?: Pick<Department, 'name' | 'code'> | null;
  to_warehouses?: Pick<Warehouse, 'name' | 'code'> | null;
  to_departments?: Pick<Department, 'name' | 'code'> | null;
};

export type BalanceRow = {
  item_id: string;
  item_name: string;
  item_code: string;
  item_unit: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_code: string;
  balance: number;
};

export type AppUser = {
  id: string;
  username: string;
  full_name: string;
  password_hash: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PermissionModule = 'items' | 'warehouses' | 'departments' | 'transactions' | 'transfers' | 'balances' | 'reports' | 'users' | 'settings' | 'audit_log';

export type UserPermission = {
  id: string;
  user_id: string;
  module: PermissionModule;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_print: boolean;
  can_approve: boolean;
  can_cancel: boolean;
  can_export: boolean;
};

export type TransactionTypePermission = {
  id: string;
  user_id: string;
  transaction_type: TransactionType;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_print: boolean;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  user_name: string | null;
  action: string;
  module: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
};
