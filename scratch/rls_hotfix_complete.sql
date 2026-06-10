-- =========================================================================
-- COMPLETE HOTFIX FOR PROFILES RLS INFINITE RECURSION
-- =========================================================================

-- 1. Eliminar políticas antiguas y conflictivas de la tabla profiles (incluyendo las de configuración previa)
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "Admins control total profiles" ON public.profiles;
DROP POLICY IF EXISTS "Empleados ven su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Empleados actualizan su propio perfil" ON public.profiles;

-- 2. Asegurarse de que RLS esté activo en la tabla profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear o reemplazar la función de verificación de admin utilizando el JWT directamente (cero recursión)
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- Obtener email y rol directamente del token JWT de la sesión activa
  v_email := auth.jwt() ->> 'email';
  v_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  -- Bypass para el administrador principal
  IF v_email = 'fschottenfeld@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el rol es admin
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear o reemplazar el helper para verificar si el empleado está "en blanco"
CREATE OR REPLACE FUNCTION public.es_en_blanco(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Retornamos si existe el perfil y su estado es 'en_blanco'
  -- Al ser SECURITY DEFINER corre con privilegios del owner (postgres), ignorando RLS
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND estado_laboral = 'en_blanco'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear las políticas limpias de profiles
-- Política para Admins: Control total
CREATE POLICY "Admins control total profiles" ON public.profiles 
FOR ALL 
USING (public.es_admin());

-- Política para Empleados: Ver su propio perfil
CREATE POLICY "Empleados ven su propio perfil" ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Política para Empleados: Actualizar su propio perfil
CREATE POLICY "Empleados actualizan su propio perfil" ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);
