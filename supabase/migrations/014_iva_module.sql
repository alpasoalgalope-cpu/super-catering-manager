-- ============================================================
-- MIGRACIÓN DE PRECISIÓN: ESTRUCTURA NATIVA DE IVA Y LIQUIDACIONES
-- ============================================================

-- 1. Tabla de Comprobantes Detallados
CREATE TABLE IF NOT EXISTS public.afip_comprobantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_flujo text NOT NULL CHECK (tipo_flujo IN ('emitido', 'recibido')),
  fecha date NOT NULL,
  tipo_comprobante text NOT NULL,
  punto_venta integer NOT NULL,
  numero_desde bigint NOT NULL,
  numero_hasta bigint NOT NULL,
  cod_autorizacion text,
  
  -- Unificación de Contraparte (Emisor o Receptor según el flujo)
  cuit_contraparte text NOT NULL,
  denominacion_contraparte text,
  
  tipo_cambio numeric NOT NULL DEFAULT 1,
  moneda text NOT NULL DEFAULT 'PES',
  
  -- Apertura completa de Baldes Gravados AFIP
  neto_grav_0 numeric NOT NULL DEFAULT 0,
  neto_grav_2_5 numeric NOT NULL DEFAULT 0,
  iva_2_5 numeric NOT NULL DEFAULT 0,
  neto_grav_5 numeric NOT NULL DEFAULT 0,
  iva_5 numeric NOT NULL DEFAULT 0,
  neto_grav_10_5 numeric NOT NULL DEFAULT 0,
  iva_10_5 numeric NOT NULL DEFAULT 0,
  neto_grav_21 numeric NOT NULL DEFAULT 0,
  iva_21 numeric NOT NULL DEFAULT 0,
  neto_grav_27 numeric NOT NULL DEFAULT 0,
  iva_27 numeric NOT NULL DEFAULT 0,
  
  -- Totales Consolidados de la Fila
  neto_gravado_total numeric NOT NULL DEFAULT 0,
  neto_no_gravado numeric NOT NULL DEFAULT 0,
  op_exentas numeric NOT NULL DEFAULT 0,
  otros_tributos numeric NOT NULL DEFAULT 0,
  total_iva numeric NOT NULL DEFAULT 0,
  imp_total numeric NOT NULL DEFAULT 0,
  
  -- Clave única para evitar duplicación por Upsert
  hash_id text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabla de Liquidaciones Mensuales (Estructura de Doble Saldo)
CREATE TABLE IF NOT EXISTS public.iva_liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo text UNIQUE NOT NULL, -- Formato estricto: 'YYYY-MM'
  debito_fiscal_puro numeric NOT NULL DEFAULT 0,
  credito_fiscal_puro numeric NOT NULL DEFAULT 0,
  
  -- Fila de control: Saldo Técnico (1er Párrafo)
  saldo_tecnico_anterior_trasladado numeric NOT NULL DEFAULT 0,
  saldo_tecnico_fisco numeric NOT NULL DEFAULT 0,
  saldo_tecnico_contribuyente_remanente numeric NOT NULL DEFAULT 0,
  
  -- Fila de control: Saldo de Libre Disponibilidad (2do Párrafo)
  saldo_libre_disp_anterior_trasladado numeric NOT NULL DEFAULT 0,
  retenciones_percepciones_del_mes numeric NOT NULL DEFAULT 0,
  saldo_libre_disp_remanente numeric NOT NULL DEFAULT 0,
  
  -- Caja final
  saldo_a_pagar numeric NOT NULL DEFAULT 0,
  
  -- Estados de la liquidación
  cerrado boolean NOT NULL DEFAULT false,
  pagado boolean NOT NULL DEFAULT false,
  fecha_pago date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Habilitación de Políticas de Seguridad (RLS)
ALTER TABLE public.afip_comprobantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "afip_comprobantes_all_access" ON public.afip_comprobantes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.iva_liquidaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iva_liquidaciones_all_access" ON public.iva_liquidaciones FOR ALL USING (true) WITH CHECK (true);

-- 4. Índices de Rendimiento para Consultas de Balances Mensuales
CREATE INDEX IF NOT EXISTS idx_comprobantes_busqueda_mensual ON public.afip_comprobantes (tipo_flujo, fecha);
CREATE INDEX IF NOT EXISTS idx_comprobantes_id_unico ON public.afip_comprobantes (hash_id);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_por_mes ON public.iva_liquidaciones (periodo);
