-- Migration: Add crew_count to event_bus_assignments
ALTER TABLE public.event_bus_assignments
ADD COLUMN IF NOT EXISTS crew_count integer DEFAULT 0;

COMMENT ON COLUMN public.event_bus_assignments.crew_count IS 'Número de tripulación (liberados) asociados a este micro.';
