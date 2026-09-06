-- 032_get_employees_with_email_and_password_reset.sql
-- RPC functions to list employees with their auth email and update login credentials

-- 1. Función para listar perfiles incluyendo su email de auth.users
CREATE OR REPLACE FUNCTION public.obtener_empleados_completos()
RETURNS TABLE (
  id UUID,
  nombre_completo TEXT,
  email TEXT,
  rol public.rol_usuario,
  id_reloj VARCHAR(50),
  fecha_ingreso DATE,
  dni_url TEXT,
  estado_laboral public.estado_laboral_enum,
  vencimiento_libreta_sanitaria DATE,
  dni TEXT,
  telefono TEXT,
  domicilio TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.nombre_completo,
    u.email::TEXT,
    p.rol,
    p.id_reloj,
    p.fecha_ingreso,
    p.dni_url,
    p.estado_laboral,
    p.vencimiento_libreta_sanitaria,
    p.dni,
    p.telefono,
    p.domicilio,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY p.nombre_completo ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para actualizar email y/o contraseña de un empleado desde el panel admin
CREATE OR REPLACE FUNCTION public.actualizar_credenciales_empleado(
  p_user_id UUID,
  p_nuevo_email TEXT DEFAULT NULL,
  p_nueva_password TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  -- Actualizar email en auth.users si fue provisto
  IF p_nuevo_email IS NOT NULL AND TRIM(p_nuevo_email) <> '' THEN
    UPDATE auth.users
    SET email = TRIM(p_nuevo_email),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', TRIM(p_nuevo_email)),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Actualizar contraseña en auth.users si fue provista
  IF p_nueva_password IS NOT NULL AND TRIM(p_nueva_password) <> '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(TRIM(p_nueva_password), extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
