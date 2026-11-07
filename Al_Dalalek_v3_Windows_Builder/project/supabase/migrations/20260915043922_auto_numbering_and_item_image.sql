-- ترقيم تلقائي للأصناف والأقسام والمستودعات + إضافة صورة للصنف
-- 1. إضافة عمود image_url لجدول items
-- 2. إنشاء sequences للترقيم التلقائي
-- 3. إنشاء triggers لتوليد الكود تلقائياً عند الإضافة إذا كان الكود فارغاً
--    الأصناف: ITM-0001, المستودعات: WH-001, الأقسام: DEP-001

-- إضافة عمود image_url لجدول items
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url text;

-- إنشاء sequences
CREATE SEQUENCE IF NOT EXISTS items_seq START 1;
CREATE SEQUENCE IF NOT EXISTS warehouses_seq START 1;
CREATE SEQUENCE IF NOT EXISTS departments_seq START 1;

-- دالة توليد كود الصنف
CREATE OR REPLACE FUNCTION generate_item_code()
RETURNS trigger AS $$
DECLARE
  next_val int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    next_val := nextval('items_seq');
    NEW.code := 'ITM-' || lpad(next_val::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_item_code ON items;
CREATE TRIGGER trg_generate_item_code
  BEFORE INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION generate_item_code();

-- دالة توليد كود المستودع
CREATE OR REPLACE FUNCTION generate_warehouse_code()
RETURNS trigger AS $$
DECLARE
  next_val int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    next_val := nextval('warehouses_seq');
    NEW.code := 'WH-' || lpad(next_val::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_warehouse_code ON warehouses;
CREATE TRIGGER trg_generate_warehouse_code
  BEFORE INSERT ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION generate_warehouse_code();

-- دالة توليد كود القسم
CREATE OR REPLACE FUNCTION generate_department_code()
RETURNS trigger AS $$
DECLARE
  next_val int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    next_val := nextval('departments_seq');
    NEW.code := 'DEP-' || lpad(next_val::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_department_code ON departments;
CREATE TRIGGER trg_generate_department_code
  BEFORE INSERT ON departments
  FOR EACH ROW
  EXECUTE FUNCTION generate_department_code();
