-- ============================================================
-- MIGRACIÓN: Configuración General y Cuentas Bancarias de Tesorería
-- ============================================================

-- 1. Crear tabla de configuraciones si no existe
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS para settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso total (interno y administrador)
DROP POLICY IF EXISTS "settings_all_access" ON public.settings;
CREATE POLICY "settings_all_access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Inicializar valores por defecto de la fecha de corte y saldos iniciales por cuenta
INSERT INTO public.settings (key, value) VALUES
  ('treasury_cutoff_date', ''),
  ('treasury_starting_balance_mercado_pago', '0'),
  ('treasury_starting_balance_banco_galicia', '0'),
  ('treasury_starting_balance_efectivo', '0')
ON CONFLICT (key) DO NOTHING;

-- 2. Modificar cash_movements para agregar la columna cuenta_bancaria
ALTER TABLE public.cash_movements 
  ADD COLUMN IF NOT EXISTS cuenta_bancaria text NOT NULL DEFAULT 'efectivo' 
  CHECK (cuenta_bancaria IN ('mercado pago', 'banco galicia', 'efectivo'));

-- Crear índice para la columna de cuenta_bancaria
CREATE INDEX IF NOT EXISTS idx_cash_movements_cuenta_bancaria ON public.cash_movements (cuenta_bancaria);

-- 3. Eliminar firmas antiguas de funciones para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.registrar_pago_po(uuid, numeric, date, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.revertir_pago_po(uuid, uuid, date, text);
DROP FUNCTION IF EXISTS public.registrar_cobro_venta(uuid, numeric, date, boolean, text);
DROP FUNCTION IF EXISTS public.revertir_cobro_venta(uuid, uuid, date, text);
DROP FUNCTION IF EXISTS public.registrar_pago_servicio(uuid, date, boolean, text);
DROP FUNCTION IF EXISTS public.revertir_pago_servicio(uuid, date, text);

-- 4. Recrear funciones transaccionales con parámetro de cuenta bancaria

-- A. REGISTRAR PAGO DE ORDEN DE COMPRA (Parametrizado)
CREATE OR REPLACE FUNCTION public.registrar_pago_po(
  p_po_id uuid,
  p_monto numeric,
  p_fecha date,
  p_subconcept_id uuid,
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
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia o efectivo';
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
      COALESCE(p_detalle, concat('Pago a ', v_proveedor_nombre)),
      -p_monto, -- Negativo para egreso
      p_po_id,
      p_cuenta_bancaria,
      v_hash_id
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- B. REVERTIR PAGO DE ORDEN DE COMPRA (Propaga la cuenta del original)
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
  v_cuenta_bancaria text;
  v_mes text;
BEGIN
  SELECT ABS(importe), hash_id, concept_id, subconcept_id, conc_caja, cuenta_bancaria
  INTO v_monto, v_orig_hash_id, v_concept_id, v_subconcept_id, v_subconcept_name, v_cuenta_bancaria
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
      cuenta_bancaria,
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
      v_cuenta_bancaria,
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

-- C. REGISTRAR COBRO DE VENTA (Parametrizado)
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
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia o efectivo';
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
      cuenta_bancaria,
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
      p_cuenta_bancaria,
      v_hash_id
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- D. REVERTIR COBRO DE VENTA (Propaga la cuenta del original)
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
  v_cuenta_bancaria text;
  v_mes text;
BEGIN
  SELECT ABS(importe), hash_id, concept_id, subconcept_id, cuenta_bancaria
  INTO v_monto, v_orig_hash_id, v_concept_id, v_subconcept_id, v_cuenta_bancaria
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
      cuenta_bancaria,
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
      v_cuenta_bancaria,
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

-- E. REGISTRAR PAGO DE SERVICIO (Parametrizado)
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
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia o efectivo';
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

-- F. REVERTIR PAGO DE SERVICIO (Propaga la cuenta del original)
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
  v_cuenta_bancaria text;
  v_mes text;
BEGIN
  SELECT cash_movement_id, monto INTO v_movement_id, v_monto
  FROM public.vencimientos_servicios
  WHERE id = p_vencimiento_id;

  IF v_movement_id IS NOT NULL THEN
    SELECT hash_id, concept_id, subconcept_id, conc_caja, cuenta_bancaria
    INTO v_orig_hash_id, v_concept_id, v_subconcept_id, v_subconcept_name, v_cuenta_bancaria
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
          cuenta_bancaria,
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
          v_cuenta_bancaria,
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
