-- ============================================================
-- MIGRACIÓN: Módulo de Trazabilidad Total de Stock (Ledger)
-- ============================================================

-- 1. CREACIÓN DE LA TABLA DE MOVIMIENTOS
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.productos (id) ON DELETE RESTRICT,
  event_master_id uuid REFERENCES public.events_master (id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  
  -- Tipos de Movimientos a soportar: 
  -- INGRESO_COMPRA, EGRESO_CONSUMO_EVENTO, EGRESO_MERMA_AUTOMATICA, 
  -- EGRESO_MERMA_DECLARADA, EGRESO_CONSUMO_PERSONAL, AJUSTE_MANUAL, INGRESO_REVERSION
  tipo_movimiento text NOT NULL,
  
  -- La cantidad del movimiento. Debe ser positivo para ingresos y negativo para egresos.
  cantidad numeric NOT NULL,
  
  -- Campos calculados dinámicamente por trigger
  stock_previo numeric NOT NULL DEFAULT 0,
  stock_resultante numeric NOT NULL DEFAULT 0,
  
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_public_access" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

-- 2. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_stock_movements_producto_id ON public.stock_movements (producto_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_event_master_id ON public.stock_movements (event_master_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements (created_at DESC);

-- 3. FUNCIÓN Y TRIGGER: BEFORE INSERT (Calcular Stock Previo y Resultante con Bloqueo Seguro)
-- Para evitar condiciones de carrera, bloqueamos la fila del producto (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.fn_calculate_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_actual numeric;
BEGIN
  -- Obtener el stock_actual del producto y bloquear la fila para evitar concurrencia (Race Conditions)
  SELECT COALESCE(stock_actual, 0) INTO v_stock_actual
  FROM public.productos
  WHERE id = NEW.producto_id
  FOR UPDATE;

  -- Asignar el stock previo y resultante al movimiento
  NEW.stock_previo := v_stock_actual;
  NEW.stock_resultante := v_stock_actual + NEW.cantidad;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_before_insert_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_before_insert_stock_movement
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_calculate_stock_movement();

-- 4. FUNCIÓN Y TRIGGER: AFTER INSERT (Actualizar Tabla Productos)
CREATE OR REPLACE FUNCTION public.fn_update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizamos la tabla productos automáticamente
  UPDATE public.productos
  SET 
    stock_anterior = NEW.stock_previo,
    stock_actual = NEW.stock_resultante
  WHERE id = NEW.producto_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_insert_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_after_insert_stock_movement
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_product_stock();
