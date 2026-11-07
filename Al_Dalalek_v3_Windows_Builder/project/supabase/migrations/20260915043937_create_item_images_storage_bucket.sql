-- إنشاء storage bucket لصور الأصناف
-- سيتم إنشاؤه عبر SQL مباشر

INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات الوصول للـ bucket: anon + authenticated يمكنهم رفع وقراءة الصور
DROP POLICY IF EXISTS "anon_select_item_images" ON storage.objects;
CREATE POLICY "anon_select_item_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'item-images');

DROP POLICY IF EXISTS "anon_insert_item_images" ON storage.objects;
CREATE POLICY "anon_insert_item_images" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'item-images');

DROP POLICY IF EXISTS "anon_update_item_images" ON storage.objects;
CREATE POLICY "anon_update_item_images" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'item-images') WITH CHECK (bucket_id = 'item-images');

DROP POLICY IF EXISTS "anon_delete_item_images" ON storage.objects;
CREATE POLICY "anon_delete_item_images" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'item-images');
