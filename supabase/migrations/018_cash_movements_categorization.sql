-- ============================================================
-- MIGRACIÓN: Relaciones y Categorización del Libro de Caja
-- ============================================================

-- 1. Crear tabla de Conceptos (Rubros / Categorías principales)
CREATE TABLE IF NOT EXISTS public.cash_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Ingreso', 'Egreso')),
  created_at timestamptz DEFAULT now()
);

-- 2. Crear tabla de Subconceptos (Detalle de Imputación de Caja / conc_caja)
CREATE TABLE IF NOT EXISTS public.cash_subconcepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid REFERENCES public.cash_concepts(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_concept_subconcept UNIQUE (concept_id, name)
);

-- 3. Habilitar RLS para ambas tablas
ALTER TABLE public.cash_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_subconcepts ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de acceso público (Lectura/Escritura sin restricciones de API interna)
DROP POLICY IF EXISTS "cash_concepts_public_access" ON public.cash_concepts;
CREATE POLICY "cash_concepts_public_access" ON public.cash_concepts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cash_subconcepts_public_access" ON public.cash_subconcepts;
CREATE POLICY "cash_subconcepts_public_access" ON public.cash_subconcepts FOR ALL USING (true) WITH CHECK (true);

-- 5. Agregar relaciones a la tabla existente de movimientos
ALTER TABLE public.cash_movements 
ADD COLUMN IF NOT EXISTS concept_id uuid REFERENCES public.cash_concepts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subconcept_id uuid REFERENCES public.cash_subconcepts(id) ON DELETE SET NULL;

-- ============================================================
-- REINICIO Y CARGA DE CATEGORÍAS Y SUBCATEGORÍAS ACTUALIZADAS
-- ============================================================

-- A. Limpiar movimientos y relaciones antiguas para carga desde cero
TRUNCATE TABLE public.cash_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.cash_subconcepts RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.cash_concepts RESTART IDENTITY CASCADE;

-- B. Insertar los nuevos datos maestros de Conceptos principales (8 Categorías)
INSERT INTO public.cash_concepts (name, tipo) VALUES
('Administracion', 'Egreso'),
('AJUSTES', 'Ingreso'),
('EGR. Varios', 'Egreso'),
('Estructura', 'Egreso'),
('Impuestos', 'Egreso'),
('Materia Prima', 'Egreso'),
('Servicios', 'Egreso'),
('VENTAS', 'Ingreso')
ON CONFLICT (name) DO NOTHING;

-- C. Insertar los nuevos datos maestros de Subconceptos vinculados

-- Subconceptos de Administracion
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'Administracion') as concept_id, unnest(ARRAY[
    'Abogados', 'Contadores'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de AJUSTES
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'AJUSTES') as concept_id, unnest(ARRAY[
    'Ajustes'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de EGR. Varios
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'EGR. Varios') as concept_id, unnest(ARRAY[
    'Almacen', 'Comisiones Bancarias', 'Comisiones MP', 'Comisiones Peya',
    'Contadores', 'Elementos de Limpieza', 'Equipamiento', 'Ferreteria',
    'Fumigacion', 'Librería', 'Logistica', 'Mantenimiento Instalaciones',
    'Marketing', 'Pago Extras', 'papelera', 'Reparacion Maquinarias'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de Estructura
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'Estructura') as concept_id, unnest(ARRAY[
    'Alquiler', 'Expensas', 'Sueldos'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de Impuestos
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'Impuestos') as concept_id, unnest(ARRAY[
    'ABL', 'Ingresos Brutos', 'IVA', 'SISPJ'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de Materia Prima
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'Materia Prima') as concept_id, unnest(ARRAY[
    'Almacen', 'Bebidas sin Alcohol', 'Cafe', 'Carnes', 'Panaderia', 'Papelera', 'Quesos y Fiambres', 'Verduleria'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de Servicios
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'Servicios') as concept_id, unnest(ARRAY[
    'AySA', 'Seguro del local', 'Servicio de Acceso a Internet', 'Servicio de Aguas',
    'Servicio de Energia Electrica', 'Servicio Maxisistemas', 'Servicio TV',
    'Servicios Especializados', 'USS'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- Subconceptos de VENTAS
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'VENTAS') as concept_id, unnest(ARRAY[
    'Ventas'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;

-- D. Backfill para vincular automáticamente todos los registros históricos existentes de forma relacional
-- Vincular por conceptos estándar
UPDATE public.cash_movements cm
SET concept_id = c.id
FROM public.cash_concepts c
WHERE LOWER(TRIM(cm.concepto)) = LOWER(TRIM(c.name));

-- Vincular 'AJUSTES' o 'VENTAS' sueltos a la respectiva categoría
UPDATE public.cash_movements cm
SET concept_id = (SELECT id FROM public.cash_concepts WHERE name = 'VENTAS')
WHERE cm.concepto = 'Ventas' OR cm.concepto = 'VENTAS';

UPDATE public.cash_movements cm
SET concept_id = (SELECT id FROM public.cash_concepts WHERE name = 'AJUSTES')
WHERE cm.concepto = 'Ajustes' OR cm.concepto = 'AJUSTES';

-- Vincular Subconceptos históricos
UPDATE public.cash_movements cm
SET subconcept_id = s.id
FROM public.cash_subconcepts s
WHERE cm.concept_id = s.concept_id
  AND LOWER(TRIM(cm.conc_caja)) = LOWER(TRIM(s.name));
