-- ============================================================
-- MIGRACIÓN: Módulo de Tesorería (OC, Ventas, Servicios y Contrasientos)
-- ============================================================

-- 1. Modificar Órdenes de Compra para gestión de pagos
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS estado_pago text DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado', 'parcial')),
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_pago date,
  ADD COLUMN IF NOT EXISTS monto_pagado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plazo_pago text;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_estado_pago ON public.purchase_orders (estado_pago);

-- 2. Modificar Cabeceras de Venta para gestión de cobros
ALTER TABLE public.event_sales_headers
  ADD COLUMN IF NOT EXISTS estado_cobro text DEFAULT 'pendiente' CHECK (estado_cobro IN ('pendiente', 'cobrado', 'parcial')),
  ADD COLUMN IF NOT EXISTS fecha_cobro date,
  ADD COLUMN IF NOT EXISTS monto_cobrado numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_event_sales_headers_estado_cobro ON public.event_sales_headers (estado_cobro);

-- 3. Crear tabla de Servicios Contratados
CREATE TABLE IF NOT EXISTS public.servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  proveedor text,
  monto_estimado numeric NOT NULL DEFAULT 0,
  dia_vencimiento_habitual integer NOT NULL CHECK (dia_vencimiento_habitual >= 1 AND dia_vencimiento_habitual <= 31),
  concept_id uuid REFERENCES public.cash_concepts(id) ON DELETE SET NULL,
  subconcept_id uuid REFERENCES public.cash_subconcepts(id) ON DELETE SET NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS para servicios
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "servicios_all_access" ON public.servicios;
CREATE POLICY "servicios_all_access" ON public.servicios FOR ALL USING (true) WITH CHECK (true);

-- 4. Crear tabla de Vencimientos Mensuales de Servicios
CREATE TABLE IF NOT EXISTS public.vencimientos_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid REFERENCES public.servicios(id) ON DELETE CASCADE NOT NULL,
  mes_periodo text NOT NULL, -- Formato 'YYYY-MM'
  fecha_vencimiento date NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  estado_pago text DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado', 'vencido')),
  fecha_pago date,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_servicio_periodo UNIQUE (servicio_id, mes_periodo)
);

-- Habilitar RLS para vencimientos_servicios
ALTER TABLE public.vencimientos_servicios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vencimientos_servicios_all_access" ON public.vencimientos_servicios;
CREATE POLICY "vencimientos_servicios_all_access" ON public.vencimientos_servicios FOR ALL USING (true) WITH CHECK (true);

-- 5. Agregar relaciones de conciliación en caja (cash_movements)
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_sales_header_id uuid REFERENCES public.event_sales_headers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vencimiento_servicio_id uuid REFERENCES public.vencimientos_servicios(id) ON DELETE SET NULL;

ALTER TABLE public.vencimientos_servicios
  ADD COLUMN IF NOT EXISTS cash_movement_id uuid REFERENCES public.cash_movements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_po ON public.cash_movements (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_sale ON public.cash_movements (event_sales_header_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_service ON public.cash_movements (vencimiento_servicio_id);

-- ============================================================
-- FUNCIONES ALMACENADAS (RPC) - TRANSACCIONALIDAD ATÓMICA
-- ============================================================

-- A. REGISTRAR PAGO DE ORDEN DE COMPRA
CREATE OR REPLACE FUNCTION public.registrar_pago_po(
  p_po_id uuid,
  p_monto numeric,
  p_fecha date,
  p_subconcept_id uuid,
  p_generar_caja boolean,
  p_detalle text
) RETURNS uuid AS $$
DECLARE
  v_costo_total numeric;
  v_monto_pagado numeric;
  v_proveedor_nombre text;
  v_concept_id uuid;
  v_subconcept_name text;
  v_movement_id uuid := NULL;
  v_hash_id text;
  v_mes text;
BEGIN
  -- Obtener datos de la Orden de Compra
  SELECT po.costo_total, po.monto_pagado, prov.nombre
  INTO v_costo_total, v_monto_pagado, v_proveedor_nombre
  FROM public.purchase_orders po
  JOIN public.proveedores prov ON po.proveedor_id = prov.id
  WHERE po.id = p_po_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada';
  END IF;

  v_monto_pagado := COALESCE(v_monto_pagado, 0) + p_monto;

  -- Actualizar la Orden de Compra
  UPDATE public.purchase_orders
  SET 
    monto_pagado = v_monto_pagado,
    estado_pago = CASE 
      WHEN v_monto_pagado >= v_costo_total THEN 'pagado'
      WHEN v_monto_pagado > 0 THEN 'parcial'
      ELSE 'pendiente'
    END
  WHERE id = p_po_id;

  -- Registrar en caja si es Modalidad A (Pago Directo)
  IF p_generar_caja THEN
    SELECT id INTO v_concept_id FROM public.cash_concepts WHERE name = 'Materia Prima';
    SELECT name INTO v_subconcept_name FROM public.cash_subconcepts WHERE id = p_subconcept_id;

    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('po_pay_', p_po_id::text, '_', p_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      fecha,
      mes,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      purchase_order_id,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'Materia Prima',
      v_concept_id,
      p_subconcept_id,
      v_subconcept_name,
      COALESCE(p_detalle, concat('Pago a ', v_proveedor_nombre)),
      -p_monto, -- Negativo para egreso
      p_po_id,
      v_hash_id
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- B. REVERTIR PAGO DE ORDEN DE COMPRA (CONTRASIENTO O DESVINCULACIÓN)
CREATE OR REPLACE FUNCTION public.revertir_pago_po(
  p_po_id uuid,
  p_movement_id uuid,
  p_fecha date,
  p_detalle text
) RETURNS void AS $$
DECLARE
  v_monto numeric;
  v_po_monto_pagado numeric;
  v_po_costo_total numeric;
  v_hash_id text;
  v_orig_hash_id text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_subconcept_name text;
  v_mes text;
BEGIN
  SELECT ABS(importe), hash_id, concept_id, subconcept_id, conc_caja
  INTO v_monto, v_orig_hash_id, v_concept_id, v_subconcept_id, v_subconcept_name
  FROM public.cash_movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de caja no encontrado';
  END IF;

  IF v_orig_hash_id LIKE 'po_pay_%' THEN
    -- Modalidad A: Generar contrasiento compensatorio
    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('po_rev_', p_po_id::text, '_', v_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      fecha,
      mes,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      purchase_order_id,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'Materia Prima',
      v_concept_id,
      v_subconcept_id,
      v_subconcept_name,
      COALESCE(p_detalle, 'Contrasiento por reversión de pago OC'),
      v_monto, -- Positivo para compensar
      p_po_id,
      v_hash_id
    );
  ELSE
    -- Modalidad B: Desvincular movimiento Maxirest sin contrasiento
    UPDATE public.cash_movements
    SET purchase_order_id = NULL
    WHERE id = p_movement_id;
  END IF;

  -- Actualizar comprobante
  SELECT costo_total, monto_pagado INTO v_po_costo_total, v_po_monto_pagado
  FROM public.purchase_orders
  WHERE id = p_po_id;

  v_po_monto_pagado := GREATEST(0, COALESCE(v_po_monto_pagado, 0) - v_monto);

  UPDATE public.purchase_orders
  SET 
    monto_pagado = v_po_monto_pagado,
    estado_pago = CASE 
      WHEN v_po_monto_pagado >= v_po_costo_total THEN 'pagado'
      WHEN v_po_monto_pagado > 0 THEN 'parcial'
      ELSE 'pendiente'
    END
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- C. REGISTRAR COBRO DE VENTA
CREATE OR REPLACE FUNCTION public.registrar_cobro_venta(
  p_header_id uuid,
  p_monto numeric,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text
) RETURNS uuid AS $$
DECLARE
  v_total_amount numeric;
  v_monto_cobrado numeric;
  v_company_name text;
  v_show_name text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_movement_id uuid := NULL;
  v_hash_id text;
  v_mes text;
BEGIN
  -- Obtener datos de la Venta
  SELECT esh.total_amount, esh.monto_cobrado, esh.company_name, em.show_name
  INTO v_total_amount, v_monto_cobrado, v_company_name, v_show_name
  FROM public.event_sales_headers esh
  JOIN public.events_master em ON esh.event_master_id = em.id
  WHERE esh.id = p_header_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  v_monto_cobrado := COALESCE(v_monto_cobrado, 0) + p_monto;

  UPDATE public.event_sales_headers
  SET 
    monto_cobrado = v_monto_cobrado,
    estado_cobro = CASE 
      WHEN v_monto_cobrado >= v_total_amount THEN 'cobrado'
      WHEN v_monto_cobrado > 0 THEN 'parcial'
      ELSE 'pendiente'
    END
  WHERE id = p_header_id;

  -- Registrar en caja si es Pago Directo
  IF p_generar_caja THEN
    SELECT id INTO v_concept_id FROM public.cash_concepts WHERE name = 'VENTAS';
    SELECT id INTO v_subconcept_id FROM public.cash_subconcepts WHERE name = 'Ventas' AND concept_id = v_concept_id;

    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('sale_col_', p_header_id::text, '_', p_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      fecha,
      mes,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      event_sales_header_id,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'VENTAS',
      v_concept_id,
      v_subconcept_id,
      'Ventas',
      COALESCE(p_detalle, concat('Cobro Venta Show: ', v_show_name, ' (', v_company_name, ')')),
      p_monto, -- Positivo para ingreso
      p_header_id,
      v_hash_id
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- D. REVERTIR COBRO DE VENTA
CREATE OR REPLACE FUNCTION public.revertir_cobro_venta(
  p_header_id uuid,
  p_movement_id uuid,
  p_fecha date,
  p_detalle text
) RETURNS void AS $$
DECLARE
  v_monto numeric;
  v_total_amount numeric;
  v_monto_cobrado numeric;
  v_hash_id text;
  v_orig_hash_id text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_mes text;
BEGIN
  SELECT ABS(importe), hash_id, concept_id, subconcept_id
  INTO v_monto, v_orig_hash_id, v_concept_id, v_subconcept_id
  FROM public.cash_movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de caja no encontrado';
  END IF;

  IF v_orig_hash_id LIKE 'sale_col_%' THEN
    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('sale_rev_', p_header_id::text, '_', v_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      fecha,
      mes,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      event_sales_header_id,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'VENTAS',
      v_concept_id,
      v_subconcept_id,
      'Ventas',
      COALESCE(p_detalle, 'Contrasiento por reversión de cobro'),
      -v_monto, -- Negativo para compensar
      p_header_id,
      v_hash_id
    );
  ELSE
    UPDATE public.cash_movements
    SET event_sales_header_id = NULL
    WHERE id = p_movement_id;
  END IF;

  SELECT total_amount, monto_cobrado INTO v_total_amount, v_monto_cobrado
  FROM public.event_sales_headers
  WHERE id = p_header_id;

  v_monto_cobrado := GREATEST(0, COALESCE(v_monto_cobrado, 0) - v_monto);

  UPDATE public.event_sales_headers
  SET 
    monto_cobrado = v_monto_cobrado,
    estado_cobro = CASE 
      WHEN v_monto_cobrado >= v_total_amount THEN 'cobrado'
      WHEN v_monto_cobrado > 0 THEN 'parcial'
      ELSE 'pendiente'
    END
  WHERE id = p_header_id;
END;
$$ LANGUAGE plpgsql;

-- E. REGISTRAR PAGO DE SERVICIO
CREATE OR REPLACE FUNCTION public.registrar_pago_servicio(
  p_vencimiento_id uuid,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text
) RETURNS uuid AS $$
DECLARE
  v_monto numeric;
  v_servicio_id uuid;
  v_servicio_nombre text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_subconcept_name text;
  v_movement_id uuid := NULL;
  v_hash_id text;
  v_mes text;
BEGIN
  -- Obtener datos del vencimiento del servicio
  SELECT vs.monto, vs.servicio_id, s.nombre, s.concept_id, s.subconcept_id
  INTO v_monto, v_servicio_id, v_servicio_nombre, v_concept_id, v_subconcept_id
  FROM public.vencimientos_servicios vs
  JOIN public.servicios s ON vs.servicio_id = s.id
  WHERE vs.id = p_vencimiento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento de servicio no encontrado';
  END IF;

  -- Actualizar vencimiento
  UPDATE public.vencimientos_servicios
  SET 
    estado_pago = 'pagado',
    fecha_pago = p_fecha
  WHERE id = p_vencimiento_id;

  -- Registrar en caja si corresponde
  IF p_generar_caja THEN
    -- Obtener nombre del subconcepto
    SELECT name INTO v_subconcept_name FROM public.cash_subconcepts WHERE id = v_subconcept_id;

    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('serv_pay_', p_vencimiento_id::text, '_', v_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      fecha,
      mes,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      vencimiento_servicio_id,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'Servicios',
      v_concept_id,
      v_subconcept_id,
      v_subconcept_name,
      COALESCE(p_detalle, concat('Pago Servicio: ', v_servicio_nombre)),
      -v_monto, -- Negativo para egreso
      p_vencimiento_id,
      v_hash_id
    ) RETURNING id INTO v_movement_id;

    -- Vincular en el vencimiento
    UPDATE public.vencimientos_servicios
    SET cash_movement_id = v_movement_id
    WHERE id = p_vencimiento_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- F. REVERTIR PAGO DE SERVICIO
CREATE OR REPLACE FUNCTION public.revertir_pago_servicio(
  p_vencimiento_id uuid,
  p_fecha date,
  p_detalle text
) RETURNS void AS $$
DECLARE
  v_movement_id uuid;
  v_monto numeric;
  v_hash_id text;
  v_orig_hash_id text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_subconcept_name text;
  v_mes text;
BEGIN
  SELECT cash_movement_id, monto INTO v_movement_id, v_monto
  FROM public.vencimientos_servicios
  WHERE id = p_vencimiento_id;

  IF v_movement_id IS NOT NULL THEN
    SELECT hash_id, concept_id, subconcept_id, conc_caja
    INTO v_orig_hash_id, v_concept_id, v_subconcept_id, v_subconcept_name
    FROM public.cash_movements
    WHERE id = v_movement_id;

    IF FOUND THEN
      IF v_orig_hash_id LIKE 'serv_pay_%' THEN
        v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
        v_hash_id := md5(concat('serv_rev_', p_vencimiento_id::text, '_', v_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

        INSERT INTO public.cash_movements (
          fecha,
          mes,
          concepto,
          concept_id,
          subconcept_id,
          conc_caja,
          detalle,
          importe,
          vencimiento_servicio_id,
          hash_id
        ) VALUES (
          p_fecha,
          v_mes,
          'Servicios',
          v_concept_id,
          v_subconcept_id,
          v_subconcept_name,
          COALESCE(p_detalle, 'Contrasiento por reversión de pago de servicio'),
          v_monto, -- Positivo para compensar
          p_vencimiento_id,
          v_hash_id
        );
      ELSE
        UPDATE public.cash_movements
        SET vencimiento_servicio_id = NULL
        WHERE id = v_movement_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.vencimientos_servicios
  SET 
    estado_pago = 'pendiente',
    fecha_pago = NULL,
    cash_movement_id = NULL
  WHERE id = p_vencimiento_id;
END;
$$ LANGUAGE plpgsql;

-- G. GENERAR VENCIMIENTOS MENSUALES DE SERVICIOS (PLANTILLAS)
CREATE OR REPLACE FUNCTION public.generar_vencimientos_mensuales(
  p_periodo text -- Formato 'YYYY-MM'
) RETURNS void AS $$
DECLARE
  v_rec record;
  v_due_date date;
  v_year integer;
  v_month integer;
  v_last_day integer;
  v_day integer;
BEGIN
  v_year := split_part(p_periodo, '-', 1)::integer;
  v_month := split_part(p_periodo, '-', 2)::integer;
  
  -- Calcular el último día del mes
  v_last_day := to_char((date_trunc('month', make_date(v_year, v_month, 1)) + interval '1 month' - interval '1 day'), 'DD')::integer;

  FOR v_rec IN 
    SELECT id, monto_estimado, dia_vencimiento_habitual 
    FROM public.servicios 
    WHERE activo = true
  LOOP
    -- Ajustar el día si excede el fin de mes (ej: Feb 30 -> Feb 28)
    v_day := LEAST(v_rec.dia_vencimiento_habitual, v_last_day);
    v_due_date := make_date(v_year, v_month, v_day);

    INSERT INTO public.vencimientos_servicios (
      servicio_id,
      mes_periodo,
      fecha_vencimiento,
      monto,
      estado_pago
    ) VALUES (
      v_rec.id,
      p_periodo,
      v_due_date,
      v_rec.monto_estimado,
      'pendiente'
    ) ON CONFLICT (servicio_id, mes_periodo) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
