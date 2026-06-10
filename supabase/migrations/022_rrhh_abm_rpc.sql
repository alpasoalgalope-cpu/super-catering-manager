-- Migración para soportar ABM (Alta, Baja, Modificación) de empleados desde la aplicación

-- 1. Función RPC para crear un empleado completo (Usuario de Auth + Perfil de Legajo)
CREATE OR REPLACE FUNCTION public.crear_empleado_completo(
  p_email TEXT,
  p_password TEXT,
  p_nombre_completo TEXT,
  p_rol TEXT,
  p_id_reloj TEXT,
  p_fecha_ingreso DATE,
  p_estado_laboral TEXT,
  p_vencimiento_libreta DATE DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validar si el email ya existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'El correo electrónico % ya está registrado.', p_email;
  END IF;

  -- Validar si el ID de reloj ya existe (si es provisto)
  IF p_id_reloj IS NOT NULL AND p_id_reloj <> '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id_reloj = p_id_reloj) THEN
      RAISE EXCEPTION 'El ID de reloj % ya está asignado a otro empleado.', p_id_reloj;
    END IF;
  END IF;

  -- 1. Insertar el usuario en la tabla auth.users (creando sus credenciales y metadatos)
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
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Función RPC para eliminar un empleado completo (Usuario de Auth + Cascada en Perfil)
CREATE OR REPLACE FUNCTION public.eliminar_empleado(p_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Eliminar de auth.users. Esto gatillará el borrado en cascada (ON DELETE CASCADE) de public.profiles
  -- y de todas las tablas dependientes (clock_ins, incidencias, recibos_sueldo, vacaciones, etc.)
  DELETE FROM auth.users WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
