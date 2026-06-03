-- ============================================================
-- MIGRACIÓN: Habilitar RLS y Políticas de Acceso para event_satisfaction
-- ============================================================

ALTER TABLE public.event_satisfaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_satisfaction_public_access" ON public.event_satisfaction 
  FOR ALL USING (true) WITH CHECK (true);
