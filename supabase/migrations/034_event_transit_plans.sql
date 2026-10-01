-- ============================================================
-- MIGRACIÓN 034: PLANIFICACIÓN Y ESTIMACIÓN DE TRÁNSITO LOGÍSTICO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_transit_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_master_id UUID NOT NULL REFERENCES public.events_master(id) ON DELETE CASCADE UNIQUE,
    kitchen_address TEXT NOT NULL DEFAULT 'Coronel Belgrano 2429, Munro, Provincia de Buenos Aires',
    kitchen_call_time TEXT NOT NULL DEFAULT '19:00',
    loading_time_minutes INTEGER NOT NULL DEFAULT 15,
    kitchen_departure_time TEXT NOT NULL DEFAULT '19:15',
    modality TEXT NOT NULL DEFAULT 'DESPACHO_PARALELO' CHECK (modality IN ('DESPACHO_PARALELO', 'DEDICADA_SECUENCIAL_SERGIO')),
    discharge_time_minutes INTEGER NOT NULL DEFAULT 12,
    travel_mode TEXT NOT NULL DEFAULT 'DRIVE' CHECK (travel_mode IN ('DRIVE', 'TWO_WHEELER')),
    stops_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    itinerary_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookup by event_master_id
CREATE INDEX IF NOT EXISTS idx_event_transit_plans_event ON public.event_transit_plans(event_master_id);

-- Enable RLS
ALTER TABLE public.event_transit_plans ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if any
DROP POLICY IF EXISTS event_transit_plans_auth_all ON public.event_transit_plans;
DROP POLICY IF EXISTS event_transit_plans_anon_all ON public.event_transit_plans;
DROP POLICY IF EXISTS event_transit_plans_public_read ON public.event_transit_plans;

-- RLS Policies: Allow authenticated users full CRUD
CREATE POLICY event_transit_plans_auth_all ON public.event_transit_plans
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon read and write to avoid blockers in dev / driver / public links
CREATE POLICY event_transit_plans_anon_all ON public.event_transit_plans
    FOR ALL TO anon USING (true) WITH CHECK (true);
