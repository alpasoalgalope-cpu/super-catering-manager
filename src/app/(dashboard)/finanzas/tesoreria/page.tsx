"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Wallet, DollarSign, ArrowUpRight, ArrowDownRight, Calendar as CalendarIcon, 
  Truck, ShoppingCart, User, AlertCircle, CheckCircle2, XCircle, Search, Plus, 
  RotateCcw, Link2, Loader2, ArrowLeft, CalendarDays, Settings, ShieldAlert,
  ChevronLeft, ChevronRight, Layers, HelpCircle, Sparkles
} from "lucide-react"
import Link from "next/link"
import { 
  getTreasurySummaryAction, 
  getTreasuryCalendarEventsAction,
  registrarPagoPOAction,
  revertirPagoPOAction,
  registrarCobroVentaAction,
  revertirCobroVentaAction,
  registrarPagoServicioAction,
  revertirPagoServicioAction,
  getUnlinkedMovementsAction,
  vincularMovimientoExistenteAction,
  getServiciosAction,
  crearServicioAction,
  toggleServicioActivoAction,
  getVencimientosServiciosAction,
  TreasurySummary,
  CalendarEvent
} from "@/app/actions/tesoreria"
import { updateIVAPayment } from "@/app/actions/iva"

interface ConceptItem {
  id: string
  name: string
  cash_subconcepts: { id: string; name: string }[]
}

export default function TreasuryPage() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'calendar' | 'payable' | 'receivable' | 'services' | 'taxes'>('kpis')
  const [currentPeriod, setCurrentPeriod] = useState<string>("")
  const [summary, setSummary] = useState<TreasurySummary | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [concepts, setConcepts] = useState<ConceptItem[]>([])
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null)

  // Sub-tab for Services
  const [servicesTab, setServicesTab] = useState<'vencimientos' | 'templates'>('vencimientos')

  // Data lists
  const [pos, setPos] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [serviceBills, setServiceBills] = useState<any[]>([])
  const [ivas, setIvas] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Modals state
  const [payPoModal, setPayPoModal] = useState<{ open: boolean; po: any | null }>({ open: false, po: null })
  const [collectSaleModal, setCollectSaleModal] = useState<{ open: boolean; sale: any | null }>({ open: false, sale: null })
  const [payServiceModal, setPayServiceModal] = useState<{ open: boolean; bill: any | null }>({ open: false, bill: null })
  const [payIvaModal, setPayIvaModal] = useState<{ open: boolean; iva: any | null }>({ open: false, iva: null })
  const [reconcileModal, setReconcileModal] = useState<{ open: boolean; docType: 'po' | 'venta' | 'servicio'; docId: string; amount: number; conceptName: 'Materia Prima' | 'VENTAS' | 'Servicios' }>({ open: false, docType: 'po', docId: '', amount: 0, conceptName: 'Materia Prima' })
  const [createServiceModal, setCreateServiceModal] = useState(false)
  const [unlinkedMovements, setUnlinkedMovements] = useState<any[]>([])
  const [loadingUnlinked, setLoadingUnlinked] = useState(false)
  const [revertConfirm, setRevertConfirm] = useState<{ open: boolean; type: 'po' | 'venta' | 'servicio'; docId: string; movementId: string; amount: number }>({ open: false, type: 'po', docId: '', movementId: '', amount: 0 })

  // Form states
  const [formMonto, setFormMonto] = useState("")
  const [formFecha, setFormFecha] = useState("")
  const [formDetalle, setFormDetalle] = useState("")
  const [formSubconcept, setFormSubconcept] = useState("")
  const [formGenerarCaja, setFormGenerarCaja] = useState(true)
  const [formCuentaBancaria, setFormCuentaBancaria] = useState<'mercado pago' | 'banco galicia' | 'efectivo'>('efectivo')

  // Service form states
  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceProv, setNewServiceProv] = useState("")
  const [newServiceMonto, setNewServiceMonto] = useState("")
  const [newServiceDay, setNewServiceDay] = useState(10)
  const [newServiceSubconcept, setNewServiceSubconcept] = useState("")

  const supabase = createClient()

  // Initialize current month
  useEffect(() => {
    const now = new Date()
    setCurrentPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  // Load basic data
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    const res = await getTreasurySummaryAction()
    if (res.success && res.data) {
      setSummary(res.data)
    }
    setLoadingSummary(false)
  }, [])

  const loadCalendarEvents = useCallback(async () => {
    if (!currentPeriod) return
    setLoadingEvents(true)
    const res = await getTreasuryCalendarEventsAction(currentPeriod)
    if (res.success && res.data) {
      setCalendarEvents(res.data)
    }
    setLoadingEvents(false)
  }, [currentPeriod])

  const loadConcepts = useCallback(async () => {
    const { data } = await supabase
      .from('cash_concepts')
      .select('id, name, cash_subconcepts(id, name)')
    if (data) setConcepts(data as any[])
  }, [supabase])

  const loadTabDetails = useCallback(async () => {
    if (!currentPeriod) return
    setLoadingData(true)
    
    try {
      // Fetch Purchase Orders
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          proveedores (nombre),
          cash_movements (id, fecha, importe, conc_caja, hash_id)
        `)
        .eq('estado', 'RECIBIDA')
        .order('fecha_vencimiento_pago', { ascending: true })

      if (poData) setPos(poData)

      // Fetch Sales Headers
      const { data: saleData } = await supabase
        .from('event_sales_headers')
        .select(`
          *,
          events_master!event_master_id (
            id,
            event_date,
            show_name
          ),
          cash_movements (id, fecha, importe, hash_id)
        `)
        .order('event_date', { ascending: false })

      if (saleData) setSales(saleData)

      // Fetch Services Templates
      const sRes = await getServiciosAction()
      if (sRes.success && sRes.data) setServices(sRes.data)

      // Fetch Monthly service bills
      const vsRes = await getVencimientosServiciosAction(currentPeriod)
      if (vsRes.success && vsRes.data) setServiceBills(vsRes.data)

      // Fetch IVA Liquidations
      const { data: ivaData } = await supabase
        .from('iva_liquidaciones')
        .select('*')
        .order('periodo', { ascending: false })

      if (ivaData) setIvas(ivaData)

    } catch (err) {
      console.error("Error loading tab details:", err)
    } finally {
      setLoadingData(false)
    }
  }, [currentPeriod, supabase])

  useEffect(() => {
    loadSummary()
    loadConcepts()
  }, [loadSummary, loadConcepts])

  useEffect(() => {
    if (currentPeriod) {
      loadCalendarEvents()
      loadTabDetails()
    }
  }, [currentPeriod, loadCalendarEvents, loadTabDetails])

  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  // Modal helpers
  const handleOpenPayPo = (po: any) => {
    setFormMonto(String(Number(po.costo_total) - Number(po.monto_pagado)))
    setFormFecha(new Date().toISOString().split('T')[0])
    setFormDetalle(`Pago PO #${po.id.split('-')[0]} - ${po.proveedores?.nombre}`)
    setFormGenerarCaja(true)
    setFormSubconcept("")
    setFormCuentaBancaria("efectivo")
    setPayPoModal({ open: true, po })
  }

  const handleOpenCollectSale = (sale: any) => {
    setFormMonto(String(Number(sale.total_amount) - Number(sale.monto_cobrado)))
    setFormFecha(new Date().toISOString().split('T')[0])
    setFormDetalle(`Cobro Venta Show: ${sale.events_master?.show_name || sale.company_name}`)
    setFormGenerarCaja(true)
    setFormCuentaBancaria("efectivo")
    setCollectSaleModal({ open: true, sale })
  }

  const handleOpenPayService = (bill: any) => {
    setFormMonto(String(bill.monto))
    setFormFecha(new Date().toISOString().split('T')[0])
    setFormDetalle(`Pago Servicio: ${bill.servicios?.nombre} Per. ${bill.mes_periodo}`)
    setFormGenerarCaja(true)
    setFormCuentaBancaria("efectivo")
    setPayServiceModal({ open: true, bill })
  }

  const handleOpenPayIva = (iva: any) => {
    setFormMonto(String(iva.saldo_a_pagar))
    setFormFecha(new Date().toISOString().split('T')[0])
    setFormDetalle(`Pago Impuesto IVA Periodo ${iva.periodo}`)
    setFormCuentaBancaria("efectivo")
    setPayIvaModal({ open: true, iva })
  }

  const handleOpenReconcile = async (docType: 'po' | 'venta' | 'servicio', docId: string, amount: number, conceptName: 'Materia Prima' | 'VENTAS' | 'Servicios') => {
    setLoadingUnlinked(true)
    setReconcileModal({ open: true, docType, docId, amount, conceptName })
    const res = await getUnlinkedMovementsAction(conceptName, currentPeriod)
    if (res.success && res.data) {
      setUnlinkedMovements(res.data)
    }
    setLoadingUnlinked(false)
  }

  const handleExecuteReconciliation = async (movementId: string) => {
    const { docType, docId } = reconcileModal
    const res = await vincularMovimientoExistenteAction(docType, docId, movementId)
    if (res.success) {
      alert("Vinculación de movimiento de caja completada con éxito.")
      setReconcileModal({ open: false, docType: 'po', docId: '', amount: 0, conceptName: 'Materia Prima' })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error al vincular: " + res.error)
    }
  }

  const handleExecutePayPo = async () => {
    const { po } = payPoModal
    if (!po) return
    const res = await registrarPagoPOAction(
      po.id,
      Number(formMonto),
      formFecha,
      formSubconcept,
      formGenerarCaja,
      formDetalle,
      formCuentaBancaria
    )

    if (res.success) {
      setPayPoModal({ open: false, po: null })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error: " + res.error)
    }
  }

  const handleExecuteCollectSale = async () => {
    const { sale } = collectSaleModal
    if (!sale) return
    const res = await registrarCobroVentaAction(
      sale.id,
      Number(formMonto),
      formFecha,
      formGenerarCaja,
      formDetalle,
      formCuentaBancaria
    )

    if (res.success) {
      setCollectSaleModal({ open: false, sale: null })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error: " + res.error)
    }
  }

  const handleExecutePayService = async () => {
    const { bill } = payServiceModal
    if (!bill) return
    const res = await registrarPagoServicioAction(
      bill.id,
      formFecha,
      formGenerarCaja,
      formDetalle,
      formCuentaBancaria
    )

    if (res.success) {
      setPayServiceModal({ open: false, bill: null })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error: " + res.error)
    }
  }

  const handleExecutePayIva = async () => {
    const { iva } = payIvaModal
    if (!iva) return
    
    // IVA uses the updateIVAPayment from iva.ts
    // We register the cash movement separately if generating caja, or they link it.
    // For simplicity, we trigger the update and create a movement of concept 'Impuestos', subconcept 'IVA'
    const conceptId = concepts.find(c => c.name === 'Impuestos')?.id
    const subconceptId = concepts.find(c => c.name === 'Impuestos')?.cash_subconcepts?.find(s => s.name === 'IVA')?.id

    const mes = to_char_js(formFecha)
    const hash = `iva_pay_${iva.id}_${formFecha}_${Math.random()}`
    
    // Standard RLS transaction
    const { error: updErr } = await supabase
      .from('iva_liquidaciones')
      .update({ pagado: true, fecha_pago: formFecha })
      .eq('id', iva.id)

    if (updErr) {
      alert("Error al actualizar liquidación: " + updErr.message)
      return
    }

    if (formGenerarCaja && conceptId && subconceptId) {
      const { error: mvErr } = await supabase
        .from('cash_movements')
        .insert({
          fecha: formFecha,
          mes,
          concepto: 'Impuestos',
          concept_id: conceptId,
          subconcept_id: subconceptId,
          conc_caja: 'IVA',
          detalle: formDetalle,
          importe: -Number(formMonto),
          cuenta_bancaria: formCuentaBancaria,
          hash_id: hash
        })
      if (mvErr) {
        console.error("Error creating cash movement for IVA payment:", mvErr)
      }
    }

    setPayIvaModal({ open: false, iva: null })
    loadSummary()
    loadTabDetails()
    loadCalendarEvents()
  }

  const handleOpenRevert = (type: 'po' | 'venta' | 'servicio', docId: string, movementId: string, amount: number) => {
    setRevertConfirm({ open: true, type, docId, movementId, amount })
  }

  const handleExecuteRevert = async () => {
    const { type, docId, movementId } = revertConfirm
    let success = false
    let errorMsg = ""

    if (type === 'po') {
      const res = await revertirPagoPOAction(docId, movementId, new Date().toISOString().split('T')[0], "Contrasiento de reversión pago PO")
      success = res.success
      errorMsg = res.error || ""
    } else if (type === 'venta') {
      const res = await revertirCobroVentaAction(docId, movementId, new Date().toISOString().split('T')[0], "Contrasiento de reversión cobro")
      success = res.success
      errorMsg = res.error || ""
    } else if (type === 'servicio') {
      const res = await revertirPagoServicioAction(docId, new Date().toISOString().split('T')[0], "Contrasiento de reversión servicio")
      success = res.success
      errorMsg = res.error || ""
    }

    if (success) {
      setRevertConfirm({ open: false, type: 'po', docId: '', movementId: '', amount: 0 })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error al revertir: " + errorMsg)
    }
  }

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await crearServicioAction(
      newServiceName,
      newServiceProv,
      Number(newServiceMonto),
      Number(newServiceDay),
      newServiceSubconcept
    )

    if (res.success) {
      setCreateServiceModal(false)
      setNewServiceName("")
      setNewServiceProv("")
      setNewServiceMonto("")
      setNewServiceDay(10)
      setNewServiceSubconcept("")
      loadTabDetails()
    } else {
      alert("Error al crear servicio: " + res.error)
    }
  }

  const handleToggleService = async (id: string, active: boolean) => {
    const res = await toggleServicioActivoAction(id, active)
    if (res.success) {
      loadTabDetails()
    }
  }

  // Calendar rendering helpers
  const renderCalendar = () => {
    if (!currentPeriod) return null
    const [year, month] = currentPeriod.split('-').map(Number)
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0 = Sun, 6 = Sat
    const daysInMonth = new Date(year, month, 0).getDate()

    const days = []
    // Empty padding cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="bg-slate-50/50 border border-slate-100 min-h-[100px] p-2"></div>)
    }

    // Days cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayEvents = calendarEvents.filter(e => e.date === dateStr)

      days.push(
        <div key={`day-${d}`} className="bg-white border border-slate-100 min-h-[100px] p-2 flex flex-col justify-between hover:bg-slate-50/50 transition">
          <span className="font-black text-xs text-slate-400">{d}</span>
          <div className="space-y-1.5 mt-2 flex-1 overflow-y-auto max-h-[80px] scrollbar-none">
            {dayEvents.map(e => {
              const bgColors: any = {
                oc: e.status === 'pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-200',
                venta: e.status === 'cobrado' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-green-50 text-green-700 border-green-100',
                servicio: e.status === 'pagado' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-sky-50 text-sky-800 border-sky-200',
                iva: e.status === 'pagado' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }

              return (
                <div 
                  key={e.id}
                  onClick={() => setSelectedCalendarEvent(e)}
                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer truncate ${bgColors[e.tipo] || 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  title={`${e.title} - ${formatCurrency(e.amount)}`}
                >
                  {e.title}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return days
  }

  const handlePeriodChange = (direction: 'prev' | 'next') => {
    if (!currentPeriod) return
    const [year, month] = currentPeriod.split('-').map(Number)
    let newYear = year
    let newMonth = month

    if (direction === 'prev') {
      newMonth--
      if (newMonth === 0) {
        newMonth = 12
        newYear--
      }
    } else {
      newMonth++
      if (newMonth === 13) {
        newMonth = 1
        newYear++
      }
    }

    setCurrentPeriod(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const currentPeriodLabel = () => {
    if (!currentPeriod) return ""
    const [year, month] = currentPeriod.split('-').map(Number)
    const d = new Date(year, month - 1, 1)
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase()
  }

  // Concept mapping helpers
  const poSubconcepts = concepts.find(c => c.name === 'Materia Prima')?.cash_subconcepts || []
  const servSubconcepts = concepts.find(c => c.name === 'Servicios')?.cash_subconcepts || []

  const cutoffDate = summary?.settings?.cutoffDate || ""

  const filteredPos = pos.filter(po => {
    if (!cutoffDate) return true
    const dateToCompare = po.fecha_vencimiento_pago || po.created_at?.split('T')[0]
    return dateToCompare && dateToCompare >= cutoffDate
  })

  const filteredSales = sales.filter(s => {
    if (!cutoffDate) return true
    const dateToCompare = s.fecha_cobro || s.events_master?.event_date || s.created_at?.split('T')[0]
    return dateToCompare && dateToCompare >= cutoffDate
  })

  const filteredServiceBills = serviceBills.filter(sb => {
    if (!cutoffDate) return true
    return sb.fecha_vencimiento >= cutoffDate
  })

  const filteredIvas = ivas.filter(iva => {
    if (!cutoffDate) return true
    const cutoffPeriod = cutoffDate.substring(0, 7) // 'YYYY-MM'
    return iva.periodo >= cutoffPeriod
  })

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-3 italic uppercase">
            <Wallet className="text-indigo-600 animate-pulse" size={36} />
            Tesorería <span className="text-indigo-600">| Central</span>
          </h2>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-[10px] mt-1">
            Gestión de liquidez, cuentas a cobrar/pagar y conciliaciones con flujo de caja
          </p>
        </div>
        
        {/* Month selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm self-start">
          <button onClick={() => handlePeriodChange('prev')} className="p-1 text-slate-400 hover:text-slate-700 transition">
            <ChevronLeft size={20} />
          </button>
          <span className="text-xs font-black text-slate-700 tracking-wider min-w-[120px] text-center">
            {currentPeriodLabel()}
          </span>
          <button onClick={() => handlePeriodChange('next')} className="p-1 text-slate-400 hover:text-slate-700 transition">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Kickoff Setup Banner */}
      <div className="bg-gradient-to-r from-indigo-50/90 to-sky-50/90 border border-indigo-100/50 p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-4 duration-300">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-indigo-950 uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="text-indigo-600 animate-pulse" size={18} />
            Consola de Punto de Partida Financiero
          </h4>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {summary?.settings?.cutoffDate ? (
              <span>Inicio desde cero activo a partir del <strong>{new Date(summary.settings.cutoffDate + 'T12:00:00').toLocaleDateString('es-AR')}</strong>. Podés volver a depurar saldos o cambiar la fecha de corte.</span>
            ) : (
              <span>Declará tus saldos iniciales de cuentas y depurá las deudas de cobros y pagos históricos antes del Kick Off formal.</span>
            )}
          </p>
        </div>
        <Link 
          href="/finanzas/tesoreria/punto-partida"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-md hover:scale-102 flex items-center gap-1.5"
        >
          {summary?.settings?.cutoffDate ? "Modificar Ajustes" : "Iniciar Punto de Partida"}
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Funds */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-950 p-6 rounded-[2.5rem] text-white shadow-xl shadow-indigo-950/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-500">
            <DollarSign size={140} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-1">Fondos de Caja Disponibles</p>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-none mb-4">Fondos en Caja</h3>
          {loadingSummary ? (
            <div className="h-10 w-32 bg-white/10 animate-pulse rounded-lg"></div>
          ) : (
            <h2 className="text-4xl font-black italic tracking-tighter truncate">
              {formatCurrency(summary?.fondosDisponibles || 0)}
            </h2>
          )}
          
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-300">
            <div>
              <p className="opacity-60 text-[8px] uppercase tracking-wider">MP</p>
              <p className="font-black text-white">{formatCurrency(summary?.mpSaldo || 0)}</p>
            </div>
            <div>
              <p className="opacity-60 text-[8px] uppercase tracking-wider">Galicia</p>
              <p className="font-black text-white">{formatCurrency(summary?.galiciaSaldo || 0)}</p>
            </div>
            <div>
              <p className="opacity-60 text-[8px] uppercase tracking-wider">Efectivo</p>
              <p className="font-black text-white">{formatCurrency(summary?.efectivoSaldo || 0)}</p>
            </div>
          </div>
        </div>

        {/* Accounts Payable */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500 mb-1">Cuentas por liquidar</p>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-6">Cuentas a Pagar</h3>
          {loadingSummary ? (
            <div className="h-10 w-32 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <h2 className="text-4xl font-black italic tracking-tighter text-slate-800 truncate">
              {formatCurrency(summary?.cuentasAPagar || 0)}
            </h2>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-[10px] font-bold text-slate-400">
            <span>OC: {formatCurrency(summary?.poDeuda || 0)}</span>
            <span>Servicios: {formatCurrency(summary?.servDeuda || 0)}</span>
            <span>IVA: {formatCurrency(summary?.ivaDeuda || 0)}</span>
          </div>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">Pendiente de ingreso</p>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-6">Montos a Cobrar</h3>
          {loadingSummary ? (
            <div className="h-10 w-32 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <h2 className="text-4xl font-black italic tracking-tighter text-slate-800 truncate">
              {formatCurrency(summary?.montosACobrar || 0)}
            </h2>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            Total facturación de shows no cobrados.
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="bg-slate-100 p-1.5 rounded-3xl flex flex-wrap gap-1">
        {[
          { id: 'kpis', label: 'Resumen' },
          { id: 'calendar', label: 'Calendario Financiero' },
          { id: 'payable', label: 'Cuentas a Pagar (OC)' },
          { id: 'receivable', label: 'Cuentas a Cobrar (Ventas)' },
          { id: 'services', label: 'Servicios' },
          { id: 'taxes', label: 'Impuestos (IVA)' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[120px] py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-md font-bold scale-102' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
        
        {loadingData && activeTab !== 'kpis' && activeTab !== 'calendar' ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-4 text-indigo-600" size={32} />
            <p className="font-bold text-xs uppercase tracking-wider">Cargando detalles de tesorería...</p>
          </div>
        ) : (
          <>
            {/* Panel 1: Overview KPIs breakdown */}
            {activeTab === 'kpis' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Estado General de Caja</h3>
                  <p className="text-xs text-slate-500 font-medium">Resumen general y composición de las obligaciones financieras pendientes.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  {/* Composición Deuda */}
                  <div className="border border-slate-200 rounded-[2rem] p-6 space-y-4">
                    <h4 className="font-black text-xs text-slate-400 uppercase tracking-wider">Composición de Cuentas a Pagar</h4>
                    <div className="divide-y divide-slate-100">
                      <div className="flex justify-between items-center py-3">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <Truck size={14} className="text-slate-400" /> Órdenes de Compra (Insumos)
                        </span>
                        <span className="text-sm font-black text-slate-700">{formatCurrency(summary?.poDeuda || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <Settings size={14} className="text-slate-400" /> Servicios Mensuales (Luz, Internet, etc)
                        </span>
                        <span className="text-sm font-black text-slate-700">{formatCurrency(summary?.servDeuda || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <ShieldAlert size={14} className="text-slate-400" /> Impuestos IVA
                        </span>
                        <span className="text-sm font-black text-slate-700">{formatCurrency(summary?.ivaDeuda || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-4 font-black border-t border-slate-200">
                        <span className="text-xs text-slate-800">TOTAL APALANCADO</span>
                        <span className="text-sm text-amber-600">{formatCurrency(summary?.cuentasAPagar || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-slate-50 rounded-[2rem] p-6 flex flex-col justify-between border border-slate-200">
                    <div className="space-y-2">
                      <h4 className="font-black text-xs text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                        <HelpCircle size={16} /> Flujo de Conciliación
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        El módulo de Tesorería está integrado relacionalmente con el libro diario de **Flujo de Caja**. 
                        Al ejecutar un pago o cobro directo, el sistema inserta de forma atómica y segura un contrasiento en la caja.
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Si los movimientos se importan a posteriori mediante las planillas mensuales de **Maxirest**, podés utilizar el botón de **Reconciliar** para asociar el comprobante a un movimiento existente sin duplicar saldos en caja.
                      </p>
                    </div>
                    
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-[11px] font-bold text-indigo-800 mt-4">
                      🚀 Consejo: Revisá el panel del Calendario Financiero para adelantarte a los vencimientos de la semana.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel 2: Financial Calendar */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Calendario Financiero</h3>
                    <p className="text-xs text-slate-500 font-medium">Visualización consolidada de cobros estimados (verde) y vencimientos (naranja, azul, rojo) del mes.</p>
                  </div>
                </div>

                {loadingEvents ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Days of week headers */}
                    <div className="grid grid-cols-7 gap-1 text-center font-black uppercase text-[10px] text-slate-400 bg-slate-50 py-3 rounded-t-2xl border border-slate-200 border-b-0">
                      <div>Dom</div>
                      <div>Lun</div>
                      <div>Mar</div>
                      <div>Mié</div>
                      <div>Jue</div>
                      <div>Vie</div>
                      <div>Sáb</div>
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1 bg-slate-100 p-1 rounded-b-2xl border border-slate-200">
                      {renderCalendar()}
                    </div>
                  </div>
                )}

                {/* Calendar Selected Event Detail Box */}
                {selectedCalendarEvent && (
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 mb-2 inline-block">
                        Detalle del Vencimiento: {selectedCalendarEvent.tipo.toUpperCase()}
                      </span>
                      <h4 className="text-lg font-black text-slate-800 uppercase">{selectedCalendarEvent.title}</h4>
                      <p className="text-xs font-bold text-slate-500 mt-1">
                        Fecha Programada: {new Date(selectedCalendarEvent.date + 'T12:00:00').toLocaleDateString('es-AR')} • Estado: <span className="uppercase text-indigo-600">{selectedCalendarEvent.status}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Monto Total</p>
                        <p className="text-xl font-black text-slate-800">{formatCurrency(selectedCalendarEvent.amount)}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {/* Go to respective tabs depending on type */}
                        <button 
                          onClick={() => {
                            setSelectedCalendarEvent(null)
                            setActiveTab(selectedCalendarEvent.tipo === 'oc' ? 'payable' : selectedCalendarEvent.tipo === 'venta' ? 'receivable' : selectedCalendarEvent.tipo === 'servicio' ? 'services' : 'taxes')
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                        >
                          Ir a Pestaña
                        </button>
                        <button 
                          onClick={() => setSelectedCalendarEvent(null)}
                          className="text-slate-400 hover:text-slate-600 px-3 py-2 text-xs font-bold"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Panel 3: Accounts Payable (Purchase Orders) */}
            {activeTab === 'payable' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Órdenes de Compra por Liquidar</h3>
                  <p className="text-xs text-slate-500 font-medium">Listado de órdenes recibidas pendientes de pago total o parcial.</p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Proveedor</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Vencimiento</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Monto Total</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Pagado</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Estado Pago</th>
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPos.map((po) => {
                        const isOverdue = new Date(po.fecha_vencimiento_pago) < new Date() && po.estado_pago !== 'pagado'
                        return (
                          <tr key={po.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-bold text-slate-800">
                              <p className="font-black truncate max-w-[200px]">{po.proveedores?.nombre}</p>
                              <p className="text-[10px] font-medium text-slate-400">ID: {po.id.split('-')[0]}...</p>
                            </td>
                            <td className={`py-4 px-4 text-center font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-600'}`}>
                              {po.fecha_vencimiento_pago ? new Date(po.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR') : '--'}
                              {isOverdue && <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest">Vencida</span>}
                            </td>
                            <td className="py-4 px-4 text-right font-black text-slate-700">{formatCurrency(po.costo_total)}</td>
                            <td className="py-4 px-4 text-right font-black text-emerald-600">{formatCurrency(po.monto_pagado || 0)}</td>
                            <td className="py-4 px-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                po.estado_pago === 'pagado'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : po.estado_pago === 'parcial'
                                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {po.estado_pago || 'pendiente'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex justify-center gap-2">
                                {po.estado_pago !== 'pagado' ? (
                                  <>
                                    <button 
                                      onClick={() => handleOpenPayPo(po)}
                                      className="bg-indigo-650 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
                                    >
                                      Pagar
                                    </button>
                                    <button 
                                      onClick={() => handleOpenReconcile('po', po.id, po.costo_total - po.monto_pagado, 'Materia Prima')}
                                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider text-[10px] px-3 py-2 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                                      title="Vincular con registro existente de Maxirest"
                                    >
                                      <Link2 size={12} /> Vincular
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Liquidada
                                  </span>
                                )}
                                
                                {/* Reversion logs */}
                                {po.cash_movements && po.cash_movements.length > 0 && (
                                  <div className="flex flex-col gap-1 items-end ml-4 border-l border-slate-200 pl-4">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Historial</span>
                                    {po.cash_movements.map((cm: any) => (
                                      <div key={cm.id} className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                        <span>{new Date(cm.fecha + 'T12:00:00').toLocaleDateString('es-AR')} : {formatCurrency(Math.abs(cm.importe))}</span>
                                        {/* Show revert button only if it isn't already reverted/countered. 
                                            Since contrasientos are inserts, we allow reverting if it's not a reversion itself (not starting with po_rev_).
                                            We just let the operator click revert and call the stored procedure. */}
                                        <button 
                                          onClick={() => handleOpenRevert('po', po.id, cm.id, Math.abs(cm.importe))}
                                          className="text-rose-500 hover:text-rose-700 transition"
                                          title="Revertir este pago cargando contrasiento"
                                        >
                                          <RotateCcw size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {pos.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No hay órdenes de compra recibidas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Panel 4: Accounts Receivable (Ventas) */}
            {activeTab === 'receivable' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Ventas por Cobrar</h3>
                  <p className="text-xs text-slate-500 font-medium">Listado de shows realizados y su estado de cobro actual.</p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Show / Empresa</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Fecha Show</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Facturación</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Cobrado</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Estado Cobro</th>
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSales.map((sale) => {
                        const showName = sale.events_master?.show_name || 'Show Sin Nombre'
                        const saleDate = sale.events_master?.event_date || sale.event_date
                        return (
                          <tr key={sale.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-bold text-slate-800">
                              <p className="font-black truncate max-w-[200px]">{showName}</p>
                              <p className="text-[10px] font-bold text-indigo-600">{sale.company_name || sale.company}</p>
                            </td>
                            <td className="py-4 px-4 text-center font-bold text-slate-600">
                              {saleDate ? new Date(saleDate + 'T12:00:00').toLocaleDateString('es-AR') : '--'}
                            </td>
                            <td className="py-4 px-4 text-right font-black text-slate-700">{formatCurrency(sale.total_amount)}</td>
                            <td className="py-4 px-4 text-right font-black text-emerald-600">{formatCurrency(sale.monto_cobrado || 0)}</td>
                            <td className="py-4 px-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                sale.estado_cobro === 'cobrado'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : sale.estado_cobro === 'parcial'
                                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {sale.estado_cobro || 'pendiente'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex justify-center gap-2">
                                {sale.estado_cobro !== 'cobrado' ? (
                                  <>
                                    <button 
                                      onClick={() => handleOpenCollectSale(sale)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
                                    >
                                      Cobrar
                                    </button>
                                    <button 
                                      onClick={() => handleOpenReconcile('venta', sale.id, sale.total_amount - sale.monto_cobrado, 'VENTAS')}
                                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider text-[10px] px-3 py-2 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                                    >
                                      <Link2 size={12} /> Vincular
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Cobrada
                                  </span>
                                )}

                                {/* Reversion logs */}
                                {sale.cash_movements && sale.cash_movements.length > 0 && (
                                  <div className="flex flex-col gap-1 items-end ml-4 border-l border-slate-200 pl-4">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Historial</span>
                                    {sale.cash_movements.map((cm: any) => (
                                      <div key={cm.id} className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                        <span>{new Date(cm.fecha + 'T12:00:00').toLocaleDateString('es-AR')} : {formatCurrency(Math.abs(cm.importe))}</span>
                                        <button 
                                          onClick={() => handleOpenRevert('venta', sale.id, cm.id, Math.abs(cm.importe))}
                                          className="text-rose-500 hover:text-rose-700 transition"
                                          title="Revertir cobro"
                                        >
                                          <RotateCcw size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {sales.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No hay registros de ventas cargados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Panel 5: Services panel */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Servicios Recurrentes</h3>
                    <p className="text-xs text-slate-500 font-medium">Control de servicios mensuales contratados y plantillas automáticas.</p>
                  </div>
                  
                  {/* Selector Subtab */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setServicesTab('vencimientos')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        servicesTab === 'vencimientos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Vencimientos del Mes
                    </button>
                    <button 
                      onClick={() => setServicesTab('templates')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        servicesTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Plantillas de Servicio
                    </button>
                  </div>
                </div>

                {servicesTab === 'vencimientos' ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Servicio</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Vencimiento</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Monto</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Estado Pago</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Fecha Pago</th>
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredServiceBills.map((bill) => {
                          const isOverdue = new Date(bill.fecha_vencimiento) < new Date() && bill.estado_pago !== 'pagado'
                          return (
                            <tr key={bill.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-4 px-6 font-bold text-slate-800">
                                <p className="font-black uppercase">{bill.servicios?.nombre}</p>
                                <p className="text-[10px] font-medium text-slate-400">Proveedor: {bill.servicios?.proveedor}</p>
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-slate-600">
                                {new Date(bill.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}
                                {isOverdue && <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest">Vencido</span>}
                              </td>
                              <td className="py-4 px-4 text-right font-black text-slate-700">{formatCurrency(bill.monto)}</td>
                              <td className="py-4 px-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                  bill.estado_pago === 'pagado'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : isOverdue
                                    ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {bill.estado_pago}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-slate-500">
                                {bill.fecha_pago ? new Date(bill.fecha_pago + 'T12:00:00').toLocaleDateString('es-AR') : '--'}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex justify-center gap-2">
                                  {bill.estado_pago !== 'pagado' ? (
                                    <>
                                      <button 
                                        onClick={() => handleOpenPayService(bill)}
                                        className="bg-indigo-650 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
                                      >
                                        Pagar
                                      </button>
                                      <button 
                                        onClick={() => handleOpenReconcile('servicio', bill.id, bill.monto, 'Servicios')}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider text-[10px] px-3 py-2 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                                      >
                                        <Link2 size={12} /> Vincular
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Pagado
                                      </span>
                                      <button 
                                        onClick={() => handleOpenRevert('servicio', bill.id, bill.cash_movement_id, bill.monto)}
                                        className="text-rose-500 hover:text-rose-700 p-2 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
                                        title="Revertir pago"
                                      >
                                        <RotateCcw size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {serviceBills.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No hay vencimientos de servicios activos en este mes</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Listado de Plantillas</h4>
                      <button 
                        onClick={() => setCreateServiceModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Nueva Plantilla
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services.map((serv) => (
                        <div key={serv.id} className="bg-white border border-slate-200 p-5 rounded-[2rem] hover:shadow-md transition flex justify-between items-center">
                          <div>
                            <h4 className="font-black text-sm text-slate-800 uppercase leading-snug">{serv.nombre}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">
                              Proveedor: {serv.proveedor} • Vence el día habitual: {serv.dia_vencimiento_habitual}
                            </p>
                            <p className="text-[10px] font-black text-indigo-600 uppercase mt-0.5">
                              Monto Estimado: {formatCurrency(serv.monto_estimado)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${serv.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {serv.activo ? 'activo' : 'inactivo'}
                            </span>
                            <button
                              onClick={() => handleToggleService(serv.id, !serv.activo)}
                              className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition ${
                                serv.activo 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-500 hover:text-white hover:border-rose-500' 
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                              }`}
                            >
                              {serv.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Panel 6: Taxes (IVA Liquidations) */}
            {activeTab === 'taxes' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Liquidaciones de Impuestos (IVA)</h3>
                  <p className="text-xs text-slate-500 font-medium">Histórico de liquidaciones de IVA mensuales cerradas y su estado de pago.</p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Período</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Débito Fiscal</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Crédito Fiscal</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Saldo a Pagar</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Estado Pago</th>
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredIvas.filter(i => i.cerrado).map((iva) => (
                        <tr key={iva.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6 font-black text-slate-800 uppercase">{iva.periodo}</td>
                          <td className="py-4 px-4 text-right font-bold text-rose-600">{formatCurrency(iva.debito_fiscal_puro)}</td>
                          <td className="py-4 px-4 text-right font-bold text-emerald-600">{formatCurrency(iva.credito_fiscal_puro)}</td>
                          <td className="py-4 px-4 text-right font-black text-slate-800">{formatCurrency(iva.saldo_a_pagar)}</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                              iva.pagado
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                            }`}>
                              {iva.pagado ? 'pagado' : 'pendiente'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {iva.pagado ? (
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 inline-flex items-center gap-1">
                                <CheckCircle2 size={12} /> Pagado el {iva.fecha_pago ? new Date(iva.fecha_pago + 'T12:00:00').toLocaleDateString('es-AR') : '--'}
                              </span>
                            ) : (
                              <button 
                                onClick={() => handleOpenPayIva(iva)}
                                className="bg-indigo-650 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
                              >
                                Registrar Pago
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {ivas.filter(i => i.cerrado).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No hay liquidaciones cerradas en el sistema</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}

      {/* Modal 1: Register Payment (PO) */}
      {payPoModal.open && payPoModal.po && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Registrar Pago a Proveedor</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Completa los datos para abonar la Orden de Compra.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleExecutePayPo(); }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto a Pagar</label>
                <input 
                  type="number"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Fecha de Pago</label>
                <input 
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Concepto Imputación Caja</label>
                <select
                  value={formSubconcept}
                  onChange={(e) => setFormSubconcept(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Subrubro --</option>
                  {poSubconcepts.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nota / Detalle</label>
                <input 
                  type="text"
                  value={formDetalle}
                  onChange={(e) => setFormDetalle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Cuenta Bancaria / Caja</label>
                <select
                  value={formCuentaBancaria}
                  onChange={(e) => setFormCuentaBancaria(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="mercado pago">Mercado Pago</option>
                  <option value="banco galicia">Banco Galicia</option>
                </select>
              </div>

              <div className="flex items-center gap-3 py-2 select-none">
                <input 
                  type="checkbox"
                  id="generarCajaPo"
                  checked={formGenerarCaja}
                  onChange={(e) => setFormGenerarCaja(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generarCajaPo" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Generar movimiento de egreso en Flujo de Caja
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition"
                >
                  Confirmar Pago
                </button>
                <button 
                  type="button"
                  onClick={() => setPayPoModal({ open: false, po: null })}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Register Collection (Ventas) */}
      {collectSaleModal.open && collectSaleModal.sale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Registrar Cobro de Venta</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Completa los datos para asentar el cobro del Show.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleExecuteCollectSale(); }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto Cobrado</label>
                <input 
                  type="number"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Fecha de Cobro</label>
                <input 
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nota / Detalle</label>
                <input 
                  type="text"
                  value={formDetalle}
                  onChange={(e) => setFormDetalle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Cuenta Bancaria / Caja</label>
                <select
                  value={formCuentaBancaria}
                  onChange={(e) => setFormCuentaBancaria(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="mercado pago">Mercado Pago</option>
                  <option value="banco galicia">Banco Galicia</option>
                </select>
              </div>

              <div className="flex items-center gap-3 py-2 select-none">
                <input 
                  type="checkbox"
                  id="generarCajaSale"
                  checked={formGenerarCaja}
                  onChange={(e) => setFormGenerarCaja(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generarCajaSale" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Generar movimiento de ingreso en Flujo de Caja
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition"
                >
                  Confirmar Cobro
                </button>
                <button 
                  type="button"
                  onClick={() => setCollectSaleModal({ open: false, sale: null })}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Register Payment (Servicios) */}
      {payServiceModal.open && payServiceModal.bill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Pagar Servicio Contratado</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Registra el pago de la factura del servicio.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleExecutePayService(); }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto de Factura</label>
                <input 
                  type="number"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Fecha de Pago</label>
                <input 
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nota / Detalle</label>
                <input 
                  type="text"
                  value={formDetalle}
                  onChange={(e) => setFormDetalle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Cuenta Bancaria / Caja</label>
                <select
                  value={formCuentaBancaria}
                  onChange={(e) => setFormCuentaBancaria(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="mercado pago">Mercado Pago</option>
                  <option value="banco galicia">Banco Galicia</option>
                </select>
              </div>

              <div className="flex items-center gap-3 py-2 select-none">
                <input 
                  type="checkbox"
                  id="generarCajaServ"
                  checked={formGenerarCaja}
                  onChange={(e) => setFormGenerarCaja(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generarCajaServ" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Generar movimiento de egreso en Flujo de Caja
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition"
                >
                  Confirmar Pago
                </button>
                <button 
                  type="button"
                  onClick={() => setPayServiceModal({ open: false, bill: null })}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Register Payment (IVA) */}
      {payIvaModal.open && payIvaModal.iva && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Pagar Saldo IVA</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Asienta el pago de la liquidación de IVA de AFIP.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleExecutePayIva(); }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto Pagado</label>
                <input 
                  type="number"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Fecha de Pago</label>
                <input 
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nota / Detalle</label>
                <input 
                  type="text"
                  value={formDetalle}
                  onChange={(e) => setFormDetalle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Cuenta Bancaria / Caja</label>
                <select
                  value={formCuentaBancaria}
                  onChange={(e) => setFormCuentaBancaria(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="mercado pago">Mercado Pago</option>
                  <option value="banco galicia">Banco Galicia</option>
                </select>
              </div>

              <div className="flex items-center gap-3 py-2 select-none">
                <input 
                  type="checkbox"
                  id="generarCajaIva"
                  checked={formGenerarCaja}
                  onChange={(e) => setFormGenerarCaja(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generarCajaIva" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Generar movimiento de egreso en Flujo de Caja
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition"
                >
                  Confirmar Pago
                </button>
                <button 
                  type="button"
                  onClick={() => setPayIvaModal({ open: false, iva: null })}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Maxirest Reconciliation (Vincular) */}
      {reconcileModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Vincular con Movimiento de Caja Maxirest</h3>
              <p className="text-xs text-slate-400 font-medium mb-6">
                Selecciona un registro de caja existente de Maxirest que coincida con este cobro/pago para asociarlo relacionalmente. **No generará duplicados**.
              </p>
            </div>

            {loadingUnlinked ? (
              <div className="flex justify-center items-center py-20 flex-1">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 pr-1 border border-slate-100 rounded-2xl p-2 space-y-2 max-h-[300px]">
                {unlinkedMovements.map((m) => (
                  <div key={m.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl hover:bg-indigo-50/50 transition">
                    <div>
                      <p className="font-bold text-slate-700 text-xs">{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</p>
                      <p className="text-[10px] font-black text-indigo-600 uppercase mt-0.5">{m.conc_caja} ({m.concepto})</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate max-w-[300px]">{m.detalle || 'Sin detalle'}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-slate-800 tabular-nums">{formatCurrency(Math.abs(m.importe))}</span>
                      <button
                        onClick={() => handleExecuteReconciliation(m.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[9px] px-3 py-1.5 rounded-xl transition"
                      >
                        Vincular
                      </button>
                    </div>
                  </div>
                ))}
                {unlinkedMovements.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-wider">
                    No se encontraron movimientos libres de '{reconcileModal.conceptName}' sin conciliar en el mes.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-6 border-t border-slate-100 mt-4">
              <button 
                type="button"
                onClick={() => setReconcileModal({ open: false, docType: 'po', docId: '', amount: 0, conceptName: 'Materia Prima' })}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Create Service Template */}
      {createServiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Crear Plantilla de Servicio</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Registra un nuevo servicio recurrente en la agenda.</p>
            
            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nombre del Servicio</label>
                <input 
                  type="text"
                  placeholder="Ej: Servicio de Energia Electrica"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Proveedor</label>
                <input 
                  type="text"
                  placeholder="Ej: Edesur"
                  value={newServiceProv}
                  onChange={(e) => setNewServiceProv(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Costo Estimado ($)</label>
                  <input 
                    type="number"
                    value={newServiceMonto}
                    onChange={(e) => setNewServiceMonto(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Día Vence (1 al 31)</label>
                  <input 
                    type="number"
                    min="1"
                    max="31"
                    value={newServiceDay}
                    onChange={(e) => setNewServiceDay(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Imputación Subrubro de Servicios</label>
                <select
                  value={newServiceSubconcept}
                  onChange={(e) => setNewServiceSubconcept(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Subrubro --</option>
                  {servSubconcepts.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition"
                >
                  Crear Plantilla
                </button>
                <button 
                  type="button"
                  onClick={() => setCreateServiceModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Reversion Confirmation */}
      {revertConfirm.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <RotateCcw className="mx-auto text-rose-500 mb-4" size={40} />
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">¿Confirmar Reversión?</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">
              Esta acción aplicará un contrasiento compensatorio en la caja y restablecerá el saldo pendiente del comprobante en Tesorería. Esta acción no se puede deshacer.
            </p>
            
            <div className="flex gap-2 justify-center">
              <button 
                onClick={handleExecuteRevert}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider text-xs px-6 py-3 rounded-2xl transition flex-1"
              >
                Revertir Movimiento
              </button>
              <button 
                onClick={() => setRevertConfirm({ open: false, type: 'po', docId: '', movementId: '', amount: 0 })}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Quick JS translation of to_char(date, 'MM') || '. ' || to_char(date, 'TMmonth')
function to_char_js(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${mm}. ${months[d.getMonth()]}`
}
