-- ============================================================
-- MIGRACIÓN: Campos Contables y Conciliación para Órdenes de Compra
-- ============================================================

-- 1. Modificar tabla purchase_orders con campos de facturación y percepciones
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS tipo_documento text DEFAULT 'factura' CHECK (tipo_documento IN ('remito', 'factura')),
  ADD COLUMN IF NOT EXISTS nro_comprobante text,
  ADD COLUMN IF NOT EXISTS percepcion_iva numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percepcion_iibb numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percepcion_ganancias numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impuestos_internos numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facturado boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS afip_comprobante_id uuid REFERENCES public.afip_comprobantes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desvio_inflacion numeric DEFAULT 0;

-- 2. Índices de rendimiento para conciliación
CREATE INDEX IF NOT EXISTS idx_purchase_orders_facturado ON public.purchase_orders (facturado);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_afip_comprobante ON public.purchase_orders (afip_comprobante_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tipo_documento ON public.purchase_orders (tipo_documento);
