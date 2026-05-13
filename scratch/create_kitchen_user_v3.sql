-- Intentar insertar el usuario de cocina con lo mínimo indispensable
-- Usamos 'bf' para bcrypt que es lo que usa Supabase
INSERT INTO auth.users (
  id, 
  instance_id, 
  aud, 
  role, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  created_at, 
  updated_at
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'alpaso.algalope@gmail.com',
  extensions.crypt('cocina123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"cocina"}',
  '{"role":"cocina"}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Asegurar el perfil
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'cocina'
FROM auth.users
WHERE email = 'alpaso.algalope@gmail.com'
ON CONFLICT (email) DO UPDATE SET role = 'cocina';
