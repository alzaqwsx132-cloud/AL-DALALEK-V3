/*
# دالة تشفير كلمة المرور
*/

CREATE OR REPLACE FUNCTION hash_password(input_password text)
RETURNS text AS $$
BEGIN
  RETURN crypt(input_password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
