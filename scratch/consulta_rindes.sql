-- ============================================================
-- SCRIPT DE CONSULTA DE PRODUCTOS Y SUS RENDIMIENTOS (RINDES)
-- ============================================================

SELECT 
  id,
  nombre AS "Producto",
  categoria AS "Categoría",
  unidad_medida AS "Unidad",
  factor_merma AS "Rinde (Decimal)",
  ROUND((factor_merma * 100)::numeric, 1) || '%' AS "Rinde (Porcentaje)",
  stock_actual AS "Stock Actual"
FROM public.productos
ORDER BY nombre ASC;
