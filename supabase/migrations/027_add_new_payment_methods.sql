-- ============================================================
-- MIGRACIÓN: Nuevas formas de pago (Tarjeta de Crédito, Pago Fer, Pago Gaston)
-- ============================================================

-- 1. Actualizar el CHECK constraint en cash_movements
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        WHERE cl.relname = 'cash_movements'
          AND ns.nspname = 'public'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%cuenta_bancaria%'
    LOOP
        EXECUTE 'ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.cash_movements
  ADD CONSTRAINT check_cash_movements_cuenta_bancaria
  CHECK (cuenta_bancaria IN ('mercado pago', 'banco galicia', 'efectivo', 'tarjeta de credito', 'pago fer', 'pago gaston'));

-- 2. Actualizar las funciones RPC para aceptar las nuevas cuentas

-- A. registrar_pago_po
CREATE OR REPLACE FUNCTION public.registrar_pago_po(
  p_po_id uuid,
  p_subconcept_id uuid,
  p_monto numeric,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text,
  p_cuenta_bancaria text DEFAULT 'efectivo'
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
  -- Validar cuenta bancaria
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo', 'tarjeta de credito', 'pago fer', 'pago gaston') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia, efectivo, tarjeta de credito, pago fer o pago gaston';
  END IF;

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
      cuenta_bancaria,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'Materia Prima',
      v_concept_id,
      p_subconcept_id,
      v_subconcept_name,
      COALESCE(p_detalle, concat('Pago PO: ', v_proveedor_nombre)),
      -p_monto, -- Negativo para egreso
      p_po_id,
      p_cuenta_bancaria,
      v_hash_id
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- B. registrar_cobro_venta
CREATE OR REPLACE FUNCTION public.registrar_cobro_venta(
  p_header_id uuid,
  p_monto numeric,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text,
  p_cuenta_bancaria text DEFAULT 'efectivo'
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
  -- Validar cuenta bancaria
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo', 'tarjeta de credito', 'pago fer', 'pago gaston') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia, efectivo, tarjeta de credito, pago fer o pago gaston';
  END IF;

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

  -- Registrar en caja si corresponde
  IF p_generar_caja THEN
    SELECT id INTO v_concept_id FROM public.cash_concepts WHERE name = 'VENTAS';
    SELECT id INTO v_subconcept_id FROM public.cash_subconcepts WHERE name = 'Ventas' AND concept_id = v_concept_id;

    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('sale_col_', p_header_id::text, '_', p_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      sucursal,
      mes,
      fecha,
      semana,
      turno,
      tipo,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      event_sales_header_id,
      cuenta_bancaria,
      esrecu,
      oculta,
      rubro,
      hash_id
    ) VALUES (
      'Galope Bustamante',
      v_mes,
      p_fecha,
      '1',
      'Sin Turno',
      'Ingreso',
      'VENTAS',
      v_concept_id,
      v_subconcept_id,
      'Ventas',
      COALESCE(p_detalle, concat('Cobro Venta Show: ', v_show_name)),
      p_monto, -- Positivo para ingreso
      p_header_id,
      p_cuenta_bancaria,
      'manual',
      'no',
      'VENTAS',
      v_hash_id
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- C. registrar_pago_servicio
CREATE OR REPLACE FUNCTION public.registrar_pago_servicio(
  p_vencimiento_id uuid,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text,
  p_cuenta_bancaria text DEFAULT 'efectivo'
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
  -- Validar cuenta bancaria
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo', 'tarjeta de credito', 'pago fer', 'pago gaston') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia, efectivo, tarjeta de credito, pago fer o pago gaston';
  END IF;

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
      cuenta_bancaria,
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
      p_cuenta_bancaria,
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

-- D. registrar_pago_impuesto
CREATE OR REPLACE FUNCTION public.registrar_pago_impuesto(
  p_vencimiento_id uuid,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text,
  p_cuenta_bancaria text DEFAULT 'efectivo'
) RETURNS uuid AS $$
DECLARE
  v_monto numeric;
  v_impuesto_id uuid;
  v_impuesto_nombre text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_subconcept_name text;
  v_movement_id uuid := NULL;
  v_hash_id text;
  v_mes text;
BEGIN
  -- Validar cuenta bancaria
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo', 'tarjeta de credito', 'pago fer', 'pago gaston') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia, efectivo, tarjeta de credito, pago fer o pago gaston';
  END IF;

  -- Obtener datos del vencimiento del impuesto
  SELECT vi.monto, vi.impuesto_id, i.nombre, i.concept_id, i.subconcept_id
  INTO v_monto, v_impuesto_id, v_impuesto_nombre, v_concept_id, v_subconcept_id
  FROM public.vencimientos_impuestos vi
  JOIN public.impuestos i ON vi.impuesto_id = i.id
  WHERE vi.id = p_vencimiento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento de impuesto no encontrado';
  END IF;

  -- Actualizar vencimiento
  UPDATE public.vencimientos_impuestos
  SET 
    estado_pago = 'pagado',
    fecha_pago = p_fecha
  WHERE id = p_vencimiento_id;

  -- Registrar en caja si corresponde
  IF p_generar_caja THEN
    SELECT name INTO v_subconcept_name FROM public.cash_subconcepts WHERE id = v_subconcept_id;

    v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
    v_hash_id := md5(concat('tax_pay_', p_vencimiento_id::text, '_', v_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

    INSERT INTO public.cash_movements (
      fecha,
      mes,
      concepto,
      concept_id,
      subconcept_id,
      conc_caja,
      detalle,
      importe,
      vencimiento_impuesto_id,
      cuenta_bancaria,
      hash_id
    ) VALUES (
      p_fecha,
      v_mes,
      'Impuestos',
      v_concept_id,
      v_subconcept_id,
      v_subconcept_name,
      COALESCE(p_detalle, concat('Pago Impuesto: ', v_impuesto_nombre)),
      -v_monto, -- Negativo para egreso
      p_vencimiento_id,
      p_cuenta_bancaria,
      v_hash_id
    ) RETURNING id INTO v_movement_id;

    -- Vincular en el vencimiento
    UPDATE public.vencimientos_impuestos
    SET cash_movement_id = v_movement_id
    WHERE id = p_vencimiento_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;
