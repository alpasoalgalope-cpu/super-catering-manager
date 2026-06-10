-- Migración para incorporar DNI, Teléfono y Domicilio al legajo de empleados y sanear políticas RLS de profiles

-- 1. Agregar columnas a public.profiles si no existen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS domicilio TEXT;

-- 2. Eliminar todas las políticas en la tabla public.profiles de forma dinámica para evitar cualquier residuo recursivo
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END;
$$;

-- 3. Habilitar Row Level Security en la tabla profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Crear o reemplazar la función de verificación de admin utilizando el JWT de Supabase (cero consultas a tablas = cero recursión)
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  v_email := auth.jwt() ->> 'email';
  v_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  -- Bypass para el admin principal
  IF v_email = 'fschottenfeld@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el rol es admin en el JWT
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear políticas limpias y correctas para public.profiles
CREATE POLICY "Admins control total profiles" ON public.profiles FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven su propio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Empleados actualizan su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 6. Eliminar versión anterior de la función de creación (de firma con 8 o 10 parámetros) para poder actualizar su firma de parámetros
DROP FUNCTION IF EXISTS public.crear_empleado_completo(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, DATE);
DROP FUNCTION IF EXISTS public.crear_empleado_completo(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, DATE, TEXT, TEXT);

-- 7. Crear la nueva versión de la función RPC que acepta DNI, Teléfono y Domicilio
CREATE OR REPLACE FUNCTION public.crear_empleado_completo(
  p_email TEXT,
  p_password TEXT,
  p_nombre_completo TEXT,
  p_rol TEXT,
  p_id_reloj TEXT,
  p_fecha_ingreso DATE,
  p_estado_laboral TEXT,
  p_vencimiento_libreta DATE DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL,
  p_domicilio TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validar si el email ya existe en auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'El correo electrónico % ya está registrado.', p_email;
  END IF;

  -- Validar si el ID de reloj ya existe
  IF p_id_reloj IS NOT NULL AND p_id_reloj <> '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id_reloj = p_id_reloj) THEN
      RAISE EXCEPTION 'El ID de reloj % ya está asignado a otro empleado.', p_id_reloj;
    END IF;
  END IF;

  -- 1. Insertar el usuario en la tabla auth.users
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
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array_to_json(array['email'])::jsonb, 'role', p_rol),
    jsonb_build_object('role', p_rol, 'nombre_completo', p_nombre_completo),
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- 2. Insertar el registro correspondiente en la tabla public.profiles
  INSERT INTO public.profiles (
    id,
    nombre_completo,
    rol,
    id_reloj,
    fecha_ingreso,
    estado_laboral,
    vencimiento_libreta_sanitaria,
    dni,
    telefono,
    domicilio,
    created_at
  )
  VALUES (
    v_user_id,
    p_nombre_completo,
    p_rol::public.rol_usuario,
    NULLIF(TRIM(p_id_reloj), ''),
    p_fecha_ingreso,
    p_estado_laboral::public.estado_laboral_enum,
    p_vencimiento_libreta,
    p_dni,
    p_telefono,
    p_domicilio,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
