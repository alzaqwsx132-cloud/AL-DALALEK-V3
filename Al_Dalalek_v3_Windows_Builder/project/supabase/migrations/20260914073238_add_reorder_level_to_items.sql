/*
# إضافة حد إعادة الطلب لجدول الأصناف

1. Changes
- إضافة عمود reorder_level إلى جدول items من نوع numeric بقيمة افتراضية 0
- هذا العمود يمثل الحد الأدنى للكمية الذي عنده يظهر تنبيه بنفاذ الكمية

2. Notes
- القيمة الافتراضية 0 تعني عدم وجود تنبيه (الصنف لا يحتاج إعادة طلب)
- يمكن تعديلها لكل صنف من شاشة إدارة الأصناف
*/

ALTER TABLE items ADD COLUMN IF NOT EXISTS reorder_level numeric(15,3) NOT NULL DEFAULT 0;
