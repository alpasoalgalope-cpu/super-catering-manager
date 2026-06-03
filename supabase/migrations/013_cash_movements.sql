-- ============================================================
-- MIGRACIÓN: Módulo de Finanzas y Caja (Maxirest Importer)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Estructura Híbrida (Maxirest + Drive)
  sucursal text NOT NULL DEFAULT 'Galope Bustamante',
  mes text,
  fecha date NOT NULL,
  semana text,
  turno text,
  tipo text,
  concepto text,
  cod_cga text,
  conc_caja text,
  detalle text,
  importe numeric NOT NULL,
  esrecu text,
  oculta text,
  rubro text,
  
  -- Integración con el Sistema de Eventos
  event_master_id uuid REFERENCES public.events_master(id) ON DELETE SET NULL,
  
  -- Hash ID para idempotencia (Anti-Duplicados)
  hash_id text UNIQUE NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_movements_public_access" ON public.cash_movements FOR ALL USING (true) WITH CHECK (true);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_movements_fecha ON public.cash_movements (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tipo ON public.cash_movements (tipo);
CREATE INDEX IF NOT EXISTS idx_cash_movements_hash ON public.cash_movements (hash_id);
