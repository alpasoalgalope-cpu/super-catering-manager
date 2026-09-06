-- 033_legajos_documentos_and_certificados.sql
-- Tabla para almacenar documentos del legajo (ARCA F.931, Altas, ART, Seguros) con links a Google Drive

CREATE TABLE IF NOT EXISTS public.legajos_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- 'arca_931', 'alta_temprana', 'art', 'seguro_vida', 'certificado_medico', 'otro'
  titulo TEXT NOT NULL,
  periodo VARCHAR(50), -- Formato 'YYYY-MM' o descripción
  archivo_url TEXT NOT NULL,
  archivo_id_drive TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.legajos_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins control total legajos_documentos" ON public.legajos_documentos;
DROP POLICY IF EXISTS "Empleados ven sus propios documentos" ON public.legajos_documentos;

CREATE POLICY "Admins control total legajos_documentos" ON public.legajos_documentos FOR ALL USING (public.es_admin());
CREATE POLICY "Empleados ven sus propios documentos" ON public.legajos_documentos FOR SELECT USING (profile_id = auth.uid());

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS comprobante_drive_id TEXT;
