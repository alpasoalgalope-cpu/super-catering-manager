-- MIGRACIÓN: Agregar coordinator_id a event_sales_units para reporte preciso
ALTER TABLE public.event_sales_units 
ADD COLUMN IF NOT EXISTS coordinator_id uuid REFERENCES public.coordinators(id);

COMMENT ON COLUMN public.event_sales_units.coordinator_id IS 'Coordinador específico asignado a esta unidad/micro al momento de la venta.';
