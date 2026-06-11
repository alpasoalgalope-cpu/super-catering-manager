-- ============================================================
-- MIGRACIÓN: Módulo de Impuestos Generalizados, Caja Chica y Split
-- ============================================================

-- 1. Crear tabla de Impuestos (Plantillas)
CREATE TABLE IF NOT EXISTS public.impuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  ente_recaudador text,
  monto_estimado numeric NOT NULL DEFAULT 0,
  dia_vencimiento_habitual integer NOT NULL CHECK (dia_vencimiento_habitual >= 1 AND dia_vencimiento_habitual <= 31),
  concept_id uuid REFERENCES public.cash_concepts(id) ON DELETE SET NULL,
  subconcept_id uuid REFERENCES public.cash_subconcepts(id) ON DELETE SET NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS para impuestos
ALTER TABLE public.impuestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impuestos_all_access" ON public.impuestos;
CREATE POLICY "impuestos_all_access" ON public.impuestos FOR ALL USING (true) WITH CHECK (true);

-- 2. Crear tabla de Vencimientos Mensuales de Impuestos
CREATE TABLE IF NOT EXISTS public.vencimientos_impuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  impuesto_id uuid REFERENCES public.impuestos(id) ON DELETE CASCADE NOT NULL,
  mes_periodo text NOT NULL, -- Formato 'YYYY-MM'
  fecha_vencimiento date NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  estado_pago text DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado', 'vencido')),
  fecha_pago date,
  cash_movement_id uuid, -- Vinculado más adelante
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_impuesto_periodo UNIQUE (impuesto_id, mes_periodo)
);

-- Habilitar RLS para vencimientos_impuestos
ALTER TABLE public.vencimientos_impuestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vencimientos_impuestos_all_access" ON public.vencimientos_impuestos;
CREATE POLICY "vencimientos_impuestos_all_access" ON public.vencimientos_impuestos FOR ALL USING (true) WITH CHECK (true);

-- 3. Modificar cash_movements para vincular impuestos
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS vencimiento_impuesto_id uuid REFERENCES public.vencimientos_impuestos(id) ON DELETE SET NULL;

ALTER TABLE public.vencimientos_impuestos
  ADD CONSTRAINT fk_vencimientos_impuestos_cash_movement FOREIGN KEY (cash_movement_id) REFERENCES public.cash_movements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_tax ON public.cash_movements (vencimiento_impuesto_id);

-- 4. Insertar subconceptos de impuestos adicionales en cash_subconcepts si no existen
INSERT INTO public.cash_subconcepts (concept_id, name)
SELECT concept_id, name FROM (
  SELECT (SELECT id FROM public.cash_concepts WHERE name = 'Impuestos') as concept_id, unnest(ARRAY[
    'Cargas Sociales', 'Planes de Pago'
  ]) as name
) t ON CONFLICT (concept_id, name) DO NOTHING;


-- ============================================================
-- FUNCIONES ALMACENADAS (RPC) - TRANSACCIONALIDAD ATÓMICA
-- ============================================================

-- A. GENERAR VENCIMIENTOS MENSUALES DE IMPUESTOS (PLANTILLAS)
CREATE OR REPLACE FUNCTION public.generar_vencimientos_impuestos(
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
    FROM public.impuestos 
    WHERE activo = true
  LOOP
    -- Ajustar el día si excede el fin de mes
    v_day := LEAST(v_rec.dia_vencimiento_habitual, v_last_day);
    v_due_date := make_date(v_year, v_month, v_day);

    INSERT INTO public.vencimientos_impuestos (
      impuesto_id,
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
    ) ON CONFLICT (impuesto_id, mes_periodo) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- B. REGISTRAR PAGO DE IMPUESTO
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
  IF p_cuenta_bancaria NOT IN ('mercado pago', 'banco galicia', 'efectivo') THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida. Debe ser mercado pago, banco galicia o efectivo';
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

-- C. REVERTIR PAGO DE IMPUESTO
CREATE OR REPLACE FUNCTION public.revertir_pago_impuesto(
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
  FROM public.vencimientos_impuestos
  WHERE id = p_vencimiento_id;

  IF v_movement_id IS NOT NULL THEN
    SELECT hash_id, concept_id, subconcept_id, conc_caja, cuenta_bancaria
    INTO v_orig_hash_id, v_concept_id, v_subconcept_id, v_subconcept_name, v_cuenta_bancaria
    FROM public.cash_movements
    WHERE id = v_movement_id;

    IF FOUND THEN
      IF v_orig_hash_id LIKE 'tax_pay_%' THEN
        v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
        v_hash_id := md5(concat('tax_rev_', p_vencimiento_id::text, '_', v_monto::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

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
          COALESCE(p_detalle, 'Contrasiento por reversión de pago de impuesto'),
          v_monto, -- Positivo para compensar
          p_vencimiento_id,
          v_cuenta_bancaria,
          v_hash_id
        );
      ELSE
        UPDATE public.cash_movements
        SET vencimiento_impuesto_id = NULL
        WHERE id = v_movement_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.vencimientos_impuestos
  SET 
    estado_pago = 'pendiente',
    fecha_pago = NULL,
    cash_movement_id = NULL
  WHERE id = p_vencimiento_id;
END;
$$ LANGUAGE plpgsql;

-- D. SPLIT DE COBRO DE VENTA EN TRANSACCIÓN ÚNICA (ATÓMICA)
CREATE OR REPLACE FUNCTION public.registrar_cobro_venta_split(
  p_header_id uuid,
  p_monto_efectivo numeric,
  p_monto_mp numeric,
  p_monto_galicia numeric,
  p_fecha date,
  p_generar_caja boolean,
  p_detalle text
) RETURNS void AS $$
DECLARE
  v_total_amount numeric;
  v_monto_cobrado numeric;
  v_monto_total_pago numeric;
  v_company_name text;
  v_show_name text;
  v_concept_id uuid;
  v_subconcept_id uuid;
  v_hash_id text;
  v_mes text;
BEGIN
  -- Calcular monto total de este registro de cobro
  v_monto_total_pago := COALESCE(p_monto_efectivo, 0) + COALESCE(p_monto_mp, 0) + COALESCE(p_monto_galicia, 0);
  
  IF v_monto_total_pago <= 0 THEN
    RAISE EXCEPTION 'El monto total a cobrar debe ser mayor a cero';
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

  v_monto_cobrado := COALESCE(v_monto_cobrado, 0) + v_monto_total_pago;

  -- Actualizar cabecera de la venta
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

    -- 1. Tramo Efectivo
    IF COALESCE(p_monto_efectivo, 0) > 0 THEN
      v_hash_id := md5(concat('sale_col_', p_header_id::text, '_', p_monto_efectivo::text, '_', p_fecha::text, '_efectivo_', gen_random_uuid()::text));
      INSERT INTO public.cash_movements (
        sucursal, mes, fecha, semana, turno, tipo, concepto, concept_id, subconcept_id, conc_caja, detalle, importe, event_sales_header_id, cuenta_bancaria, esrecu, oculta, rubro, hash_id
      ) VALUES (
        'Galope Bustamante', v_mes, p_fecha, '1', 'Sin Turno', 'Ingreso', 'VENTAS', v_concept_id, v_subconcept_id, 'Ventas',
        COALESCE(p_detalle, concat('Cobro Venta Show: ', v_show_name)) || ' (EFECTIVO)',
        p_monto_efectivo, p_header_id, 'efectivo', 'manual', 'no', 'VENTAS', v_hash_id
      );
    END IF;

    -- 2. Tramo Mercado Pago
    IF COALESCE(p_monto_mp, 0) > 0 THEN
      v_hash_id := md5(concat('sale_col_', p_header_id::text, '_', p_monto_mp::text, '_', p_fecha::text, '_mp_', gen_random_uuid()::text));
      INSERT INTO public.cash_movements (
        sucursal, mes, fecha, semana, turno, tipo, concepto, concept_id, subconcept_id, conc_caja, detalle, importe, event_sales_header_id, cuenta_bancaria, esrecu, oculta, rubro, hash_id
      ) VALUES (
        'Galope Bustamante', v_mes, p_fecha, '1', 'Sin Turno', 'Ingreso', 'VENTAS', v_concept_id, v_subconcept_id, 'Ventas',
        COALESCE(p_detalle, concat('Cobro Venta Show: ', v_show_name)) || ' (MERCADO PAGO)',
        p_monto_mp, p_header_id, 'mercado pago', 'manual', 'no', 'VENTAS', v_hash_id
      );
    END IF;

    -- 3. Tramo Banco Galicia
    IF COALESCE(p_monto_galicia, 0) > 0 THEN
      v_hash_id := md5(concat('sale_col_', p_header_id::text, '_', p_monto_galicia::text, '_', p_fecha::text, '_galicia_', gen_random_uuid()::text));
      INSERT INTO public.cash_movements (
        sucursal, mes, fecha, semana, turno, tipo, concepto, concept_id, subconcept_id, conc_caja, detalle, importe, event_sales_header_id, cuenta_bancaria, esrecu, oculta, rubro, hash_id
      ) VALUES (
        'Galope Bustamante', v_mes, p_fecha, '1', 'Sin Turno', 'Ingreso', 'VENTAS', v_concept_id, v_subconcept_id, 'Ventas',
        COALESCE(p_detalle, concat('Cobro Venta Show: ', v_show_name)) || ' (BANCO BANCO GALICIA)',
        p_monto_galicia, p_header_id, 'banco galicia', 'manual', 'no', 'VENTAS', v_hash_id
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- E. ANULACIÓN DE GASTO EN CAJA CHICA (CONTRASIENTO LEDGER COMPLIANT)
CREATE OR REPLACE FUNCTION public.anular_gasto_caja_chica(
  p_movement_id uuid,
  p_fecha date,
  p_detalle text
) RETURNS void AS $$
DECLARE
  v_orig record;
  v_hash_id text;
  v_mes text;
BEGIN
  -- Buscar el movimiento original
  SELECT * INTO v_orig FROM public.cash_movements WHERE id = p_movement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de caja no encontrado';
  END IF;
  
  -- Validar que sea un egreso
  IF v_orig.importe >= 0 THEN
    RAISE EXCEPTION 'Solo se pueden anular movimientos de egresos (gastos)';
  END IF;

  v_mes := to_char(p_fecha, 'MM') || '. ' || INITCAP(to_char(p_fecha, 'TMmonth'));
  v_hash_id := md5(concat('cc_rev_', p_movement_id::text, '_', ABS(v_orig.importe)::text, '_', p_fecha::text, '_', gen_random_uuid()::text));

  -- Insertar contrasiento de tipo Ingreso con importe positivo
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
    cuenta_bancaria,
    esrecu,
    oculta,
    rubro,
    hash_id
  ) VALUES (
    v_orig.sucursal,
    v_mes,
    p_fecha,
    v_orig.semana,
    v_orig.turno,
    'Ingreso',
    v_orig.concepto,
    v_orig.concept_id,
    v_orig.subconcept_id,
    v_orig.conc_caja,
    COALESCE(p_detalle, concat('Contrasiento por anulación de Gasto: ', v_orig.detalle)),
    ABS(v_orig.importe), -- Signo contrario (positivo) para netear
    v_orig.cuenta_bancaria,
    'manual',
    'no',
    v_orig.rubro,
    v_hash_id
  );
END;
$$ LANGUAGE plpgsql;
