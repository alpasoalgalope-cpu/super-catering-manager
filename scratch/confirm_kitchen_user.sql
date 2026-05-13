-- 1. Confirmar al usuario de cocina
UPDATE auth.users 
SET email_confirmed_at = now(),
    confirmed_at = now(),
    last_sign_in_at = now(),
    raw_app_meta_data = '{"provider":"email","providers":["email"],"role":"cocina"}',
    raw_user_meta_data = '{"role":"cocina"}'
WHERE email = 'alpaso.algalope@gmail.com';

-- 2. Asegurar que tenga el perfil en la tabla de profiles (por si acaso)
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'cocina'
FROM auth.users
WHERE email = 'alpaso.algalope@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'cocina';
