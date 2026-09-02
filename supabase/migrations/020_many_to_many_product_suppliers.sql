-- 1. Creación de la tabla intermedia producto_proveedores
CREATE TABLE IF NOT EXISTS public.producto_proveedores (
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (producto_id, proveedor_id)
);

-- 2. Habilitar RLS y políticas de acceso
ALTER TABLE public.producto_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "producto_proveedores_public_access" ON public.producto_proveedores
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Script de migración de datos para copiar proveedores existentes
INSERT INTO public.producto_proveedores (producto_id, proveedor_id)
SELECT id, proveedor_id
FROM public.productos
WHERE proveedor_id IS NOT NULL
ON CONFLICT (producto_id, proveedor_id) DO NOTHING;

-- 4. Creación del trigger para sincronizar el proveedor principal
CREATE OR REPLACE FUNCTION public.sync_product_primary_provider()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proveedor_id IS NOT NULL THEN
    INSERT INTO public.producto_proveedores (producto_id, proveedor_id)
    VALUES (NEW.id, NEW.proveedor_id)
    ON CONFLICT (producto_id, proveedor_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_primary_provider ON public.productos;

CREATE TRIGGER trg_sync_product_primary_provider
AFTER INSERT OR UPDATE OF proveedor_id ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_primary_provider();
