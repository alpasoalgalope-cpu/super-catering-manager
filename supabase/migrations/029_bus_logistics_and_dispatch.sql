-- ============================================================
-- MIGRACIÓN 029: MÓDULO DE LOGÍSTICA DE ÚLTIMA MILLA, CHECK-IN Y DESPACHO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bus_logistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_master_id UUID NOT NULL REFERENCES public.events_master(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    company_name TEXT,
    bus_identifier TEXT NOT NULL,
    coordinator_name TEXT,
    coordinator_phone TEXT,
    location_lat NUMERIC(10, 7),
    location_lng NUMERIC(10, 7),
    location_reference TEXT,
    status TEXT NOT NULL DEFAULT 'en_viaje' CHECK (status IN ('en_viaje', 'estacionado', 'entregado', 'incidencia')),
    token_access TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    pin_confirmation VARCHAR(4),
    checkin_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast token lookups and event filtering
CREATE INDEX IF NOT EXISTS idx_bus_logistics_token ON public.bus_logistics(token_access);
CREATE INDEX IF NOT EXISTS idx_bus_logistics_event ON public.bus_logistics(event_master_id);

-- Alter online_orders to link each order directly to a bus_logistics record
ALTER TABLE public.online_orders 
    ADD COLUMN IF NOT EXISTS bus_logistic_id UUID REFERENCES public.bus_logistics(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.bus_logistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS bus_logistics_auth_all ON public.bus_logistics;
CREATE POLICY bus_logistics_auth_all ON public.bus_logistics 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS bus_logistics_anon_select ON public.bus_logistics;
CREATE POLICY bus_logistics_anon_select ON public.bus_logistics 
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS bus_logistics_anon_update ON public.bus_logistics;
CREATE POLICY bus_logistics_anon_update ON public.bus_logistics 
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS bus_logistics_anon_insert ON public.bus_logistics;
CREATE POLICY bus_logistics_anon_insert ON public.bus_logistics 
    FOR INSERT TO anon WITH CHECK (true);
