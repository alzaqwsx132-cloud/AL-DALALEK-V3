/*
# صلاحيات أنواع السندات بشكل مستقل

1. الجداول الجديدة
- `transaction_type_permissions`
- `id`: المعرف الفريد
- `user_id`: المستخدم المرتبط بصلاحية السند
- `transaction_type`: نوع السند (receipt, issue, return, transfer)
- `can_view`, `can_add`, `can_edit`, `can_delete`, `can_print`: صلاحيات مستقلة لكل نوع
- `created_at`: تاريخ إنشاء الصلاحية

2. التعديلات
- لا يتم حذف أو تغيير أي بيانات موجودة.
- يتم إنشاء صف صلاحيات لكل مستخدم حالي ولكل نوع سند عند عدم وجوده.

3. الأمان
- تفعيل RLS على الجدول.
- السماح بالتعامل مع الجدول للتطبيق الحالي الذي يستخدم تسجيل الدخول الداخلي.
- فصل سياسات القراءة والإضافة والتعديل والحذف.

4. ملاحظات
- مدير النظام لا يعتمد على هذه الصفوف داخل الواجهة، بل يمتلك جميع الصلاحيات تلقائياً.
- المستخدمون العاديون تتم قراءة صلاحياتهم لكل نوع سند بشكل مستقل.
*/

CREATE TABLE IF NOT EXISTS transaction_type_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('receipt', 'issue', 'return', 'transfer')),
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_print boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, transaction_type)
);

ALTER TABLE transaction_type_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transaction_type_permissions" ON transaction_type_permissions;
CREATE POLICY "anon_select_transaction_type_permissions" ON transaction_type_permissions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transaction_type_permissions" ON transaction_type_permissions;
CREATE POLICY "anon_insert_transaction_type_permissions" ON transaction_type_permissions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transaction_type_permissions" ON transaction_type_permissions;
CREATE POLICY "anon_update_transaction_type_permissions" ON transaction_type_permissions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transaction_type_permissions" ON transaction_type_permissions;
CREATE POLICY "anon_delete_transaction_type_permissions" ON transaction_type_permissions FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO transaction_type_permissions (user_id, transaction_type)
SELECT au.id, types.transaction_type
FROM app_users au
CROSS JOIN (VALUES ('receipt'), ('issue'), ('return'), ('transfer')) AS types(transaction_type)
ON CONFLICT (user_id, transaction_type) DO NOTHING;
