-- ============================================================
-- MIGRACIÓN DE LIMPIEZA: Corrección de Rindes (Merma) y Ajuste de Stock
-- ============================================================

-- 1. Caso A: Insumos creados vía RPC con escala porcentual (rinde > 1.0) -> Dividir por 100
UPDATE public.productos
SET factor_merma = factor_merma / 100
WHERE factor_merma > 1.0;

-- 2. Caso B: Insumos con merma real afectados por doble división (rinde < 0.01) -> Multiplicar por 100
UPDATE public.productos
SET factor_merma = factor_merma * 100
WHERE factor_merma < 0.01 AND factor_merma > 0 AND nombre NOT ILIKE '%Agua%' AND nombre NOT ILIKE '%Servilleta%';

-- 3. Caso C: Insumos de reventa o insumos directos que deben rendir 100% (rinde = 0.01) -> Restablecer a 1.0
UPDATE public.productos
SET factor_merma = 1.0
WHERE factor_merma = 0.01 AND (nombre ILIKE '%Agua%' OR nombre ILIKE '%Servilleta%');
