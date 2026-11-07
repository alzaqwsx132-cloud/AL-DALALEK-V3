/*
# تغيير نوع السند "تحويل" إلى "استرجاع"

1. Changes
- تحديث قيم transaction_type من 'transfer' إلى 'return' في جدول transactions
- تحديث CHECK constraint لقبول 'receipt', 'issue', 'return' بدلاً من 'receipt', 'issue', 'transfer'
- إعادة تسمية عمود to_warehouse_id غير ضرورية — يبقى كما هو (يُستخدم في الاسترجاع لتحديد المستودع المسترجع إليه)

2. Logic
- receipt (استلام): إدخال للمخزن — يزيد رصيد المستودع
- issue (صرف): تسليم للقسم — ينقص رصيد المستودع، يزيد رصيد القسم
- return (استرجاع): من القسم إلى المخزن — يزيد رصيد المستودع، ينقص رصيد القسم
- الاسترجاع يستخدم department_id لتحديد القسم، و to_warehouse_id لتحديد المستودع (اختياري - افتراضياً نفس المستودع الأصلي)

3. Data migration
- تحديث جميع السجلات الموجودة من 'transfer' إلى 'return'
*/

-- Update existing transfer records to return
UPDATE transactions SET transaction_type = 'return' WHERE transaction_type = 'transfer';

-- Drop old constraint and add new one
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN ('receipt', 'issue', 'return'));
