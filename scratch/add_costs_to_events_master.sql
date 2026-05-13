-- MIGRACIÓN: Agregar campos de costos a events_master
-- Ejecutar este script en el SQL Editor de Supabase

ALTER TABLE public.events_master 
ADD COLUMN IF NOT EXISTS logistics_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS extras_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commissions_cost numeric DEFAULT 0;

COMMENT ON COLUMN public.events_master.logistics_cost IS 'Costo de logística auto-calculado o manual para este evento.';
COMMENT ON COLUMN public.events_master.extras_cost IS 'Costos extras (gastos adicionales) del evento.';
COMMENT ON COLUMN public.events_master.commissions_cost IS 'Costos de comisiones pagadas por este evento.';
