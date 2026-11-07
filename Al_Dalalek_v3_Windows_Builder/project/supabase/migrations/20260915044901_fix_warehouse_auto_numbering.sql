-- إصلاح الترقيم التلقائي للمستودعات
-- 1. تحديث أكواد المستودعات الحالية لتتبع التنسيق الجديد WH-001
-- 2. مزامنة التسلسل مع عدد المستودعات الحالية

-- تحديث الأكواد الحالية بترتيب الإنشاء
WITH ranked AS (
  SELECT id, created_at,
    ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM warehouses
)
UPDATE warehouses w
SET code = 'WH-' || lpad(r.rn::text, 3, '0')
FROM ranked r
WHERE w.id = r.id;

-- مزامنة التسلسل مع عدد المستودعات الحالية
SELECT setval('warehouses_seq', GREATEST((SELECT COUNT(*) FROM warehouses), 1));
