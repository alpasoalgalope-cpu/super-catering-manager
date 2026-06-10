-- Enums personalizados de control
CREATE TYPE public.rol_usuario AS ENUM ('admin', 'cocina', 'empleado');
CREATE TYPE public.estado_laboral_enum AS ENUM ('en_blanco', 'no_registrado');
CREATE TYPE public.tipo_incidencia_enum AS ENUM ('ausencia', 'carpeta_medica', 'llegada_tarde', 'franco');
CREATE TYPE public.estado_solicitud_enum AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- 1. Perfiles Extendidos (vincular Joni y Caro individualmente)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  rol public.rol_usuario NOT NULL DEFAULT 'cocina',
  id_reloj VARCHAR(50) UNIQUE, -- ID del empleado en el aparato (Ej: '000000002')
  fecha_ingreso DATE NOT NULL,
  dni_url TEXT, -- Enlace a Supabase Storage del DNI escaneado
  estado_laboral public.estado_laboral_enum NOT NULL DEFAULT 'no_registrado',
  vencimiento_libreta_sanitaria DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Transacciones de Fichadas (Historial Puro)
CREATE TABLE public.clock_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id_reloj VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL, -- Hora local del dispositivo (sin zona horaria)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_fichada UNIQUE (id_reloj, timestamp)
);

-- 3. Tabla de Incidencias Diarias
CREATE TABLE public.incidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo public.tipo_incidencia_enum NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_fechas CHECK (fecha_fin >= fecha_inicio)
);

-- 4. Repositorio de Recibos de Sueldo
CREATE TABLE public.recibos_sueldo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  periodo VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM'
  archivo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_recibo UNIQUE (profile_id, periodo)
);

-- 5. Control de Vacaciones (Saldos y Solicitudes)
CREATE TABLE public.vacaciones_saldos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anio INT NOT NULL,
  dias_totales INT NOT NULL DEFAULT 14,
  dias_usados INT NOT NULL DEFAULT 0,
  CONSTRAINT unique_saldo UNIQUE (profile_id, anio)
);

CREATE TABLE public.vacaciones_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado public.estado_solicitud_enum NOT NULL DEFAULT 'pendiente',
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_fechas_solicitud CHECK (fecha_fin >= fecha_inicio)
);

-- 6. Módulos Adicionales de Volumen (Vales de Caja e Indumentaria)
CREATE TABLE public.vales_adelantos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  concepto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.entrega_uniformes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  detalle TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEGURIDAD Y POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_sueldo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacaciones_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacaciones_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vales_adelantos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrega_uniformes ENABLE ROW LEVEL SECURITY;

-- Función de seguridad definidora para evitar recursión RLS al verificar rol de admin
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- 1. Obtener email y rol del JWT directamente (evita consultas recursivas a tablas)
  v_email := auth.jwt() ->> 'email';
  v_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  -- 2. Bypass para el admin principal por email
  IF v_email = 'fschottenfeld@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- 3. Retornar si tiene el rol admin en el JWT
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS PARA: profiles
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "Admins control total profiles" ON public.profiles;
DROP POLICY IF EXISTS "Empleados ven su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Empleados actualizan su propio perfil" ON public.profiles;

CREATE POLICY "Admins control total profiles" ON public.profiles FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven su propio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- Permitir actualizar ciertos campos propios si es necesario (ej. dni_url)
CREATE POLICY "Empleados actualizan su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- POLÍTICAS PARA: clock_ins
DROP POLICY IF EXISTS "Admins control clock_ins" ON public.clock_ins;
DROP POLICY IF EXISTS "Empleados ven sus propias fichadas" ON public.clock_ins;

CREATE POLICY "Admins control clock_ins" ON public.clock_ins FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus propias fichadas" ON public.clock_ins FOR SELECT USING (profile_id = auth.uid());

-- POLÍTICAS PARA: incidencias
DROP POLICY IF EXISTS "Admins control incidencias" ON public.incidencias;
DROP POLICY IF EXISTS "Empleados ven sus incidencias" ON public.incidencias;

CREATE POLICY "Admins control incidencias" ON public.incidencias FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus incidencias" ON public.incidencias FOR SELECT USING (profile_id = auth.uid());

-- Helper para verificar estado laboral sin gatillar RLS en profiles
CREATE OR REPLACE FUNCTION public.es_en_blanco(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND estado_laboral = 'en_blanco'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS PARA: recibos_sueldo
DROP POLICY IF EXISTS "Admins control recibos" ON public.recibos_sueldo;
DROP POLICY IF EXISTS "Empleados en blanco descargan recibos" ON public.recibos_sueldo;

CREATE POLICY "Admins control recibos" ON public.recibos_sueldo FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados en blanco descargan recibos" ON public.recibos_sueldo FOR SELECT USING (
  profile_id = auth.uid() AND 
  public.es_en_blanco(auth.uid())
);

-- POLÍTICAS PARA: vacaciones_saldos
CREATE POLICY "Admins control saldos" ON public.vacaciones_saldos FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus saldos" ON public.vacaciones_saldos FOR SELECT USING (profile_id = auth.uid());

-- POLÍTICAS PARA: vacaciones_solicitudes
CREATE POLICY "Admins control solicitudes" ON public.vacaciones_solicitudes FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus solicitudes" ON public.vacaciones_solicitudes FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Empleados crean sus solicitudes" ON public.vacaciones_solicitudes FOR INSERT WITH CHECK (profile_id = auth.uid());

-- POLÍTICAS PARA: vales_adelantos
CREATE POLICY "Admins control vales" ON public.vales_adelantos FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus vales" ON public.vales_adelantos FOR SELECT USING (profile_id = auth.uid());

-- POLÍTICAS PARA: entrega_uniformes
CREATE POLICY "Admins control uniformes" ON public.entrega_uniformes FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus uniformes" ON public.entrega_uniformes FOR SELECT USING (profile_id = auth.uid());


-- ============================================================
-- LÓGICA DE NEGOCIO: FUNCIÓN TRANSACCIONAL DE VACACIONES (CONVENIO)
-- ============================================================

CREATE OR REPLACE FUNCTION public.aprobar_vacaciones_gastro(solicitud_id UUID)
RETURNS VOID AS $$
DECLARE
  v_profile_id UUID;
  v_inicio DATE;
  v_fin DATE;
  v_dias INT;
  v_anio INT;
  v_usados INT;
  v_totales INT;
BEGIN
  -- Obtener la solicitud y validar que exista y esté pendiente
  SELECT profile_id, fecha_inicio, fecha_fin 
  INTO v_profile_id, v_inicio, v_fin
  FROM public.vacaciones_solicitudes
  WHERE id = solicitud_id AND estado = 'pendiente';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no se encuentra pendiente o ya fue procesada.';
  END IF;

  v_dias := (v_fin - v_inicio) + 1; -- Cómputo de días corridos
  v_anio := EXTRACT(YEAR FROM v_inicio);

  -- Obtener el saldo anual
  SELECT dias_usados, dias_totales INTO v_usados, v_totales
  FROM public.vacaciones_saldos
  WHERE profile_id = v_profile_id AND anio = v_anio;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró registro de saldo de vacaciones para el año %.', v_anio;
  END IF;

  -- Validar si hay saldo suficiente
  IF (v_usados + v_dias) > v_totales THEN
    RAISE EXCEPTION 'Saldo insuficiente. El empleado dispone de % días y solicita %.', (v_totales - v_usados), v_dias;
  END IF;

  -- Actualizar de forma atómica la solicitud y debitar el saldo
  UPDATE public.vacaciones_solicitudes SET estado = 'aprobado' WHERE id = solicitud_id;
  UPDATE public.vacaciones_saldos SET dias_usados = dias_usados + v_dias WHERE profile_id = v_profile_id AND anio = v_anio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
