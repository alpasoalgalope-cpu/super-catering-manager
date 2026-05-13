-- Actualizar metadatos de usuario (donde Supabase suele guardar los datos de signUp)
UPDATE auth.users 
SET raw_user_meta_data = '{"role": "admin"}' 
WHERE email = 'fschottenfeld@gmail.com';

-- Actualizar metadatos de app (donde se suelen guardar los roles de sistema)
UPDATE auth.users 
SET raw_app_meta_data = '{"role": "admin"}' 
WHERE email = 'fschottenfeld@gmail.com';

-- Por si acaso, asegurar que el perfil existe también
CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY, email text, role text);
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'fschottenfeld@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
