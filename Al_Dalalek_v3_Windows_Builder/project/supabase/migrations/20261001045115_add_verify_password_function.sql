/*
# دالة التحقق من كلمة المرور

دالة verify_password للتحقق من كلمة المرور المشفرة باستخدام pgcrypto
*/

CREATE OR REPLACE FUNCTION verify_password(input_password text, stored_hash text)
RETURNS boolean AS $$
BEGIN
  RETURN input_password = stored_hash OR crypt(input_password, stored_hash) = stored_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
