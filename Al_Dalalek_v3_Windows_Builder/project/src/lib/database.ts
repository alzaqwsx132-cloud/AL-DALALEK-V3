import { supabase } from './supabase';
import { alertsForWarehouse } from './stock-alerts';
import type { Warehouse, Department, Item, Transaction, TransactionType, BalanceRow, LowStockAlert, DepartmentStatement, AppUser, UserPermission, PermissionModule, AuditLogEntry, TransactionTypePermission } from './supabase';

export function describeDatabaseError(error: unknown): string {
  console.error('Database operation failed:', error);
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const message = (err?.message ?? '').toLowerCase();
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'ليس لديك صلاحية تنفيذ هذه العملية';
  }
  if (code === '23505' || message.includes('duplicate key')) return 'البيانات مكررة ولا يمكن حفظها مرة أخرى';
  if (code === '23503') return 'تعذر الحفظ لارتباط البيانات بسجلات أخرى';
  if (code === '23514' || message.includes('violates check constraint')) return 'إحدى القيم المدخلة غير مسموح بها';
  if (code === 'P0001' && err?.message) return err.message;
  if (message.includes('jwt') || code === 'PGRST301') return 'انتهت جلسة تسجيل الدخول';
  return 'تعذر الحفظ بسبب مشكلة في قاعدة البيانات';
}

// ---- Warehouses ----

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const rows: Warehouse[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('warehouses')
      .select('*').order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Warehouse[]));
    if ((data ?? []).length < pageSize) return rows;
  }
}

export async function createWarehouse(w: Omit<Warehouse, 'id' | 'created_at' | 'code'> & { code?: string }): Promise<Warehouse> {
  const { data, error } = await supabase
    .from('warehouses')
    .insert({
      ...w,
      code: w.code || undefined,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWarehouse(id: string, updates: Partial<Omit<Warehouse, 'id' | 'created_at'>>): Promise<Warehouse> {
  const { data, error } = await supabase
    .from('warehouses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWarehouse(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Departments ----

export async function fetchDepartments(): Promise<Department[]> {
  const rows: Department[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('departments')
      .select('*').order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Department[]));
    if ((data ?? []).length < pageSize) return rows;
  }
}

export async function createDepartment(d: Omit<Department, 'id' | 'created_at' | 'code'> & { code?: string }): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .insert({
      ...d,
      code: d.code || undefined,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id: string, updates: Partial<Omit<Department, 'id' | 'created_at'>>): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Items ----

export async function fetchItems(): Promise<Item[]> {
  const rows: Item[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('items')
      .select('*').order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Item[]));
    if ((data ?? []).length < pageSize) return rows;
  }
}

export async function createItem(item: Omit<Item, 'id' | 'created_at' | 'code'> & { code?: string }): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      ...item,
      code: item.code || undefined,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(id: string, updates: Partial<Omit<Item, 'id' | 'created_at'>>): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Transactions ----

/** Get every row rather than silently truncating at Supabase's default 1,000-row limit. */
export async function fetchTransactions(): Promise<Transaction[]> {
  const result: Transaction[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        items:transactions_item_id_fkey(name, code, unit),
        warehouses:transactions_warehouse_id_fkey(name, code),
        departments:transactions_department_id_fkey(name, code),
        to_warehouses:transactions_to_warehouse_id_fkey(name, code)
      `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as Transaction[];
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

export type VoucherLineInput = {
  unitName?: string;
  enteredQuantity?: number;
  itemId: string;
  warehouseId?: string | null;
  toWarehouseId?: string | null;
  departmentId?: string | null;
  toDepartmentId?: string | null;
  quantity: number;
  notes: string | null;
};

export async function createVoucher(v: {
  userId: string;
  requestId: string;
  transactionType: TransactionType;
  warehouseId: string | null;
  toWarehouseId: string | null;
  departmentId: string | null;
  toDepartmentId: string | null;
  date: string;
  notes: string | null;
  lines: VoucherLineInput[];
  useUnitSnapshots?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc(v.useUnitSnapshots ? 'create_voucher_with_units' : 'create_voucher', {
    p_user_id: v.userId,
    p_request_id: v.requestId,
    p_voucher_type: v.transactionType,
    p_voucher_date: v.date,
    p_warehouse_id: v.warehouseId,
    p_to_warehouse_id: v.toWarehouseId,
    p_department_id: v.departmentId,
    p_to_department_id: v.toDepartmentId,
    p_notes: v.notes,
    p_lines: v.lines.map((line) => ({
      item_id: line.itemId,
      warehouse_id: line.warehouseId ?? null,
      to_warehouse_id: line.toWarehouseId ?? null,
      department_id: line.departmentId ?? null,
      to_department_id: line.toDepartmentId ?? null,
      quantity: line.quantity,
      ...(v.useUnitSnapshots ? { unit_name: line.unitName, entered_quantity: line.enteredQuantity } : {}),
      notes: line.notes,
    })),
    p_approve: true,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Unexpected create_voucher response');
  return data;
}

export async function updateTransaction(
  id: string,
  updates: Partial<{
    transaction_type: TransactionType;
    item_id: string;
    warehouse_id: string;
    department_id: string | null;
    to_warehouse_id: string | null;
    quantity: number;
    date: string;
    notes: string | null;
  }>
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Balances ----

export async function fetchBalances(): Promise<BalanceRow[]> {
  const transactions = await fetchTransactions();

  const balanceMap = new Map<string, BalanceRow>();

  for (const t of transactions) {
    if (!t.warehouse_id || t.transaction_type === 'transfer_dept') continue;
    const item = t.items;
    const warehouse = t.warehouses;
    if (!item || !warehouse) continue;

    const key = `${t.item_id}-${t.warehouse_id}`;
    if (!balanceMap.has(key)) {
      balanceMap.set(key, {
        item_id: t.item_id,
        item_name: item.name,
        item_code: item.code,
        item_unit: item.unit,
        warehouse_id: t.warehouse_id,
        warehouse_name: warehouse.name,
        warehouse_code: warehouse.code,
        balance: 0,
      });
    }
    const row = balanceMap.get(key)!;
    if (t.transaction_type === 'receipt') row.balance += Number(t.quantity);
    else if (t.transaction_type === 'issue') row.balance -= Number(t.quantity);
    else if (t.transaction_type === 'return') row.balance += Number(t.quantity);
    else if (t.transaction_type === 'transfer_wh') {
      row.balance -= Number(t.quantity);
      const toKey = `${t.item_id}-${t.to_warehouse_id}`;
      if (t.to_warehouse_id && !balanceMap.has(toKey)) {
        balanceMap.set(toKey, {
          item_id: t.item_id,
          item_name: item.name,
          item_code: item.code,
          item_unit: item.unit,
          warehouse_id: t.to_warehouse_id,
          warehouse_name: '',
          warehouse_code: '',
          balance: 0,
        });
      }
      if (t.to_warehouse_id) balanceMap.get(toKey)!.balance += Number(t.quantity);
    }
  }

  // Fill in warehouse names for return destinations
  const warehouses = await fetchWarehouses();
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
  for (const row of balanceMap.values()) {
    if (!row.warehouse_name && warehouseMap.has(row.warehouse_id)) {
      const w = warehouseMap.get(row.warehouse_id)!;
      row.warehouse_name = w.name;
      row.warehouse_code = w.code;
    }
  }

  return Array.from(balanceMap.values()).filter((r) => r.balance !== 0);
}

export async function fetchDepartmentBalances(): Promise<{ department_id: string; department_name: string; department_code: string; item_id: string; item_name: string; item_code: string; item_unit: string; balance: number }[]> {
  const data = (await fetchTransactions()).filter((t) => t.department_id || t.to_department_id);

  const departments = await fetchDepartments();
  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  const balanceMap = new Map<string, { department_id: string; department_name: string; department_code: string; item_id: string; item_name: string; item_code: string; item_unit: string; balance: number }>();

  for (const t of data) {
    const item = t.items;
    const dept = t.departments;
    if (!item || !t.department_id || !dept) continue;

    const key = `${t.department_id}-${t.item_id}`;
    if (!balanceMap.has(key)) {
      balanceMap.set(key, {
        department_id: t.department_id,
        department_name: dept.name,
        department_code: dept.code,
        item_id: t.item_id,
        item_name: item.name,
        item_code: item.code,
        item_unit: item.unit,
        balance: 0,
      });
    }
    const row = balanceMap.get(key)!;
    if (t.transaction_type === 'issue') row.balance += Number(t.quantity);
    else if (t.transaction_type === 'return') row.balance -= Number(t.quantity);
    else if (t.transaction_type === 'transfer_dept') {
      row.balance -= Number(t.quantity);
      if (t.to_department_id) {
        const destinationKey = `${t.to_department_id}-${t.item_id}`;
        if (!balanceMap.has(destinationKey)) {
          const destinationDepartment = departmentMap.get(t.to_department_id);
          balanceMap.set(destinationKey, {
            department_id: t.to_department_id,
            department_name: destinationDepartment?.name ?? '—',
            department_code: destinationDepartment?.code ?? '',
            item_id: t.item_id,
            item_name: item.name,
            item_code: item.code,
            item_unit: item.unit,
            balance: 0,
          });
        }
        balanceMap.get(destinationKey)!.balance += Number(t.quantity);
      }
    }
  }

  return Array.from(balanceMap.values()).filter((r) => r.balance > 0);
}

// ---- Low Stock Alerts ----

export async function fetchLowStockAlerts(warehouseId: string): Promise<LowStockAlert[]> {
  if (!warehouseId) return []; // Never sum balances across warehouses for an alert.
  const [items, balances] = await Promise.all([fetchItems(), fetchBalances()]);
  return alertsForWarehouse(items, balances, warehouseId);
}

// ---- Item Image Upload ----

export async function uploadItemImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('item-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('item-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function deleteItemImage(url: string): Promise<void> {
  const path = url.split('/item-images/').pop();
  if (!path) return;
  await supabase.storage.from('item-images').remove([path]);
}

// ---- Department Statement (كشف حساب القسم) ----

export async function fetchDepartmentStatement(departmentId: string): Promise<DepartmentStatement[]> {
  // Include both source and destination departments: one transfer appears as an
  // outflow for its source and an inflow for its destination.
  const pages: unknown[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, voucher_id, transaction_number, transaction_type,
      item_id, warehouse_id, department_id, to_department_id,
      quantity, date, notes, created_at,
      items:transactions_item_id_fkey(name, code, unit),
      warehouses:transactions_warehouse_id_fkey(name, code)
    `)
    .or(`department_id.eq.${departmentId},to_department_id.eq.${departmentId}`)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1);
    if (error) throw error;
    pages.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  type StatementTransaction = {
    id: string; voucher_id: string | null; transaction_number: string;
    transaction_type: TransactionType; item_id: string; warehouse_id: string | null;
    department_id: string | null; to_department_id: string | null;
    quantity: number; date: string; notes: string | null;
    items: { name: string; code: string; unit: string } | null;
    warehouses: { name: string } | null;
  };
  const balanceByItem = new Map<string, number>();
  const statements: DepartmentStatement[] = [];
  for (const row of pages as StatementTransaction[]) {
    const qty = Number(row.quantity);
    let delta = 0;
    if (row.transaction_type === 'issue' && row.department_id === departmentId) delta = qty;
    if (row.transaction_type === 'return' && row.department_id === departmentId) delta = -qty;
    if (row.transaction_type === 'transfer_dept') {
      if (row.department_id === departmentId) delta -= qty;
      if (row.to_department_id === departmentId) delta += qty;
    }
    if (delta === 0) continue;
    const balance = (balanceByItem.get(row.item_id) ?? 0) + delta;
    balanceByItem.set(row.item_id, balance);
    statements.push({
      id: row.id,
      voucher_id: row.voucher_id,
      movement_direction: row.transaction_type === 'transfer_dept' && row.to_department_id === departmentId ? 'incoming' : 'outgoing',
      transaction_number: row.transaction_number,
      transaction_type: row.transaction_type,
      item_name: row.items?.name ?? '—',
      item_code: row.items?.code ?? '',
      item_unit: row.items?.unit ?? '',
      warehouse_name: row.warehouses?.name ?? '—',
      quantity: qty,
      date: row.date,
      notes: row.notes,
      balance_after: balance,
    });
  }
  return statements;
}

// ---- Users ----

export async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createUser(username: string, fullName: string, password: string, role: 'admin' | 'user'): Promise<AppUser> {
  const { data: hashData, error: hashError } = await supabase
    .rpc('hash_password', { input_password: password });
  if (hashError) throw hashError;

  const { data, error } = await supabase
    .from('app_users')
    .insert({
      username,
      full_name: fullName,
      password_hash: hashData,
      role,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUser(id: string, updates: Partial<Pick<AppUser, 'full_name' | 'role' | 'is_active'>>): Promise<AppUser> {
  const { data, error } = await supabase
    .from('app_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('app_users')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const { data: hashData, error: hashError } = await supabase
    .rpc('hash_password', { input_password: newPassword });
  if (hashError) throw hashError;

  const { error } = await supabase
    .from('app_users')
    .update({ password_hash: hashData, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---- Permissions ----

export async function fetchUserPermissions(userId: string): Promise<UserPermission[]> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function updateUserPermission(id: string, updates: Partial<Omit<UserPermission, 'id' | 'user_id' | 'module' | 'created_at'>>): Promise<void> {
  const { error } = await supabase
    .from('user_permissions')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function createUserPermissions(userId: string, module: PermissionModule): Promise<void> {
  const { error } = await supabase
    .from('user_permissions')
    .insert({ user_id: userId, module });
  if (error) throw error;
}

// ---- Audit Log ----

export async function fetchAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function logAudit(action: string, module: string, description: string, userName?: string, recordId?: string, oldData?: Record<string, unknown>, newData?: Record<string, unknown>): Promise<void> {
  await supabase.from('audit_log').insert({
    user_name: userName ?? null,
    action,
    module,
    record_id: recordId ?? null,
    old_data: oldData ?? null,
    new_data: newData ?? null,
    description,
  });
}

// ---- Item File Upload ----

export async function uploadItemFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('item-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('item-images').getPublicUrl(fileName);
  return data.publicUrl;
}

// ---- Item Balances (quantities per warehouse) ----

export async function fetchItemBalancesByWarehouse(itemId: string): Promise<{ warehouse_id: string; warehouse_name: string; warehouse_code: string; balance: number }[]> {
  const balances = await fetchBalances();
  return balances
    .filter((b) => b.item_id === itemId)
    .map((b) => ({
      warehouse_id: b.warehouse_id,
      warehouse_name: b.warehouse_name,
      warehouse_code: b.warehouse_code,
      balance: b.balance,
    }));
}

// ---- Transaction Type Permissions ----

export async function fetchTransactionTypePermissions(userId: string): Promise<TransactionTypePermission[]> {
  const { data, error } = await supabase
    .from('transaction_type_permissions')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_type');
  if (error) throw error;
  return data ?? [];
}

export async function ensureTransactionTypePermissions(userId: string): Promise<TransactionTypePermission[]> {
  const existing = await fetchTransactionTypePermissions(userId);
  const types: TransactionType[] = ['receipt', 'issue', 'return', 'transfer_wh', 'transfer_dept'];
  const missing = types.filter((type) => !existing.some((permission) => permission.transaction_type === type));
  if (missing.length > 0) {
    const { error } = await supabase
      .from('transaction_type_permissions')
      .insert(missing.map((transaction_type) => ({ user_id: userId, transaction_type })));
    if (error) throw error;
    return fetchTransactionTypePermissions(userId);
  }
  return existing;
}

export async function updateTransactionTypePermission(
  id: string,
  updates: Partial<Pick<TransactionTypePermission, 'can_view' | 'can_add' | 'can_edit' | 'can_delete' | 'can_print'>>,
): Promise<void> {
  const { error } = await supabase
    .from('transaction_type_permissions')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}
