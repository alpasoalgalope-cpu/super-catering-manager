-- 1. Insertar el usuario de cocina directamente en auth.users
-- Nota: Usamos crypt para hashear la contraseña 'cocina123'
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
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
    updated_at, 
    confirmation_token, 
    email_change, 
    email_change_token_new, 
    recovery_token
  )
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alpaso.algalope@gmail.com',
    crypt('cocina123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"role":"cocina"}',
    '{"role":"cocina"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 2. Insertar en public.profiles
  INSERT INTO public.profiles (id, email, role)
  VALUES (new_user_id, 'alpaso.algalope@gmail.com', 'cocina');
END $$;
