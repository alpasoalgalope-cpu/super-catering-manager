-- 1. Confirmar el email del usuario manualmente
UPDATE auth.users 
SET email_confirmed_at = now(),
    confirmed_at = now(),
    last_sign_in_at = now()
WHERE email = 'fschottenfeld@gmail.com';

-- 2. Asegurar que tenga el perfil de admin
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'fschottenfeld@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
