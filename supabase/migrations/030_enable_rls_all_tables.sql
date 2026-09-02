-- ============================================================
-- MIGRACIÓN 030: HABILITAR RLS Y POLÍTICAS EN EL 100% DE LAS TABLAS
-- ============================================================
-- Protege todas las tablas públicas contra accesos no autorizados,
-- garantizando que solo usuarios autenticados puedan modificar datos.
-- ============================================================

-- 1. CLIENTES Y EMPRESAS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_auth_all" ON public.clients;
CREATE POLICY "clients_auth_all" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "clients_anon_select" ON public.clients;
CREATE POLICY "clients_anon_select" ON public.clients FOR SELECT TO anon USING (true);

-- 2. VEHÍCULOS / FLOTA
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicles_auth_all" ON public.vehicles;
CREATE POLICY "vehicles_auth_all" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "vehicles_anon_select" ON public.vehicles;
CREATE POLICY "vehicles_anon_select" ON public.vehicles FOR SELECT TO anon USING (true);

-- 3. COORDINADORES
ALTER TABLE public.coordinators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coordinators_auth_all" ON public.coordinators;
CREATE POLICY "coordinators_auth_all" ON public.coordinators FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "coordinators_anon_select" ON public.coordinators;
CREATE POLICY "coordinators_anon_select" ON public.coordinators FOR SELECT TO anon USING (true);

-- 4. REGLAS COMERCIALES Y PRECIOS
ALTER TABLE public.commercial_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial_rules_auth_all" ON public.commercial_rules;
CREATE POLICY "commercial_rules_auth_all" ON public.commercial_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "commercial_rules_anon_select" ON public.commercial_rules;
CREATE POLICY "commercial_rules_anon_select" ON public.commercial_rules FOR SELECT TO anon USING (true);

-- 5. CABECERAS DE VENTAS POR EVENTO
ALTER TABLE public.event_sales_headers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_sales_headers_auth_all" ON public.event_sales_headers;
CREATE POLICY "event_sales_headers_auth_all" ON public.event_sales_headers FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "event_sales_headers_anon_select" ON public.event_sales_headers;
CREATE POLICY "event_sales_headers_anon_select" ON public.event_sales_headers FOR SELECT TO anon USING (true);

-- 6. UNIDADES Y DETALLES DE VENTAS POR EVENTO
ALTER TABLE public.event_sales_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_sales_units_auth_all" ON public.event_sales_units;
CREATE POLICY "event_sales_units_auth_all" ON public.event_sales_units FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "event_sales_units_anon_select" ON public.event_sales_units;
CREATE POLICY "event_sales_units_anon_select" ON public.event_sales_units FOR SELECT TO anon USING (true);

-- 7. TABLAS DE CATÁLOGO Y CONFIGURACIÓN
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_settings') THEN
        ALTER TABLE public.product_settings ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "product_settings_auth_all" ON public.product_settings;
        CREATE POLICY "product_settings_auth_all" ON public.product_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "product_settings_anon_select" ON public.product_settings;
        CREATE POLICY "product_settings_anon_select" ON public.product_settings FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pricing_rules') THEN
        ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "pricing_rules_auth_all" ON public.pricing_rules;
        CREATE POLICY "pricing_rules_auth_all" ON public.pricing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "pricing_rules_anon_select" ON public.pricing_rules;
        CREATE POLICY "pricing_rules_anon_select" ON public.pricing_rules FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'free_meals') THEN
        ALTER TABLE public.free_meals ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "free_meals_auth_all" ON public.free_meals;
        CREATE POLICY "free_meals_auth_all" ON public.free_meals FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "free_meals_anon_select" ON public.free_meals;
        CREATE POLICY "free_meals_anon_select" ON public.free_meals FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'free_meal_rules') THEN
        ALTER TABLE public.free_meal_rules ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "free_meal_rules_auth_all" ON public.free_meal_rules;
        CREATE POLICY "free_meal_rules_auth_all" ON public.free_meal_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "free_meal_rules_anon_select" ON public.free_meal_rules;
        CREATE POLICY "free_meal_rules_anon_select" ON public.free_meal_rules FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sandwich_catalog') THEN
        ALTER TABLE public.sandwich_catalog ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "sandwich_catalog_auth_all" ON public.sandwich_catalog;
        CREATE POLICY "sandwich_catalog_auth_all" ON public.sandwich_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "sandwich_catalog_anon_select" ON public.sandwich_catalog;
        CREATE POLICY "sandwich_catalog_anon_select" ON public.sandwich_catalog FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
        ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "events_auth_all" ON public.events;
        CREATE POLICY "events_auth_all" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "events_anon_select" ON public.events;
        CREATE POLICY "events_anon_select" ON public.events FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buses') THEN
        ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "buses_auth_all" ON public.buses;
        CREATE POLICY "buses_auth_all" ON public.buses FOR ALL TO authenticated USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "buses_anon_select" ON public.buses;
        CREATE POLICY "buses_anon_select" ON public.buses FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recitales_staging') THEN
        ALTER TABLE public.recitales_staging ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "recitales_staging_auth_all" ON public.recitales_staging;
        CREATE POLICY "recitales_staging_auth_all" ON public.recitales_staging FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
