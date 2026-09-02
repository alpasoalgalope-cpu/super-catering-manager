-- ============================================================
-- MIGRACIÓN 031: PERMITIR LECTURA Y GESTIÓN DE TIENDAS ONLINE (ACTIVAS Y PAUSADAS)
-- ============================================================
-- Corrige la política para que las tiendas pausadas (is_active = false)
-- no sean ocultadas por RLS al consultar desde el dashboard o la tienda.

ALTER TABLE public.online_store_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active store events" ON public.online_store_events;
DROP POLICY IF EXISTS "online_store_events_anon_select" ON public.online_store_events;
DROP POLICY IF EXISTS "online_store_events_auth_all" ON public.online_store_events;
DROP POLICY IF EXISTS "online_store_events_all_access" ON public.online_store_events;
DROP POLICY IF EXISTS "online_store_events_select" ON public.online_store_events;
DROP POLICY IF EXISTS "online_store_events_manage" ON public.online_store_events;

-- Permitir lectura a todos (para que tiendas pausadas muestren el cartel de pausa y el dashboard las liste)
CREATE POLICY "online_store_events_select" ON public.online_store_events 
  FOR SELECT USING (true);

-- Permitir creación y edición a usuarios autenticados y anon (server actions)
CREATE POLICY "online_store_events_manage" ON public.online_store_events 
  FOR ALL USING (true) WITH CHECK (true);

-- Clientes online
ALTER TABLE public.online_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "online_customers_all" ON public.online_customers;
CREATE POLICY "online_customers_all" ON public.online_customers 
  FOR ALL USING (true) WITH CHECK (true);

-- Órdenes online
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "online_orders_all" ON public.online_orders;
CREATE POLICY "online_orders_all" ON public.online_orders 
  FOR ALL USING (true) WITH CHECK (true);
