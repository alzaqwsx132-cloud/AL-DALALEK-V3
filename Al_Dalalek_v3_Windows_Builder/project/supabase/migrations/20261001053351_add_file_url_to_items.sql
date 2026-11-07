/*
# إضافة حقل file_url لجدول الأصناف

1. إضافة عمود file_url (text, nullable) لجدول items
2. يستخدم لتخزين ملف بدل الصورة (PDF, DOCX, إلخ)
*/

ALTER TABLE items ADD COLUMN IF NOT EXISTS file_url text;
