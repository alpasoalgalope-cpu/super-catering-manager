-- ============================================================
-- MIGRACIÓN: Modelo Relacional Centrado en Evento Maestro
-- Super Catering Manager — v2.0
-- ============================================================

-- 1. TABLA VENUES (Predio / Lugar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  address     text,
  meeting_point text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT venues_name_unique UNIQUE (name)
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_public_access" ON public.venues FOR ALL USING (true) WITH CHECK (true);

-- Poblar venues desde recitales_staging (registros únicos)
INSERT INTO public.venues (name)
SELECT DISTINCT trim(venue)
FROM public.recitales_staging
WHERE venue IS NOT NULL AND trim(venue) <> ''
ON CONFLICT (name) DO NOTHING;


-- 2. TABLA EVENTS_MASTER (Evento Principal)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events_master (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date    date NOT NULL,
  show_name     text NOT NULL,
  venue_id      uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  coordinator_id uuid REFERENCES public.coordinators (id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pendiente',
  created_at    timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT events_master_unique UNIQUE (event_date, show_name, venue_id)
);

ALTER TABLE public.events_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_master_public_access" ON public.events_master FOR ALL USING (true) WITH CHECK (true);

-- Poblar events_master desde recitales_staging (deduplicado)
INSERT INTO public.events_master (event_date, show_name, venue_id, status)
SELECT DISTINCT ON (rs.event_date, rs.show_name, v.id)
  rs.event_date::date,
  rs.show_name,
  v.id,
  COALESCE(rs.status, 'pendiente')
FROM public.recitales_staging rs
LEFT JOIN public.venues v ON trim(v.name) = trim(rs.venue)
WHERE rs.event_date IS NOT NULL AND rs.show_name IS NOT NULL
ON CONFLICT (event_date, show_name, venue_id) DO NOTHING;


-- 3. TABLA EVENT_PROJECTIONS (Empresa x Evento con PAX)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_projections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events_master (id) ON DELETE CASCADE,
  company_name    text NOT NULL,
  projected_pax   integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT event_projections_unique UNIQUE (event_id, company_name)
);

ALTER TABLE public.event_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_projections_public_access" ON public.event_projections FOR ALL USING (true) WITH CHECK (true);

-- Poblar event_projections desde recitales_staging
INSERT INTO public.event_projections (event_id, company_name, projected_pax)
SELECT DISTINCT ON (em.id, rs.company)
  em.id,
  rs.company,
  COALESCE(rs.pax_projected, 0)
FROM public.recitales_staging rs
JOIN public.venues v ON trim(v.name) = trim(rs.venue)
JOIN public.events_master em
  ON em.event_date = rs.event_date::date
  AND em.show_name  = rs.show_name
  AND em.venue_id   = v.id
WHERE rs.company IS NOT NULL AND rs.company <> ''
ON CONFLICT (event_id, company_name) DO NOTHING;


-- 4. ACTUALIZAR event_sales_headers PARA APUNTAR A events_master
-- ============================================================
-- Agrega columna event_master_id si no existe
ALTER TABLE public.event_sales_headers
  ADD COLUMN IF NOT EXISTS event_master_id uuid REFERENCES public.events_master (id) ON DELETE SET NULL;

ALTER TABLE public.event_sales_headers
  ADD COLUMN IF NOT EXISTS company_name text;

-- Intentar relacionar los headers existentes con el nuevo modelo
-- basado en el event_id original (recitales_staging)
UPDATE public.event_sales_headers esh
SET
  event_master_id = em.id,
  company_name    = COALESCE(esh.company, rs.company)
FROM public.recitales_staging rs
JOIN public.venues v  ON trim(v.name) = trim(rs.venue)
JOIN public.events_master em
  ON em.event_date = rs.event_date::date
  AND em.show_name  = rs.show_name
  AND em.venue_id   = v.id
WHERE esh.event_id = rs.id
  AND esh.event_master_id IS NULL;

-- 5. EXTENDER commercial_rules CON CAMPOS PARA CLIENTES PRO
-- ============================================================
ALTER TABLE public.commercial_rules
  ADD COLUMN IF NOT EXISTS special_sintacc_price numeric,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS cuit text;

COMMENT ON COLUMN public.commercial_rules.special_sintacc_price IS
  'Precio override para Sin TACC. Si existe, reemplaza price_sintacc_base para este cliente. Ej: RV TRASLADOS = 10000';

