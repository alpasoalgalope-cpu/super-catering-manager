-- ============================================================
-- MIGRACIÓN DE REINICIO DE STOCK: Blanqueo a Cero para Base Real
-- ============================================================

-- 1. Vaciar todo el historial de movimientos de stock (trazabilidad)
TRUNCATE TABLE public.stock_movements RESTART IDENTITY CASCADE;

-- 2. Restablecer el stock actual y anterior a cero para todos los productos
UPDATE public.productos
SET stock_actual = 0,
    stock_anterior = 0;
