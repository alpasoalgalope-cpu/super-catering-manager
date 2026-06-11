"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface TreasurySettings {
  cutoffDate: string
  mpStarting: number
  galiciaStarting: number
  efectivoStarting: number
}

export interface TreasurySummary {
  fondosDisponibles: number
  cuentasAPagar: number
  montosACobrar: number
  poDeuda: number
  servDeuda: number
  ivaDeuda: number
  mpSaldo: number
  galiciaSaldo: number
  efectivoSaldo: number
  settings: TreasurySettings
}

export interface CalendarEvent {
  id: string
  tipo: 'oc' | 'venta' | 'servicio' | 'iva' | 'impuesto'
  title: string
  date: string
  amount: number
  paidAmount?: number
  status: 'pendiente' | 'pagado' | 'parcial' | 'vencido' | 'cobrado'
  metadata: any
}

// 1. Get Treasury Summary metrics (KPIs)
export async function getTreasurySummaryAction(): Promise<{ success: boolean; data?: TreasurySummary; error?: string }> {
  try {
    const supabase = createClient()

    // Query settings from DB
    const { data: settingsData, error: setErr } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'treasury_cutoff_date',
        'treasury_starting_balance_mercado_pago',
        'treasury_starting_balance_banco_galicia',
        'treasury_starting_balance_efectivo'
      ])
    if (setErr) throw setErr

    const cutoffDate = settingsData?.find(s => s.key === 'treasury_cutoff_date')?.value || ""
    const mpStarting = Number(settingsData?.find(s => s.key === 'treasury_starting_balance_mercado_pago')?.value) || 0
    const galiciaStarting = Number(settingsData?.find(s => s.key === 'treasury_starting_balance_banco_galicia')?.value) || 0
    const efectivoStarting = Number(settingsData?.find(s => s.key === 'treasury_starting_balance_efectivo')?.value) || 0

    // A. Available Funds (Cash balance) split by bank account
    let mvQuery = supabase
      .from('cash_movements')
      .select('importe, cuenta_bancaria')
    if (cutoffDate) {
      mvQuery = mvQuery.gte('fecha', cutoffDate)
    }
    const { data: movements, error: mvErr } = await mvQuery
    if (mvErr) throw mvErr

    const mpSum = movements?.filter(m => m.cuenta_bancaria === 'mercado pago')
      .reduce((sum, m) => sum + (Number(m.importe) || 0), 0) || 0
    const galiciaSum = movements?.filter(m => m.cuenta_bancaria === 'banco galicia')
      .reduce((sum, m) => sum + (Number(m.importe) || 0), 0) || 0
    const efectivoSum = movements?.filter(m => m.cuenta_bancaria === 'efectivo')
      .reduce((sum, m) => sum + (Number(m.importe) || 0), 0) || 0

    const mpSaldo = mpStarting + mpSum
    const galiciaSaldo = galiciaStarting + galiciaSum
    const efectivoSaldo = efectivoStarting + efectivoSum
    const fondosDisponibles = mpSaldo + galiciaSaldo + efectivoSaldo

    // B. Accounts Payable - POs
    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select('costo_total, monto_pagado, fecha_vencimiento_pago, created_at')
      .eq('estado', 'RECIBIDA')
      .in('estado_pago', ['pendiente', 'parcial'])
    if (poErr) throw poErr

    const filteredPos = pos || []
    const poDeuda = filteredPos.reduce((sum, po) => sum + (Number(po.costo_total) - Number(po.monto_pagado)), 0) || 0

    // C. Accounts Payable - Services
    const { data: servs, error: servErr } = await supabase
      .from('vencimientos_servicios')
      .select('monto, fecha_vencimiento')
      .in('estado_pago', ['pendiente', 'vencido'])
    if (servErr) throw servErr

    const filteredServs = servs || []
    const servDeuda = filteredServs.reduce((sum, s) => sum + Number(s.monto), 0) || 0

    // D. Accounts Payable - Taxes (IVA)
    const { data: ivas, error: ivaErr } = await supabase
      .from('iva_liquidaciones')
      .select('saldo_a_pagar, periodo')
      .eq('cerrado', true)
      .eq('pagado', false)
    if (ivaErr) throw ivaErr

    const filteredIvas = ivas || []
    const ivaDeuda = filteredIvas.reduce((sum, i) => sum + Number(i.saldo_a_pagar), 0) || 0

    const cuentasAPagar = poDeuda + servDeuda + ivaDeuda

    // E. Accounts Receivable - Sales
    const { data: sales, error: saleErr } = await supabase
      .from('event_sales_headers')
      .select('total_amount, monto_cobrado, fecha_cobro, created_at')
      .in('estado_cobro', ['pendiente', 'parcial'])
    if (saleErr) throw saleErr

    let filteredSales = sales || []
    if (cutoffDate) {
      filteredSales = filteredSales.filter(s => {
        const dateToCompare = s.fecha_cobro || s.created_at?.split('T')[0]
        return dateToCompare && dateToCompare >= cutoffDate
      })
    }
    const montosACobrar = filteredSales.reduce((sum, s) => sum + (Number(s.total_amount) - Number(s.monto_cobrado)), 0) || 0

    return {
      success: true,
      data: {
        fondosDisponibles,
        cuentasAPagar,
        montosACobrar,
        poDeuda,
        servDeuda,
        ivaDeuda,
        mpSaldo,
        galiciaSaldo,
        efectivoSaldo,
        settings: {
          cutoffDate,
          mpStarting,
          galiciaStarting,
          efectivoStarting
        }
      }
    }
  } catch (err: any) {
    console.error("Error in getTreasurySummaryAction:", err)
    return { success: false, error: err.message || "Error al calcular el resumen de tesorería" }
  }
}

// 2. Fetch Calendar Events for a period +/- 1 month
export async function getTreasuryCalendarEventsAction(mesPeriodo: string): Promise<{ success: boolean; data: CalendarEvent[]; error?: string }> {
  try {
    const supabase = createClient()

    // Fetch settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'treasury_cutoff_date')
      .single()
    const cutoffDate = settingsData?.value || ""

    const [yearStr, monthStr] = mesPeriodo.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)

    // Calculate window: [month - 1] to [month + 1]
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear--
    }

    let nextYear = year
    let nextMonth = month + 1
    if (nextMonth === 13) {
      nextMonth = 1
      nextYear++
    }

    const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const lastDayNextMonth = new Date(nextYear, nextMonth, 0).getDate()
    const endDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayNextMonth).padStart(2, '0')}`

    const eventsList: CalendarEvent[] = []

    // A. Purchase Orders (OC)
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id, costo_total, monto_pagado, estado_pago, fecha_vencimiento_pago, proveedores(nombre)')
      .eq('estado', 'RECIBIDA')
      .gte('fecha_vencimiento_pago', startDateStr)
      .lte('fecha_vencimiento_pago', endDateStr)

    pos?.forEach(po => {
      if (po.fecha_vencimiento_pago) {
        eventsList.push({
          id: po.id,
          tipo: 'oc',
          title: `OC: ${(po.proveedores as any)?.nombre || 'Proveedor'}`,
          date: po.fecha_vencimiento_pago,
          amount: Number(po.costo_total) || 0,
          paidAmount: Number(po.monto_pagado) || 0,
          status: po.estado_pago as any,
          metadata: po
        })
      }
    })

    // B. Sales headers
    const { data: sales } = await supabase
      .from('event_sales_headers')
      .select('id, total_amount, monto_cobrado, estado_cobro, fecha_cobro, company_name, events_master(show_name)')
      .gte('fecha_cobro', startDateStr)
      .lte('fecha_cobro', endDateStr)

    sales?.forEach(s => {
      if (s.fecha_cobro) {
        eventsList.push({
          id: s.id,
          tipo: 'venta',
          title: `Vta: ${(s.events_master as any)?.show_name || s.company_name}`,
          date: s.fecha_cobro,
          amount: Number(s.total_amount) || 0,
          paidAmount: Number(s.monto_cobrado) || 0,
          status: s.estado_cobro === 'cobrado' ? 'cobrado' : (s.estado_cobro as any),
          metadata: s
        })
      }
    })

    // C. Services
    const { data: servs } = await supabase
      .from('vencimientos_servicios')
      .select('id, monto, estado_pago, fecha_vencimiento, servicios(nombre)')
      .gte('fecha_vencimiento', startDateStr)
      .lte('fecha_vencimiento', endDateStr)

    servs?.forEach(s => {
      if (s.fecha_vencimiento) {
        eventsList.push({
          id: s.id,
          tipo: 'servicio',
          title: `Serv: ${(s.servicios as any)?.nombre || 'Servicio'}`,
          date: s.fecha_vencimiento,
          amount: Number(s.monto) || 0,
          status: s.estado_pago as any,
          metadata: s
        })
      }
    })

    // D. Generalized Taxes (vencimientos_impuestos)
    const { data: taxBills } = await supabase
      .from('vencimientos_impuestos')
      .select('*, impuestos(nombre)')
      .gte('fecha_vencimiento', startDateStr)
      .lte('fecha_vencimiento', endDateStr)

    taxBills?.forEach(t => {
      eventsList.push({
        id: t.id,
        tipo: 'impuesto',
        title: `Imp: ${(t.impuestos as any)?.nombre || 'Impuesto'}`,
        date: t.fecha_vencimiento,
        amount: Number(t.monto) || 0,
        status: t.estado_pago as any,
        metadata: t
      })
    })

    let filteredEvents = eventsList
    if (cutoffDate) {
      filteredEvents = eventsList.filter(e => e.date >= cutoffDate)
    }

    return { success: true, data: filteredEvents }
  } catch (err: any) {
    console.error("Error in getTreasuryCalendarEventsAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener eventos del calendario" }
  }
}

// 3. Register a Payment for a Purchase Order (Modalidad A)
export async function registrarPagoPOAction(
  poId: string,
  monto: number,
  fecha: string,
  subconceptId: string,
  generarCaja: boolean,
  detalle: string,
  cuentaBancaria: string = 'efectivo'
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('registrar_pago_po', {
      p_po_id: poId,
      p_monto: monto,
      p_fecha: fecha,
      p_subconcept_id: subconceptId || null,
      p_generar_caja: generarCaja,
      p_detalle: detalle || null,
      p_cuenta_bancaria: cuentaBancaria
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/inventario/ordenes-compra')
    return { success: true, movementId: data }
  } catch (err: any) {
    console.error("Error in registrarPagoPOAction:", err)
    return { success: false, error: err.message || "Error al registrar pago" }
  }
}

// 4. Revert a Payment for a Purchase Order (Contrasiento o Desvinculación)
export async function revertirPagoPOAction(
  poId: string,
  movementId: string,
  fecha: string,
  detalle: string
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('revertir_pago_po', {
      p_po_id: poId,
      p_movement_id: movementId,
      p_fecha: fecha,
      p_detalle: detalle || null
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/inventario/ordenes-compra')
    return { success: true }
  } catch (err: any) {
    console.error("Error in revertirPagoPOAction:", err)
    return { success: false, error: err.message || "Error al revertir pago" }
  }
}

// 5. Register a Collection for a Sale (Modalidad A)
export async function registrarCobroVentaAction(
  headerId: string,
  monto: number,
  fecha: string,
  generarCaja: boolean,
  detalle: string,
  cuentaBancaria: string = 'efectivo'
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('registrar_cobro_venta', {
      p_header_id: headerId,
      p_monto: monto,
      p_fecha: fecha,
      p_generar_caja: generarCaja,
      p_detalle: detalle || null,
      p_cuenta_bancaria: cuentaBancaria
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/ventas-evento')
    return { success: true, movementId: data }
  } catch (err: any) {
    console.error("Error in registrarCobroVentaAction:", err)
    return { success: false, error: err.message || "Error al registrar cobro" }
  }
}

// 6. Revert a Collection for a Sale
export async function revertirCobroVentaAction(
  headerId: string,
  movementId: string,
  fecha: string,
  detalle: string
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('revertir_cobro_venta', {
      p_header_id: headerId,
      p_movement_id: movementId,
      p_fecha: fecha,
      p_detalle: detalle || null
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/ventas-evento')
    return { success: true }
  } catch (err: any) {
    console.error("Error in revertirCobroVentaAction:", err)
    return { success: false, error: err.message || "Error al revertir cobro" }
  }
}

// 7. Register a Payment for a Service Bill (Modalidad A)
export async function registrarPagoServicioAction(
  vencimientoId: string,
  fecha: string,
  generarCaja: boolean,
  detalle: string,
  cuentaBancaria: string = 'efectivo'
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('registrar_pago_servicio', {
      p_vencimiento_id: vencimientoId,
      p_fecha: fecha,
      p_generar_caja: generarCaja,
      p_detalle: detalle || null,
      p_cuenta_bancaria: cuentaBancaria
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true, movementId: data }
  } catch (err: any) {
    console.error("Error in registrarPagoServicioAction:", err)
    return { success: false, error: err.message || "Error al registrar pago de servicio" }
  }
}

// 8. Revert a Payment for a Service Bill
export async function revertirPagoServicioAction(
  vencimientoId: string,
  fecha: string,
  detalle: string
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('revertir_pago_servicio', {
      p_vencimiento_id: vencimientoId,
      p_fecha: fecha,
      p_detalle: detalle || null
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in revertirPagoServicioAction:", err)
    return { success: false, error: err.message || "Error al revertir pago de servicio" }
  }
}

// 9. Reconcile / Link an existing Cash Movement with a PO, Sale, or Service (Modalidad B)
export async function vincularMovimientoExistenteAction(
  tipoDoc: 'po' | 'venta' | 'servicio' | 'impuesto',
  docId: string,
  movementId: string
) {
  try {
    const supabase = createClient()

    // Fetch the cash movement details
    const { data: mv, error: mvErr } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('id', movementId)
      .single()
    if (mvErr) throw mvErr

    const amount = Math.abs(Number(mv.importe) || 0)

    if (tipoDoc === 'po') {
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', docId)
        .single()
      if (poErr) throw poErr

      const newMontoPagado = (Number(po.monto_pagado) || 0) + amount
      const newEstadoPago = newMontoPagado >= Number(po.costo_total) ? 'pagado' : 'parcial'

      // Update PO status
      const { error: updErr } = await supabase
        .from('purchase_orders')
        .update({ monto_pagado: newMontoPagado, estado_pago: newEstadoPago })
        .eq('id', docId)
      if (updErr) throw updErr

      // Link cash movement
      const { error: linkErr } = await supabase
        .from('cash_movements')
        .update({ purchase_order_id: docId })
        .eq('id', movementId)
      if (linkErr) throw linkErr

    } else if (tipoDoc === 'venta') {
      const { data: sale, error: saleErr } = await supabase
        .from('event_sales_headers')
        .select('*')
        .eq('id', docId)
        .single()
      if (saleErr) throw saleErr

      const newMontoCobrado = (Number(sale.monto_cobrado) || 0) + amount
      const newEstadoCobro = newMontoCobrado >= Number(sale.total_amount) ? 'cobrado' : 'parcial'

      // Update sale status
      const { error: updErr } = await supabase
        .from('event_sales_headers')
        .update({ monto_cobrado: newMontoCobrado, estado_cobro: newEstadoCobro })
        .eq('id', docId)
      if (updErr) throw updErr

      // Link cash movement
      const { error: linkErr } = await supabase
        .from('cash_movements')
        .update({ event_sales_header_id: docId })
        .eq('id', movementId)
      if (linkErr) throw linkErr

    } else if (tipoDoc === 'servicio') {
      // Link cash movement to service bill
      const { error: vsErr } = await supabase
        .from('vencimientos_servicios')
        .update({ estado_pago: 'pagado', fecha_pago: mv.fecha, cash_movement_id: movementId })
        .eq('id', docId)
      if (vsErr) throw vsErr

      // Link cash movement
      const { error: linkErr } = await supabase
        .from('cash_movements')
        .update({ vencimiento_servicio_id: docId })
        .eq('id', movementId)
      if (linkErr) throw linkErr
    } else if (tipoDoc === 'impuesto') {
      // Link cash movement to tax bill
      const { error: vtErr } = await supabase
        .from('vencimientos_impuestos')
        .update({ estado_pago: 'pagado', fecha_pago: mv.fecha, cash_movement_id: movementId })
        .eq('id', docId)
      if (vtErr) throw vtErr

      // Link cash movement
      const { error: linkErr } = await supabase
        .from('cash_movements')
        .update({ vencimiento_impuesto_id: docId })
        .eq('id', movementId)
      if (linkErr) throw linkErr

      // Sincronizar automáticamente con iva_liquidaciones si el impuesto es "IVA"
      const { data: vImp } = await supabase
        .from('vencimientos_impuestos')
        .select('*, impuestos(nombre)')
        .eq('id', docId)
        .single()

      if (vImp && (vImp.impuestos?.nombre === 'IVA' || vImp.impuestos?.nombre?.toLowerCase() === 'iva')) {
        const { error: ivaErr } = await supabase
          .from('iva_liquidaciones')
          .update({ pagado: true, fecha_pago: mv.fecha })
          .eq('periodo', vImp.mes_periodo)
        if (ivaErr) {
          console.error("Error al sincronizar pago con iva_liquidaciones:", ivaErr)
        }
      }
    }

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/inventario/ordenes-compra')
    revalidatePath('/ventas-evento')
    return { success: true }
  } catch (err: any) {
    console.error("Error in vincularMovimientoExistenteAction:", err)
    return { success: false, error: err.message || "Error al vincular movimiento de caja" }
  }
}

// 10. Fetch unlinked Cash Movements for a specific concept to allow reconciliation
export async function getUnlinkedMovementsAction(
  concepto: 'Materia Prima' | 'VENTAS' | 'Servicios' | 'Impuestos',
  mesPeriodo?: string
): Promise<{ success: boolean; data: any[]; error?: string }> {
  try {
    const supabase = createClient()
    let query = supabase
      .from('cash_movements')
      .select('*')
      .eq('concepto', concepto)

    // Filter by columns based on concept type
    if (concepto === 'Materia Prima') {
      query = query.is('purchase_order_id', null).lt('importe', 0) // Negative egresos
    } else if (concepto === 'VENTAS') {
      query = query.is('event_sales_header_id', null).gt('importe', 0) // Positive ingresos
    } else if (concepto === 'Servicios') {
      query = query.is('vencimiento_servicio_id', null).lt('importe', 0)
    }

    if (mesPeriodo) {
      // Parse mesPeriodo to format e.g. "06. Junio" or filter by date
      const [year, month] = mesPeriodo.split('-')
      const startDate = `${mesPeriodo}-01`
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      const endDate = `${mesPeriodo}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('fecha', startDate).lte('fecha', endDate)
    }

    const { data, error } = await query.order('fecha', { ascending: false })
    if (error) throw error

    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error in getUnlinkedMovementsAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener movimientos libres" }
  }
}

// 11. Fetch all services templates
export async function getServiciosAction() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('servicios')
      .select('*, cash_concepts(name), cash_subconcepts(name)')
      .order('nombre', { ascending: true })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error in getServiciosAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener servicios" }
  }
}

// 12. Create a new service template
export async function crearServicioAction(
  nombre: string,
  proveedor: string,
  montoEstimado: number,
  diaVencimientoHabitual: number,
  subconceptId: string
) {
  try {
    const supabase = createClient()

    // Fetch concept_id of the chosen subconcept to support Administracion/Estructura/Servicios
    const { data: subconcept } = await supabase
      .from('cash_subconcepts')
      .select('concept_id')
      .eq('id', subconceptId)
      .single()

    if (!subconcept) throw new Error("El subrubro seleccionado no existe.")

    const { data, error } = await supabase
      .from('servicios')
      .insert({
        nombre,
        proveedor,
        monto_estimado: montoEstimado,
        dia_vencimiento_habitual: diaVencimientoHabitual,
        concept_id: subconcept.concept_id,
        subconcept_id: subconceptId,
        activo: true
      })
      .select()

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true, data: data?.[0] }
  } catch (err: any) {
    console.error("Error in crearServicioAction:", err)
    return { success: false, error: err.message || "Error al crear servicio" }
  }
}

// 13. Toggle service template status (activo)
export async function toggleServicioActivoAction(id: string, activo: boolean) {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('servicios')
      .update({ activo })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in toggleServicioActivoAction:", err)
    return { success: false, error: err.message || "Error al actualizar estado del servicio" }
  }
}

// 14. Get service monthly bills (initializes them via stored procedure first)
export async function getVencimientosServiciosAction(mesPeriodo: string) {
  try {
    const supabase = createClient()

    // 1. Initialize pending service bills for this month dynamically
    const { error: rpcErr } = await supabase.rpc('generar_vencimientos_mensuales', { p_periodo: mesPeriodo })
    if (rpcErr) throw rpcErr

    // 2. Fetch results
    const { data, error } = await supabase
      .from('vencimientos_servicios')
      .select('*, servicios(*, cash_concepts(name), cash_subconcepts(name)), cash_movements:cash_movements!vencimientos_servicios_cash_movement_id_fkey(*)')
      .eq('mes_periodo', mesPeriodo)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error in getVencimientosServiciosAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener vencimientos de servicios" }
  }
}

// 15. Update Treasury Settings (Cutoff and account starting balances)
export async function updateTreasurySettingsAction(
  cutoffDate: string,
  mpStarting: number,
  galiciaStarting: number,
  efectivoStarting: number
) {
  try {
    const supabase = createClient()

    const settingsToUpsert = [
      { key: 'treasury_cutoff_date', value: cutoffDate, updated_at: new Date().toISOString() },
      { key: 'treasury_starting_balance_mercado_pago', value: String(mpStarting), updated_at: new Date().toISOString() },
      { key: 'treasury_starting_balance_banco_galicia', value: String(galiciaStarting), updated_at: new Date().toISOString() },
      { key: 'treasury_starting_balance_efectivo', value: String(efectivoStarting), updated_at: new Date().toISOString() }
    ]

    const { error } = await supabase
      .from('settings')
      .upsert(settingsToUpsert)

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in updateTreasurySettingsAction:", err)
    return { success: false, error: err.message || "Error al actualizar configuración" }
  }
}

// 16. Mark Sale as Collected Historically (No cash movement created)
export async function marcarVentaComoCobradaHistoricaAction(id: string) {
  try {
    const supabase = createClient()
    
    // Fetch total amount
    const { data: sale, error: fErr } = await supabase
      .from('event_sales_headers')
      .select('total_amount')
      .eq('id', id)
      .single()
    if (fErr) throw fErr

    const { error } = await supabase
      .from('event_sales_headers')
      .update({ 
        monto_cobrado: Number(sale.total_amount), 
        estado_cobro: 'cobrado',
        fecha_cobro: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in marcarVentaComoCobradaHistoricaAction:", err)
    return { success: false, error: err.message || "Error al actualizar venta" }
  }
}

// 17. Mark PO as Paid Historically (No cash movement created)
export async function marcarPOComoPagadaHistoricaAction(id: string) {
  try {
    const supabase = createClient()
    
    // Fetch total cost
    const { data: po, error: fErr } = await supabase
      .from('purchase_orders')
      .select('costo_total')
      .eq('id', id)
      .single()
    if (fErr) throw fErr

    const { error } = await supabase
      .from('purchase_orders')
      .update({ 
        monto_pagado: Number(po.costo_total), 
        estado_pago: 'pagado',
        fecha_vencimiento_pago: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in marcarPOComoPagadaHistoricaAction:", err)
    return { success: false, error: err.message || "Error al actualizar orden de compra" }
  }
}

// 18. Create an Ad-hoc Purchase Order / Debt entry
export async function crearDeudaAdHocAction(
  proveedorNombre: string,
  monto: number,
  fechaVencimiento: string
) {
  try {
    const supabase = createClient()
    const nameTrimmed = proveedorNombre.trim()

    // 1. Find or create supplier
    const { data: prov } = await supabase
      .from('proveedores')
      .select('id')
      .ilike('nombre', nameTrimmed)
      .maybeSingle()

    let proveedorId = prov?.id
    if (!proveedorId) {
      const { data: newProv, error: insProvErr } = await supabase
        .from('proveedores')
        .insert({ nombre: nameTrimmed })
        .select('id')
        .single()
      if (insProvErr) throw insProvErr
      proveedorId = newProv.id
    }

    // 2. Create ad-hoc purchase order
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        proveedor_id: proveedorId,
        costo_total: monto,
        monto_pagado: 0,
        estado: 'RECIBIDA',
        estado_pago: 'pendiente',
        fecha_vencimiento_pago: fechaVencimiento || new Date().toISOString().split('T')[0],
        fecha_esperada: new Date().toISOString().split('T')[0],
        plazo_pago: 'ad-hoc'
      })
    .select()
    .single()
    if (poErr) throw poErr

    revalidatePath('/finanzas/tesoreria')
    return { success: true, data: po }
  } catch (err: any) {
    console.error("Error in crearDeudaAdHocAction:", err)
    return { success: false, error: err.message || "Error al crear deuda ad-hoc" }
  }
}

// 19. Seed a predefined list of pending debts (called by user in wizard)
export async function seedPendingDebtsAction() {
  try {
    const supabase = createClient()
    
    const debtsToCreate = [
      { supplier: "AC Distribuidora", amount: 96000, vto: "2026-06-08" },
      { supplier: "AC Papelera Bustamante", amount: 96000, vto: "2026-06-08" },
      { supplier: "AC Papelera Bustamante", amount: 120000, vto: "2026-06-08" },
      { supplier: "AC Papelera Bustamante", amount: 189800, vto: "2026-06-08" },
      { supplier: "AC Papelera Bustamante", amount: 102600, vto: "2026-06-08" },
      
      { supplier: "Verduleria Galope", amount: 179500, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 54000, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 44000, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 152500, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 90500, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 136000, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 236000, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 40000, vto: "2026-06-08" },
      { supplier: "Verduleria Galope", amount: 303000, vto: "2026-06-08" },

      { supplier: "Icedream", amount: 716224, vto: "2026-06-08" },
      { supplier: "Icedream", amount: 75392, vto: "2026-06-08" },
      { supplier: "Icedream", amount: 188480, vto: "2026-06-08" },
      { supplier: "Icedream", amount: 565440, vto: "2026-06-08" },
      { supplier: "Icedream", amount: 226176, vto: "2026-06-08" },

      { supplier: "Sparkling", amount: 141461, vto: "2026-06-08" },
      { supplier: "Sparkling", amount: 157175, vto: "2026-06-08" },
      { supplier: "Sparkling", amount: 157179, vto: "2026-06-08" },
      { supplier: "Sparkling", amount: 125743, vto: "2026-06-08" },

      { supplier: "Criollo", amount: 72830, vto: "2026-06-08" },
      { supplier: "Horeca", amount: 83140, vto: "2026-06-08" },
      { supplier: "Sintaxis", amount: 275517, vto: "2026-06-08" },

      { supplier: "Horeca", amount: 656424.65, vto: "2026-06-13" },
      { supplier: "Criollo", amount: 72830.16, vto: "2026-06-13" },
      { supplier: "Criollo", amount: 24276.72, vto: "2026-06-16" },
      { supplier: "Horeca", amount: 481665.05, vto: "2026-06-16" }
    ];

    for (const item of debtsToCreate) {
      const nameTrimmed = item.supplier.trim()
      
      // Find or create supplier
      const { data: prov, error: provFindErr } = await supabase
        .from('proveedores')
        .select('id')
        .ilike('nombre', nameTrimmed)
        .maybeSingle()

      if (provFindErr) throw provFindErr

      let proveedorId = prov?.id
      if (!proveedorId) {
        const { data: newProv, error: insProvErr } = await supabase
          .from('proveedores')
          .insert({ nombre: nameTrimmed })
          .select('id')
          .single()
        if (insProvErr) throw insProvErr
        proveedorId = newProv.id
      }

      // Check if this PO already exists (idempotency check)
      const { data: existingPo, error: existErr } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('proveedor_id', proveedorId)
        .eq('costo_total', item.amount)
        .eq('fecha_vencimiento_pago', item.vto)
        .eq('estado_pago', 'pendiente')
        .maybeSingle()

      if (existErr) throw existErr

      if (!existingPo) {
        // Create purchase order
        const { error: poErr } = await supabase
          .from('purchase_orders')
          .insert({
            proveedor_id: proveedorId,
            costo_total: item.amount,
            monto_pagado: 0,
            estado: 'RECIBIDA',
            estado_pago: 'pendiente',
            fecha_vencimiento_pago: item.vto,
            fecha_esperada: new Date().toISOString().split('T')[0],
            plazo_pago: 'ad-hoc'
          })
        if (poErr) throw poErr
      }
    }

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in seedPendingDebtsAction:", err)
    return { success: false, error: err.message || "Error al precargar deudas" }
  }
}

// 20. Mark all historical pending sales as collected in bulk
export async function marcarTodasVentasCobradasHistoricasAction(cutoffDate: string) {
  try {
    const supabase = createClient()
    
    const { data: sales, error: fetchErr } = await supabase
      .from('event_sales_headers')
      .select(`
        id,
        total_amount,
        created_at,
        events_master!event_master_id (
          event_date
        )
      `)
      .in('estado_cobro', ['pendiente', 'parcial'])
    
    if (fetchErr) throw fetchErr

    const toUpdate = (sales || []).filter(s => {
      const dateToCompare = (s.events_master as any)?.event_date || s.created_at?.split('T')[0]
      return dateToCompare && dateToCompare < cutoffDate
    })

    for (const sale of toUpdate) {
      await supabase
        .from('event_sales_headers')
        .update({
          monto_cobrado: Number(sale.total_amount),
          estado_cobro: 'cobrado',
          fecha_cobro: new Date().toISOString().split('T')[0]
        })
        .eq('id', sale.id)
    }

    revalidatePath('/finanzas/tesoreria')
    return { success: true, count: toUpdate.length }
  } catch (err: any) {
    console.error("Error in marcarTodasVentasCobradasHistoricasAction:", err)
    return { success: false, error: err.message || "Error al depurar cobros históricos en lote" }
  }
}

// 21. Mark all historical pending purchase orders as paid in bulk
export async function marcarTodosPOsPagadosHistoricosAction(cutoffDate: string) {
  try {
    const supabase = createClient()
    
    const { data: pos, error: fetchErr } = await supabase
      .from('purchase_orders')
      .select('id, costo_total, created_at, fecha_vencimiento_pago')
      .eq('estado', 'RECIBIDA')
      .in('estado_pago', ['pendiente', 'parcial'])
    
    if (fetchErr) throw fetchErr

    const toUpdate = (pos || []).filter(po => {
      const dateToCompare = po.fecha_vencimiento_pago || po.created_at?.split('T')[0]
      return dateToCompare && dateToCompare < cutoffDate
    })

    for (const po of toUpdate) {
      await supabase
        .from('purchase_orders')
        .update({
          monto_pagado: Number(po.costo_total),
          estado_pago: 'pagado',
          fecha_vencimiento_pago: new Date().toISOString().split('T')[0]
        })
        .eq('id', po.id)
    }

    revalidatePath('/finanzas/tesoreria')
    return { success: true, count: toUpdate.length }
  } catch (err: any) {
    console.error("Error in marcarTodosPOsPagadosHistoricosAction:", err)
    return { success: false, error: err.message || "Error al depurar deudas históricas en lote" }
  }
}

// 22. Update Purchase Order fields (vencimiento and status) directly
export async function updatePurchaseOrderFieldsAction(
  id: string,
  fields: {
    fecha_vencimiento_pago?: string;
    estado_pago?: 'pendiente' | 'parcial' | 'pagado';
    monto_pagado?: number;
    created_at?: string;
  }
) {
  try {
    const supabase = createClient()
    const updateData: any = { ...fields }
    if (updateData.fecha_vencimiento_pago === "") {
      updateData.fecha_vencimiento_pago = null
    }
    if (updateData.created_at === "") {
      updateData.created_at = null
    }
    
    if (fields.estado_pago === 'pagado') {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('costo_total')
        .eq('id', id)
        .single()
      if (po) {
        updateData.monto_pagado = po.costo_total
      }
    } else if (fields.estado_pago === 'pendiente') {
      updateData.monto_pagado = 0
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error
    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/inventario/ordenes-compra')
    return { success: true, data }
  } catch (err: any) {
    console.error("Error in updatePurchaseOrderFieldsAction:", err)
    return { success: false, error: err.message || "Error al actualizar orden de compra" }
  }
}

// 23. Register Sale Collection split payment (atomic transactions)
export async function registrarCobroVentaSplitAction(
  headerId: string,
  montoEfectivo: number,
  montoMp: number,
  montoGalicia: number,
  fecha: string,
  generarCaja: boolean,
  detalle: string
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('registrar_cobro_venta_split', {
      p_header_id: headerId,
      p_monto_efectivo: montoEfectivo,
      p_monto_mp: montoMp,
      p_monto_galicia: montoGalicia,
      p_fecha: fecha,
      p_generar_caja: generarCaja,
      p_detalle: detalle || null
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/ventas-evento')
    return { success: true }
  } catch (err: any) {
    console.error("Error in registrarCobroVentaSplitAction:", err)
    return { success: false, error: err.message || "Error al registrar cobro dividido" }
  }
}

// 24. Fetch Petty Cash Movements (egresos directos)
export async function getPettyCashMovementsAction(mesPeriodo: string) {
  try {
    const supabase = createClient()
    const [year, month] = mesPeriodo.split('-')
    const startDate = `${mesPeriodo}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const endDate = `${mesPeriodo}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('cash_movements')
      .select('*, cash_concepts(name), cash_subconcepts(name)')
      .lt('importe', 0)
      .is('purchase_order_id', null)
      .is('vencimiento_servicio_id', null)
      .is('vencimiento_impuesto_id', null)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: false })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error in getPettyCashMovementsAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener gastos de caja chica" }
  }
}

// 25. Revert / Offset direct petty cash expense
export async function anularGastoCajaChicaAction(
  movementId: string,
  fecha: string,
  detalle: string
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('anular_gasto_caja_chica', {
      p_movement_id: movementId,
      p_fecha: fecha,
      p_detalle: detalle || null
    })

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in anularGastoCajaChicaAction:", err)
    return { success: false, error: err.message || "Error al anular gasto de caja chica" }
  }
}

// 26. Get all Taxes templates
export async function getImpuestosAction() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('impuestos')
      .select('*, cash_concepts(name), cash_subconcepts(name)')
      .order('nombre', { ascending: true })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error in getImpuestosAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener impuestos" }
  }
}

// 27. Create a new Tax template
export async function crearImpuestoAction(
  nombre: string,
  enteRecaudador: string,
  montoEstimado: number,
  diaVencimientoHabitual: number,
  subconceptId: string
) {
  try {
    const supabase = createClient()

    const { data: concept } = await supabase
      .from('cash_concepts')
      .select('id')
      .eq('name', 'Impuestos')
      .single()

    if (!concept) throw new Error("Concepto 'Impuestos' no configurado en la base de datos.")

    const { data, error } = await supabase
      .from('impuestos')
      .insert({
        nombre,
        ente_recaudador: enteRecaudador,
        monto_estimado: montoEstimado,
        dia_vencimiento_habitual: diaVencimientoHabitual,
        concept_id: concept.id,
        subconcept_id: subconceptId,
        activo: true
      })
      .select()

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true, data: data?.[0] }
  } catch (err: any) {
    console.error("Error in crearImpuestoAction:", err)
    return { success: false, error: err.message || "Error al crear impuesto" }
  }
}

// 28. Toggle Tax template active status
export async function toggleImpuestoActivoAction(id: string, activo: boolean) {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('impuestos')
      .update({ activo })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in toggleImpuestoActivoAction:", err)
    return { success: false, error: err.message || "Error al actualizar estado del impuesto" }
  }
}

// 29. Get tax monthly bills (uses RPC first)
export async function getVencimientosImpuestosAction(mesPeriodo: string) {
  try {
    const supabase = createClient()

    // Inicializar vencimientos de este mes
    const { error: rpcErr } = await supabase.rpc('generar_vencimientos_impuestos', { p_periodo: mesPeriodo })
    if (rpcErr) throw rpcErr

    const { data, error } = await supabase
      .from('vencimientos_impuestos')
      .select('*, impuestos(*, cash_concepts(name), cash_subconcepts(name)), cash_movements:cash_movements!fk_vencimientos_impuestos_cash_movement(*)')
      .eq('mes_periodo', mesPeriodo)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error in getVencimientosImpuestosAction:", err)
    return { success: false, data: [], error: err.message || "Error al obtener vencimientos de impuestos" }
  }
}

// 30. Register Payment for a Tax Bill
export async function registrarPagoImpuestoAction(
  vencimientoId: string,
  fecha: string,
  generarCaja: boolean,
  detalle: string,
  cuentaBancaria: string = 'efectivo'
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('registrar_pago_impuesto', {
      p_vencimiento_id: vencimientoId,
      p_fecha: fecha,
      p_generar_caja: generarCaja,
      p_detalle: detalle || null,
      p_cuenta_bancaria: cuentaBancaria
    })

    if (error) throw error

    // Sincronizar automáticamente con iva_liquidaciones si el impuesto es "IVA"
    const { data: vImp } = await supabase
      .from('vencimientos_impuestos')
      .select('*, impuestos(nombre)')
      .eq('id', vencimientoId)
      .single()

    if (vImp && (vImp.impuestos?.nombre === 'IVA' || vImp.impuestos?.nombre?.toLowerCase() === 'iva')) {
      const { error: ivaErr } = await supabase
        .from('iva_liquidaciones')
        .update({ pagado: true, fecha_pago: fecha })
        .eq('periodo', vImp.mes_periodo)
      if (ivaErr) {
        console.error("Error al sincronizar pago con iva_liquidaciones:", ivaErr)
      }
    }

    revalidatePath('/finanzas/tesoreria')
    return { success: true, movementId: data }
  } catch (err: any) {
    console.error("Error in registrarPagoImpuestoAction:", err)
    return { success: false, error: err.message || "Error al registrar pago de impuesto" }
  }
}

// 31. Revert Payment for a Tax Bill
export async function revertirPagoImpuestoAction(
  vencimientoId: string,
  fecha: string,
  detalle: string
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('revertir_pago_impuesto', {
      p_vencimiento_id: vencimientoId,
      p_fecha: fecha,
      p_detalle: detalle || null
    })

    if (error) throw error

    // Sincronizar automáticamente con iva_liquidaciones si el impuesto es "IVA"
    const { data: vImp } = await supabase
      .from('vencimientos_impuestos')
      .select('*, impuestos(nombre)')
      .eq('id', vencimientoId)
      .single()

    if (vImp && (vImp.impuestos?.nombre === 'IVA' || vImp.impuestos?.nombre?.toLowerCase() === 'iva')) {
      const { error: ivaErr } = await supabase
        .from('iva_liquidaciones')
        .update({ pagado: false, fecha_pago: null })
        .eq('periodo', vImp.mes_periodo)
      if (ivaErr) {
        console.error("Error al revertir pago con iva_liquidaciones:", ivaErr)
      }
    }

    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in revertirPagoImpuestoAction:", err)
    return { success: false, error: err.message || "Error al revertir pago de impuesto" }
  }
}

// 32. Update Cash Movement fields (e.g. cuenta_bancaria)
export async function updateCashMovementFieldsAction(
  id: string,
  fields: {
    cuenta_bancaria?: 'efectivo' | 'mercado pago' | 'banco galicia' | 'tarjeta de credito' | 'pago fer' | 'pago gaston';
  }
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cash_movements')
      .update(fields)
      .eq('id', id)
      .select()

    if (error) throw error
    revalidatePath('/finanzas/tesoreria')
    return { success: true, data }
  } catch (err: any) {
    console.error("Error in updateCashMovementFieldsAction:", err)
    return { success: false, error: err.message || "Error al actualizar movimiento de caja" }
  }
}

export async function updateVencimientoFieldsAction(
  type: 'servicio' | 'impuesto',
  id: string,
  fields: {
    monto?: number;
    fecha_vencimiento?: string;
  }
) {
  try {
    const supabase = createClient()
    const table = type === 'servicio' ? 'vencimientos_servicios' : 'vencimientos_impuestos';
    
    const { data: bill, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !bill) {
      return { success: false, error: "No se encontró el vencimiento a actualizar." }
    }

    const updatePayload: any = {}
    if (fields.monto !== undefined) updatePayload.monto = fields.monto
    if (fields.fecha_vencimiento !== undefined) updatePayload.fecha_vencimiento = fields.fecha_vencimiento

    const { error: updateError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', id)

    if (updateError) throw updateError

    if (bill.cash_movement_id && fields.monto !== undefined) {
      const newImporte = -Math.abs(fields.monto)
      const { error: mvError } = await supabase
        .from('cash_movements')
        .update({ importe: newImporte })
        .eq('id', bill.cash_movement_id)

      if (mvError) {
        console.error("Error updating linked cash movement:", mvError)
      }
    }

    revalidatePath('/finanzas/tesoreria')
    revalidatePath('/finanzas')
    return { success: true }
  } catch (err: any) {
    console.error("Error in updateVencimientoFieldsAction:", err)
    return { success: false, error: err.message || "Error al actualizar vencimiento" }
  }
}

// 34. Edit service template
export async function editarServicioAction(
  id: string,
  nombre: string,
  proveedor: string,
  montoEstimado: number,
  diaVencimientoHabitual: number,
  subconceptId: string
) {
  try {
    const supabase = createClient()

    // Fetch concept_id of the chosen subconcept to support Administracion/Estructura/Servicios
    const { data: subconcept } = await supabase
      .from('cash_subconcepts')
      .select('concept_id')
      .eq('id', subconceptId)
      .single()

    if (!subconcept) throw new Error("El subrubro seleccionado no existe.")

    const { data, error } = await supabase
      .from('servicios')
      .update({
        nombre,
        proveedor,
        monto_estimado: montoEstimado,
        dia_vencimiento_habitual: diaVencimientoHabitual,
        concept_id: subconcept.concept_id,
        subconcept_id: subconceptId
      })
      .eq('id', id)
      .select()

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true, data: data?.[0] }
  } catch (err: any) {
    console.error("Error in editarServicioAction:", err)
    return { success: false, error: err.message || "Error al editar servicio" }
  }
}

// 35. Edit tax template
export async function editarImpuestoAction(
  id: string,
  nombre: string,
  enteRecaudador: string,
  montoEstimado: number,
  diaVencimientoHabitual: number,
  subconceptId: string
) {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('impuestos')
      .update({
        nombre,
        ente_recaudador: enteRecaudador,
        monto_estimado: montoEstimado,
        dia_vencimiento_habitual: diaVencimientoHabitual,
        subconcept_id: subconceptId
      })
      .eq('id', id)
      .select()

    if (error) throw error

    revalidatePath('/finanzas/tesoreria')
    return { success: true, data: data?.[0] }
  } catch (err: any) {
    console.error("Error in editarImpuestoAction:", err)
    return { success: false, error: err.message || "Error al editar impuesto" }
  }
}

