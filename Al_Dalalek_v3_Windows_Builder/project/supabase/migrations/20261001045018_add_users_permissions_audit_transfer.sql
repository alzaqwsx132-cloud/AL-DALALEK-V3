/*
# إضافة التحويل المخزني للمستخدمين والصلاحيات وسجل التدقيق

1. تحديث نوع السند: إضافة 'transfer' كنوع سند جديد
2. جدول المستخدمين (app_users) مع كلمات مرور مشفرة
3. جدول صلاحيات المستخدمين (user_permissions)
4. جدول سجل التدقيق (audit_log)
5. سياسات الأمان (RLS) لجميع الجداول الجديدة

## التفاصيل:
- app_users: المستخدمون مع أدوار (admin/user) وحالة التفعيل
- user_permissions: صلاحيات دقيقة لكل مستخدم لكل وحدة
- audit_log: سجل لكل عملية مهمة مع البيانات القديمة والجديدة
- transfer: نوع سند جديد للتحويل بين المستودعات
*/

-- 1. إضافة 'transfer' لنوع السند
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN ('receipt', 'issue', 'return', 'transfer'));

-- 2. جدول المستخدمين
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_users" ON app_users;
CREATE POLICY "anon_select_app_users" ON app_users FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_app_users" ON app_users;
CREATE POLICY "anon_insert_app_users" ON app_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_app_users" ON app_users;
CREATE POLICY "anon_update_app_users" ON app_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_app_users" ON app_users;
CREATE POLICY "anon_delete_app_users" ON app_users FOR DELETE
  TO anon, authenticated USING (true);

-- 3. جدول صلاحيات المستخدمين
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('items', 'warehouses', 'departments', 'transactions', 'transfers', 'balances', 'reports', 'users', 'settings', 'audit_log')),
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_print boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  can_cancel boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_permissions" ON user_permissions;
CREATE POLICY "anon_select_user_permissions" ON user_permissions FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_user_permissions" ON user_permissions;
CREATE POLICY "anon_insert_user_permissions" ON user_permissions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_user_permissions" ON user_permissions;
CREATE POLICY "anon_update_user_permissions" ON user_permissions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_user_permissions" ON user_permissions;
CREATE POLICY "anon_delete_user_permissions" ON user_permissions FOR DELETE
  TO anon, authenticated USING (true);

-- 4. جدول سجل التدقيق
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text,
  action text NOT NULL,
  module text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_log" ON audit_log;
CREATE POLICY "anon_select_audit_log" ON audit_log FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_log" ON audit_log;
CREATE POLICY "anon_insert_audit_log" ON audit_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_log" ON audit_log;
CREATE POLICY "anon_delete_audit_log" ON audit_log FOR DELETE
  TO anon, authenticated USING (false);

-- 5. إدخال مستخدم مدير النظام الافتراضي (كلمة المرور: admin123)
-- كلمة المرور مشفرة باستخدام crypt مع pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO app_users (username, full_name, password_hash, role, is_active)
SELECT 'admin', 'مدير النظام', crypt('admin123', gen_salt('bf')), 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin');

-- 6. إدخال جميع الصلاحيات لمدير النظام
INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_print, can_approve, can_cancel, can_export)
SELECT au.id, m.module, true, true, true, true, true, true, true, true
FROM app_users au
CROSS JOIN (VALUES
  ('items'), ('warehouses'), ('departments'), ('transactions'),
  ('transfers'), ('balances'), ('reports'), ('users'),
  ('settings'), ('audit_log')
) AS m(module)
WHERE au.username = 'admin'
ON CONFLICT (user_id, module) DO NOTHING;

-- 7. تحديث دالة generate_transaction_number لتدعم transfer
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  prefix text;
BEGIN
  seq_val := nextval('transactions_seq');
  prefix := 'TXN-' || to_char(now(), 'YY') || '-';
  RETURN prefix || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
