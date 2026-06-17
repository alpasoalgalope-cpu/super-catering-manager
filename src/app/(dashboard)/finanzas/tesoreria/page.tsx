"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Wallet, DollarSign, ArrowUpRight, ArrowDownRight, Calendar as CalendarIcon, 
  Truck, ShoppingCart, User, AlertCircle, CheckCircle2, XCircle, Search, Plus, 
  RotateCcw, Link2, Loader2, ArrowLeft, CalendarDays, Settings, ShieldAlert,
  ChevronLeft, ChevronRight, Layers, HelpCircle, Sparkles, Edit
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
  CalendarEvent,
  updatePurchaseOrderFieldsAction,
  registrarCobroVentaSplitAction,
  getPettyCashMovementsAction,
  anularGastoCajaChicaAction,
  getImpuestosAction,
  crearImpuestoAction,
  toggleImpuestoActivoAction,
  getVencimientosImpuestosAction,
  registrarPagoImpuestoAction,
  revertirPagoImpuestoAction,
  updateCashMovementFieldsAction,
  updateVencimientoFieldsAction,
  editarServicioAction,
  editarImpuestoAction,
  generarVencimientoServicioManualAction,
  generarVencimientoImpuestoManualAction
} from "@/app/actions/tesoreria"
import { createCashMovement } from "@/app/actions/finances"
import { updateIVAPayment } from "@/app/actions/iva"

interface ConceptItem {
  id: string
  name: string
  cash_subconcepts: { id: string; name: string }[]
}

export default function TreasuryPage() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'calendar' | 'payable' | 'receivable' | 'services' | 'taxes' | 'petty'>('kpis')
  const [currentPeriod, setCurrentPeriod] = useState<string>("")
  const [summary, setSummary] = useState<TreasurySummary | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [concepts, setConcepts] = useState<ConceptItem[]>([])
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null)
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'agenda'>('month')
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null)
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'payable' | 'receivable'>('all')
  const [agendaStatusFilter, setAgendaStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')

  // Sub-tab for Services
  const [servicesTab, setServicesTab] = useState<'vencimientos' | 'templates'>('vencimientos')
  
  // Sub-tab for Taxes
  const [taxesTab, setTaxesTab] = useState<'vencimientos' | 'templates'>('vencimientos')
  const [poSortOrder, setPoSortOrder] = useState<'vencimiento' | 'proveedor'>('vencimiento')
  const [showPaidPos, setShowPaidPos] = useState<boolean>(false)
  const [showDebtStructure, setShowDebtStructure] = useState<boolean>(false)

  // Data lists
  const [pos, setPos] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [serviceBills, setServiceBills] = useState<any[]>([])
  const [taxesTemplates, setTaxesTemplates] = useState<any[]>([])
  const [taxBills, setTaxBills] = useState<any[]>([])
  const [pettyMovements, setPettyMovements] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingPetty, setLoadingPetty] = useState(false)

  // Modals state
  const [payPoModal, setPayPoModal] = useState<{ open: boolean; po: any | null }>({ open: false, po: null })
  const [collectSaleModal, setCollectSaleModal] = useState<{ open: boolean; sale: any | null }>({ open: false, sale: null })
  const [payServiceModal, setPayServiceModal] = useState<{ open: boolean; bill: any | null }>({ open: false, bill: null })
  const [payTaxModal, setPayTaxModal] = useState<{ open: boolean; bill: any | null }>({ open: false, bill: null })
  const [reconcileModal, setReconcileModal] = useState<{ open: boolean; docType: 'po' | 'venta' | 'servicio' | 'impuesto'; docId: string; amount: number; conceptName: 'Materia Prima' | 'VENTAS' | 'Servicios' | 'Impuestos' }>({ open: false, docType: 'po', docId: '', amount: 0, conceptName: 'Materia Prima' })
  const [createServiceModal, setCreateServiceModal] = useState(false)
  const [createTaxModal, setCreateTaxModal] = useState(false)
  const [pettyModal, setPettyModal] = useState(false)
  const [anularPettyModal, setAnularPettyModal] = useState<{ open: boolean; movementId: string; amount: number; detail: string }>({ open: false, movementId: "", amount: 0, detail: "" })
  const [unlinkedMovements, setUnlinkedMovements] = useState<any[]>([])
  const [loadingUnlinked, setLoadingUnlinked] = useState(false)
  const [revertConfirm, setRevertConfirm] = useState<{ open: boolean; type: 'po' | 'venta' | 'servicio' | 'impuesto'; docId: string; movementId: string; amount: number }>({ open: false, type: 'po', docId: '', movementId: '', amount: 0 })

  const [editBillModal, setEditBillModal] = useState<{ open: boolean; type: 'servicio' | 'impuesto'; bill: any | null }>({ open: false, type: 'servicio', bill: null })
  const [editBillForm, setEditBillForm] = useState({ monto: "", fecha_vencimiento: "" })
  const [isSavingEditBill, setIsSavingEditBill] = useState(false)

  const handleOpenEditBill = (type: 'servicio' | 'impuesto', bill: any) => {
    setEditBillModal({ open: true, type, bill })
    setEditBillForm({
      monto: bill.monto.toString(),
      fecha_vencimiento: bill.fecha_vencimiento || ""
    })
  }

  const handleEditBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBillModal.bill) return

    const parsedMonto = Number(editBillForm.monto)
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      alert("Por favor ingrese un monto válido mayor a 0.")
      return
    }

    setIsSavingEditBill(true)
    try {
      const res = await updateVencimientoFieldsAction(
        editBillModal.type,
        editBillModal.bill.id,
        {
          monto: parsedMonto,
          fecha_vencimiento: editBillForm.fecha_vencimiento
        }
      )

      if (res.success) {
        setEditBillModal({ open: false, type: 'servicio', bill: null })
        loadSummary()
        loadCalendarEvents()
        loadTabDetails()
      } else {
        alert(res.error || "Error al actualizar vencimiento")
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Error inesperado")
    } finally {
      setIsSavingEditBill(false)
    }
  }

  // Split payments state
  const [splitAmounts, setSplitAmounts] = useState({
    efectivo: 0,
    "mercado pago": 0,
    "banco galicia": 0
  })

  // Form states
  const [formMonto, setFormMonto] = useState("")
  const [formFecha, setFormFecha] = useState("")
  const [formDetalle, setFormDetalle] = useState("")
  const [formSubconcept, setFormSubconcept] = useState("")
  const [formGenerarCaja, setFormGenerarCaja] = useState(true)
  const [formCuentaBancaria, setFormCuentaBancaria] = useState<'mercado pago' | 'banco galicia' | 'efectivo' | 'tarjeta de credito' | 'pago fer' | 'pago gaston'>('efectivo')

  // Service form states
  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceProv, setNewServiceProv] = useState("")
  const [newServiceMonto, setNewServiceMonto] = useState("")
  const [newServiceDay, setNewServiceDay] = useState(10)
  const [newServiceSubconcept, setNewServiceSubconcept] = useState("")
  const [newServiceActivo, setNewServiceActivo] = useState(true)

  // Tax form states
  const [newTaxName, setNewTaxName] = useState("")
  const [newTaxEnte, setNewTaxEnte] = useState("")
  const [newTaxMonto, setNewTaxMonto] = useState("")
  const [newTaxDay, setNewTaxDay] = useState(15)
  const [newTaxSubconcept, setNewTaxSubconcept] = useState("")
  const [newTaxActivo, setNewTaxActivo] = useState(true)

  // Edit template form states
  const [editTemplateModal, setEditTemplateModal] = useState<{ open: boolean; type: 'servicio' | 'impuesto'; template: any | null }>({ open: false, type: 'servicio', template: null })
  const [editTemplateName, setEditTemplateName] = useState("")
  const [editTemplateEnteOrProveedor, setEditTemplateEnteOrProveedor] = useState("")
  const [editTemplateMonto, setEditTemplateMonto] = useState("")
  const [editTemplateDay, setEditTemplateDay] = useState(15)
  const [editTemplateSubconcept, setEditTemplateSubconcept] = useState("")
  const [editTemplateActivo, setEditTemplateActivo] = useState(true)
  const [isSavingEditTemplate, setIsSavingEditTemplate] = useState(false)

  // Petty cash form states
  const [pettyMonto, setPettyMonto] = useState("")
  const [pettyFecha, setPettyFecha] = useState("")
  const [pettyDetalle, setPettyDetalle] = useState("")
  const [pettyConcept, setPettyConcept] = useState("")
  const [pettySubconcept, setPettySubconcept] = useState("")
  const [pettyCuenta, setPettyCuenta] = useState<'mercado pago' | 'banco galicia' | 'efectivo' | 'tarjeta de credito' | 'pago fer' | 'pago gaston'>('efectivo')

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

      // Fetch Taxes Templates
      const tRes = await getImpuestosAction()
      if (tRes.success && tRes.data) setTaxesTemplates(tRes.data)

      // Fetch Monthly tax bills
      const vtRes = await getVencimientosImpuestosAction(currentPeriod)
      if (vtRes.success && vtRes.data) setTaxBills(vtRes.data)

      // Fetch Petty cash movements
      setLoadingPetty(true)
      const pRes = await getPettyCashMovementsAction(currentPeriod)
      if (pRes.success && pRes.data) setPettyMovements(pRes.data)
      setLoadingPetty(false)

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

  useEffect(() => {
    if (!currentPeriod) return
    const [year, month] = currentPeriod.split('-').map(Number)
    const today = new Date()
    
    if (today.getFullYear() === year && (today.getMonth() + 1) === month) {
      const diff = today.getDate() - today.getDay()
      const sun = new Date(today.getFullYear(), today.getMonth(), diff)
      setWeekStartDate(sun)
    } else {
      const firstDay = new Date(year, month - 1, 1)
      const diff = firstDay.getDate() - firstDay.getDay()
      const sun = new Date(year, month - 1, diff)
      setWeekStartDate(sun)
    }
  }, [currentPeriod])

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
    const pending = Number(sale.total_amount) - Number(sale.monto_cobrado)
    setSplitAmounts({
      efectivo: 0,
      "mercado pago": pending,
      "banco galicia": 0
    })
    setFormFecha(new Date().toISOString().split('T')[0])
    setFormDetalle(`Cobro Venta Show: ${sale.events_master?.show_name || sale.company_name}`)
    setFormGenerarCaja(true)
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

  const handleOpenPayTax = (bill: any) => {
    setFormMonto(String(bill.monto))
    setFormFecha(new Date().toISOString().split('T')[0])
    setFormDetalle(`Pago Impuesto: ${bill.impuestos?.nombre} Per. ${bill.mes_periodo}`)
    setFormGenerarCaja(true)
    setFormCuentaBancaria("efectivo")
    setPayTaxModal({ open: true, bill })
  }

  const handleOpenReconcile = async (docType: 'po' | 'venta' | 'servicio' | 'impuesto', docId: string, amount: number, conceptName: 'Materia Prima' | 'VENTAS' | 'Servicios' | 'Impuestos') => {
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
    // Map impuesto to service for linking if needed, or handle it relactionally
    // But since vincularMovimientoExistenteAction handles 'servicio', we can map 'impuesto' to 'servicio' in vinculacion or extend it.
    // Let's verify: we didn't add 'impuesto' handling in vincularMovimientoExistenteAction, but wait!
    // Since taxes payment can also be linked, we can extend vincularMovimientoExistenteAction in tesoreria.ts to support 'impuesto'!
    // Let's do that if needed. For now we call it.
    const res = await vincularMovimientoExistenteAction(docType as any, docId, movementId)
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
    
    const totalToPay = Number(splitAmounts.efectivo) + Number(splitAmounts["mercado pago"]) + Number(splitAmounts["banco galicia"])
    if (totalToPay <= 0) {
      alert("Por favor, ingresá un monto mayor a cero en al menos una cuenta.")
      return
    }

    const res = await registrarCobroVentaSplitAction(
      sale.id,
      Number(splitAmounts.efectivo),
      Number(splitAmounts["mercado pago"]),
      Number(splitAmounts["banco galicia"]),
      formFecha,
      formGenerarCaja,
      formDetalle
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

  const handleExecutePayTax = async () => {
    const { bill } = payTaxModal
    if (!bill) return
    const res = await registrarPagoImpuestoAction(
      bill.id,
      formFecha,
      formGenerarCaja,
      formDetalle,
      formCuentaBancaria
    )

    if (res.success) {
      setPayTaxModal({ open: false, bill: null })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error: " + res.error)
    }
  }

  const handleOpenRevert = (type: 'po' | 'venta' | 'servicio' | 'impuesto', docId: string, movementId: string, amount: number) => {
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
    } else if (type === 'impuesto') {
      const res = await revertirPagoImpuestoAction(docId, new Date().toISOString().split('T')[0], "Contrasiento de reversión impuesto")
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
      newServiceSubconcept,
      newServiceActivo
    )

    if (res.success) {
      setCreateServiceModal(false)
      setNewServiceName("")
      setNewServiceProv("")
      setNewServiceMonto("")
      setNewServiceDay(10)
      setNewServiceSubconcept("")
      setNewServiceActivo(true)
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

  const handleCreateTax = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await crearImpuestoAction(
      newTaxName,
      newTaxEnte,
      Number(newTaxMonto),
      Number(newTaxDay),
      newTaxSubconcept,
      newTaxActivo
    )

    if (res.success) {
      setCreateTaxModal(false)
      setNewTaxName("")
      setNewTaxEnte("")
      setNewTaxMonto("")
      setNewTaxDay(15)
      setNewTaxSubconcept("")
      setNewTaxActivo(true)
      loadTabDetails()
    } else {
      alert("Error al crear impuesto: " + res.error)
    }
  }

  const handleToggleTax = async (id: string, active: boolean) => {
    const res = await toggleImpuestoActivoAction(id, active)
    if (res.success) {
      loadTabDetails()
    }
  }

  const handleOpenEditTemplate = (type: 'servicio' | 'impuesto', template: any) => {
    setEditTemplateModal({ open: true, type, template })
    setEditTemplateName(template.nombre || "")
    setEditTemplateEnteOrProveedor(type === 'servicio' ? (template.proveedor || "") : (template.ente_recaudador || ""))
    setEditTemplateMonto(String(template.monto_estimado || ""))
    setEditTemplateDay(Number(template.dia_vencimiento_habitual || 15))
    setEditTemplateSubconcept(template.subconcept_id || "")
    setEditTemplateActivo(template.activo !== false)
  }

  const handleEditTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTemplateModal.template) return
    setIsSavingEditTemplate(true)

    let res
    if (editTemplateModal.type === 'servicio') {
      res = await editarServicioAction(
        editTemplateModal.template.id,
        editTemplateName,
        editTemplateEnteOrProveedor,
        Number(editTemplateMonto),
        Number(editTemplateDay),
        editTemplateSubconcept,
        editTemplateActivo
      )
    } else {
      res = await editarImpuestoAction(
        editTemplateModal.template.id,
        editTemplateName,
        editTemplateEnteOrProveedor,
        Number(editTemplateMonto),
        Number(editTemplateDay),
        editTemplateSubconcept,
        editTemplateActivo
      )
    }

    if (res.success) {
      setEditTemplateModal({ open: false, type: 'servicio', template: null })
      loadTabDetails()
    } else {
      alert("Error al actualizar plantilla: " + res.error)
    }
    setIsSavingEditTemplate(false)
  }

  const handleGenerarManual = async (type: 'servicio' | 'impuesto', id: string, name: string) => {
    const confirmGen = window.confirm(`¿Generar el vencimiento para "${name}" en el período actual (${currentPeriod})?`)
    if (!confirmGen) return

    let res
    if (type === 'servicio') {
      res = await generarVencimientoServicioManualAction(id, currentPeriod)
    } else {
      res = await generarVencimientoImpuestoManualAction(id, currentPeriod)
    }

    if (res.success) {
      alert("Vencimiento generado con éxito para este período.")
      loadTabDetails()
      loadCalendarEvents()
      loadSummary()
    } else {
      alert("Error al generar vencimiento: " + res.error)
    }
  }

  const handleOpenPettyModal = () => {
    setPettyMonto("")
    setPettyFecha(new Date().toISOString().split('T')[0])
    setPettyDetalle("")
    setPettyConcept("")
    setPettySubconcept("")
    setPettyCuenta("efectivo")
    setPettyModal(true)
  }

  const handleExecuteCreatePetty = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const chosenConcept = concepts.find(c => c.id === pettyConcept)
    const chosenSubconcept = chosenConcept?.cash_subconcepts?.find(s => s.id === pettySubconcept)

    if (!chosenConcept || !chosenSubconcept) {
      alert("Por favor, selecciona un concepto y subconcepto válidos.")
      return
    }

    const res = await createCashMovement({
      fecha: pettyFecha,
      tipo: "Egreso",
      concept_id: pettyConcept,
      concepto: chosenConcept.name,
      subconcept_id: pettySubconcept,
      conc_caja: chosenSubconcept.name,
      detalle: pettyDetalle,
      importe: Number(pettyMonto),
      cuenta_bancaria: pettyCuenta
    })

    if (res.success) {
      setPettyModal(false)
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error al registrar gasto: " + res.error)
    }
  }

  const handleOpenAnularPetty = (mv: any) => {
    setAnularPettyModal({
      open: true,
      movementId: mv.id,
      amount: Math.abs(mv.importe),
      detail: mv.detalle
    })
  }

  const handleExecuteAnularPetty = async () => {
    const { movementId, amount, detail } = anularPettyModal
    const res = await anularGastoCajaChicaAction(
      movementId,
      new Date().toISOString().split('T')[0],
      `Contrasiento de anulación para Gasto: ${detail}`
    )

    if (res.success) {
      setAnularPettyModal({ open: false, movementId: "", amount: 0, detail: "" })
      loadSummary()
      loadTabDetails()
      loadCalendarEvents()
    } else {
      alert("Error al anular: " + res.error)
    }
  }

  const handleUpdatePOField = async (poId: string, field: 'fecha_vencimiento_pago' | 'estado_pago' | 'created_at', value: any) => {
    const res = await updatePurchaseOrderFieldsAction(poId, { [field]: value })
    if (res.success) {
      setPos(prevPos => prevPos.map(po => {
        if (po.id === poId) {
          const updated = { ...po, [field]: value }
          if (field === 'estado_pago') {
            if (value === 'pagado') {
              updated.monto_pagado = po.costo_total
            } else if (value === 'pendiente') {
              updated.monto_pagado = 0
            }
          }
          return updated
        }
        return po
      }))
      loadSummary()
    } else {
      alert("Error al actualizar: " + res.error)
    }
  }

  const handleUpdateCashMovementField = async (mvId: string, field: 'cuenta_bancaria', value: any) => {
    const res = await updateCashMovementFieldsAction(mvId, { [field]: value })
    if (res.success) {
      setPettyMovements(prevMvs => prevMvs.map(mv => {
        if (mv.id === mvId) {
          return { ...mv, [field]: value }
        }
        return mv
      }))
      loadSummary()
    } else {
      alert("Error al actualizar: " + res.error)
    }
  }


  // Calendar rendering helpers
  const renderCalendar = () => {
    if (!currentPeriod) return null
    const [year, month] = currentPeriod.split('-').map(Number)
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0 = Sun, 6 = Sat
    const daysInMonth = new Date(year, month, 0).getDate()
    
    // Format today's date in local time as YYYY-MM-DD
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const days = []
    // Empty padding cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="bg-slate-50/50 border border-slate-100 min-h-[100px] p-2"></div>)
    }

    // Days cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      
      // Filter: Show all events for this day
      const dayEvents = calendarEvents.filter(e => e.date === dateStr)

      // Calculate daily total of pending obligations (unpaid expenses)
      const dayTotal = dayEvents
        .filter(e => e.tipo !== 'venta' && e.status !== 'pagado')
        .reduce((sum, e) => sum + e.amount, 0)

      days.push(
        <div key={`day-${d}`} className="bg-white border border-slate-100 min-h-[100px] p-2 flex flex-col justify-between hover:bg-slate-50/50 transition">
          <div className="flex justify-between items-center">
            <span className="font-black text-xs text-slate-400">{d}</span>
            {dayTotal > 0 && (
              <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                {formatCurrency(dayTotal)}
              </span>
            )}
          </div>
          <div className="space-y-1.5 mt-2 flex-1 overflow-y-auto max-h-[80px] scrollbar-none">
            {dayEvents.map(e => {
              const isOverdue = e.date < todayStr
              let colorClass = ''
              
              if (e.status === 'pagado' || e.status === 'cobrado') {
                colorClass = 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70'
              } else if (e.tipo === 'venta') {
                colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-250'
              } else if (isOverdue) {
                colorClass = 'bg-rose-50 text-rose-700 border-rose-200'
              } else if (e.tipo === 'servicio') {
                colorClass = 'bg-sky-50 text-sky-700 border-sky-200'
              } else if (e.tipo === 'impuesto') {
                colorClass = 'bg-amber-50 text-amber-700 border-amber-200'
              } else {
                colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }

              return (
                <div 
                  key={e.id}
                  onClick={() => setSelectedCalendarEvent(e)}
                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer truncate ${colorClass}`}
                  title={`${e.title} - ${formatCurrency(e.amount)} (${e.status})`}
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

  const handleWeekChange = (direction: 'prev' | 'next') => {
    if (!weekStartDate) return
    const newDate = new Date(weekStartDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setWeekStartDate(newDate)
    
    const year = newDate.getFullYear()
    const month = String(newDate.getMonth() + 1).padStart(2, '0')
    const nextPeriod = `${year}-${month}`
    if (nextPeriod !== currentPeriod) {
      setCurrentPeriod(nextPeriod)
    }
  }

  const handleResetToCurrentWeek = () => {
    const today = new Date()
    const diff = today.getDate() - today.getDay()
    const sun = new Date(today.getFullYear(), today.getMonth(), diff)
    setWeekStartDate(sun)
    
    const year = sun.getFullYear()
    const month = String(sun.getMonth() + 1).padStart(2, '0')
    const nextPeriod = `${year}-${month}`
    if (nextPeriod !== currentPeriod) {
      setCurrentPeriod(nextPeriod)
    }
  }

  const renderWeek = () => {
    if (!weekStartDate) return null

    const days = []
    const tempDate = new Date(weekStartDate)
    
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (let i = 0; i < 7; i++) {
      const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`
      
      const dayEvents = calendarEvents.filter(e => e.date === dateStr)

      const dayTotal = dayEvents
        .filter(e => e.tipo !== 'venta' && e.status !== 'pagado')
        .reduce((sum, e) => sum + e.amount, 0)

      days.push({
        dateLabel: tempDate.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' }).toUpperCase(),
        dateStr,
        dayNum: tempDate.getDate(),
        events: dayEvents,
        total: dayTotal,
        isToday: dateStr === todayStr
      })
      
      tempDate.setDate(tempDate.getDate() + 1)
    }

    const endOfWeekDate = new Date(weekStartDate)
    endOfWeekDate.setDate(endOfWeekDate.getDate() + 6)
    
    const startMonthName = weekStartDate.toLocaleDateString('es-AR', { month: 'long' })
    const endMonthName = endOfWeekDate.toLocaleDateString('es-AR', { month: 'long' })
    
    let weekLabel = ""
    if (startMonthName === endMonthName) {
      weekLabel = `Semana del ${weekStartDate.getDate()} al ${endOfWeekDate.getDate()} de ${startMonthName.toUpperCase()} de ${weekStartDate.getFullYear()}`
    } else {
      weekLabel = `Semana del ${weekStartDate.getDate()} de ${startMonthName.toUpperCase()} al ${endOfWeekDate.getDate()} de ${endMonthName.toUpperCase()} de ${weekStartDate.getFullYear()}`
    }

    return (
      <div className="space-y-6">
        {/* Navigation Bar inside Week View */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-[2rem] shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleWeekChange('prev')}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/20 transition shadow-sm active:scale-95"
              title="Semana Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            
            <span className="text-xs font-black text-slate-700 tracking-wider min-w-[220px] text-center">
              {weekLabel}
            </span>

            <button
              onClick={() => handleWeekChange('next')}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/20 transition shadow-sm active:scale-95"
              title="Semana Siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={handleResetToCurrentWeek}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:bg-indigo-50/20 hover:border-indigo-100 transition shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <CalendarDays size={14} /> Esta Semana
          </button>
        </div>

        {/* 7 Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((d, index) => {
            return (
              <div 
                key={index} 
                className={`bg-white border rounded-[2rem] p-4 min-h-[350px] flex flex-col hover:shadow-md transition-all duration-300 ${
                  d.isToday 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm' 
                    : 'border-slate-200'
                }`}
              >
                {/* Column Day Header */}
                <div className="border-b border-slate-100 pb-3 mb-3 flex flex-col justify-between items-center text-center">
                  <span className={`text-[10px] font-black tracking-widest uppercase ${d.isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {d.dateLabel.split(' ')[0]}
                  </span>
                  <span className={`text-2xl font-black italic tracking-tighter mt-1 ${d.isToday ? 'text-indigo-600 font-black' : 'text-slate-800'}`}>
                    {d.dayNum}
                  </span>
                  {d.total > 0 && (
                    <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 mt-2 shadow-sm animate-pulse">
                      {formatCurrency(d.total)}
                    </span>
                  )}
                </div>

                {/* Day events list */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] scrollbar-none">
                  {d.events.length === 0 ? (
                    <div className="h-full flex items-center justify-center py-12 text-center text-[10px] font-bold text-slate-300 italic uppercase">
                      Sin Eventos
                    </div>
                  ) : (
                    d.events.map(e => {
                      const isEventOverdue = e.date < todayStr && e.status !== 'pagado' && e.status !== 'cobrado'
                      let colorClass = ''
                      
                      if (e.status === 'pagado' || e.status === 'cobrado') {
                        colorClass = 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70'
                      } else if (e.tipo === 'venta') {
                        colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      } else if (isEventOverdue) {
                        colorClass = 'bg-rose-50 text-rose-700 border-rose-250 font-bold'
                      } else if (e.tipo === 'servicio') {
                        colorClass = 'bg-sky-50 text-sky-700 border-sky-200'
                      } else if (e.tipo === 'impuesto') {
                        colorClass = 'bg-amber-50 text-amber-700 border-amber-200'
                      } else {
                        colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }

                      return (
                        <div 
                          key={e.id}
                          onClick={() => setSelectedCalendarEvent(e)}
                          className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-2 rounded-xl border cursor-pointer truncate transition hover:scale-102 hover:shadow-sm ${colorClass}`}
                          title={`${e.title} - ${formatCurrency(e.amount)} (${e.status})`}
                        >
                          {e.title}
                          <span className="block text-[8px] font-bold opacity-80 mt-0.5">
                            {formatCurrency(e.amount)}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderAgenda = () => {
    if (!currentPeriod) return null

    // 1. Get today's date formatted as YYYY-MM-DD
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // 2. Filter events
    const filteredEvents = calendarEvents.filter(e => {
      // Type Filter
      if (agendaFilter === 'payable') {
        if (e.tipo !== 'oc' && e.tipo !== 'servicio' && e.tipo !== 'impuesto') return false
      } else if (agendaFilter === 'receivable') {
        if (e.tipo !== 'venta') return false
      }

      // Status Filter
      const isCompleted = e.status === 'pagado' || e.status === 'cobrado'
      if (agendaStatusFilter === 'pending' && isCompleted) return false
      if (agendaStatusFilter === 'completed' && !isCompleted) return false

      return true
    })

    // 3. Classify/Group events
    const vencidos: CalendarEvent[] = []
    const proximos: CalendarEvent[] = []
    const completados: CalendarEvent[] = []

    filteredEvents.forEach(e => {
      const isCompleted = e.status === 'pagado' || e.status === 'cobrado'
      if (isCompleted) {
        completados.push(e)
      } else {
        const isExpense = e.tipo === 'oc' || e.tipo === 'servicio' || e.tipo === 'impuesto'
        if (isExpense && e.date < todayStr) {
          vencidos.push(e)
        } else {
          proximos.push(e)
        }
      }
    })

    // Sort chronologically within groups:
    vencidos.sort((a, b) => a.date.localeCompare(b.date))
    proximos.sort((a, b) => a.date.localeCompare(b.date))
    completados.sort((a, b) => b.date.localeCompare(a.date))

    const renderEventCard = (e: CalendarEvent, isOverdue: boolean = false) => {
      const formattedDate = new Date(e.date + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      }).toUpperCase()

      // Define color system based on type
      let typeLabel = ''
      let colorClasses = ''
      let borderClass = 'border-slate-200 hover:border-slate-300'
      let textAccent = 'text-slate-800'

      if (e.status === 'pagado' || e.status === 'cobrado') {
        typeLabel = e.tipo === 'venta' ? 'Cobro' : e.tipo === 'oc' ? 'Proveedor' : e.tipo === 'servicio' ? 'Servicio' : 'Impuesto'
        colorClasses = 'bg-slate-100 text-slate-500 border-slate-200'
        borderClass = 'border-slate-200 bg-slate-50/40 opacity-75'
        textAccent = 'text-slate-400 line-through'
      } else if (e.tipo === 'venta') {
        typeLabel = 'Cobro Show'
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200'
        borderClass = 'border-emerald-100 hover:border-emerald-255 hover:shadow-sm'
        textAccent = 'text-emerald-700 font-bold'
      } else if (isOverdue) {
        typeLabel = e.tipo === 'oc' ? 'Proveedor' : e.tipo === 'servicio' ? 'Servicio' : 'Impuesto'
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
        borderClass = 'border-rose-200 bg-rose-50/10 hover:border-rose-350 hover:shadow-sm'
        textAccent = 'text-rose-700 font-black'
      } else if (e.tipo === 'servicio') {
        typeLabel = 'Servicio'
        colorClasses = 'bg-sky-50 text-sky-700 border-sky-200'
        borderClass = 'border-sky-100 hover:border-sky-250 hover:shadow-sm'
        textAccent = 'text-sky-700 font-bold'
      } else if (e.tipo === 'impuesto') {
        typeLabel = 'Impuesto'
        colorClasses = 'bg-amber-50 text-amber-700 border-amber-200'
        borderClass = 'border-amber-100 hover:border-amber-250 hover:shadow-sm'
        textAccent = 'text-amber-700 font-bold'
      } else {
        typeLabel = 'Proveedor'
        colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200'
        borderClass = 'border-indigo-100 hover:border-indigo-255 hover:shadow-sm'
        textAccent = 'text-indigo-700 font-bold'
      }

      const conceptMap: Record<'oc' | 'servicio' | 'impuesto' | 'venta' | 'iva', 'Materia Prima' | 'Servicios' | 'Impuestos' | 'VENTAS' | 'Impuestos'> = {
        oc: 'Materia Prima',
        servicio: 'Servicios',
        impuesto: 'Impuestos',
        venta: 'VENTAS',
        iva: 'Impuestos'
      }

      const docTypeMap: Record<'oc' | 'servicio' | 'impuesto' | 'venta' | 'iva', 'po' | 'servicio' | 'impuesto' | 'venta' | 'impuesto'> = {
        oc: 'po',
        servicio: 'servicio',
        impuesto: 'impuesto',
        venta: 'venta',
        iva: 'impuesto'
      }

      return (
        <div 
          key={e.id}
          className={`flex flex-col lg:flex-row justify-between items-start lg:items-center p-5 rounded-[2rem] border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 gap-4 ${borderClass}`}
        >
          {/* Left: Date, Icon & Concept */}
          <div className="flex items-center gap-4 w-full lg:w-auto">
            {/* Date block */}
            <div className="flex flex-col justify-center items-center bg-slate-50 border border-slate-100 rounded-2xl w-16 h-16 shrink-0 text-center shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-0.5">{formattedDate.split(' ')[0]}</span>
              <span className="text-lg font-black text-slate-800 leading-none">{formattedDate.split(' ')[1]}</span>
              <span className="text-[9px] font-bold text-indigo-605 uppercase leading-none mt-0.5">{formattedDate.split(' ')[2]}</span>
            </div>

            {/* Title & badge */}
            <div className="space-y-1 truncate max-w-[280px] sm:max-w-[450px] lg:max-w-[320px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${colorClasses}`}>
                  {typeLabel}
                </span>
                {isOverdue && (
                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-rose-600 text-white rounded border border-rose-700 animate-pulse">
                    ⚠️ Vencido
                  </span>
                )}
                {e.status === 'parcial' && (
                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-500 text-white rounded border border-amber-600">
                    Parcial
                  </span>
                )}
              </div>
              <h4 className={`text-xs font-black uppercase ${textAccent} truncate`}>
                {e.title}
              </h4>
              <p className="text-[10px] font-bold text-slate-400">
                Vence: {new Date(e.date + 'T12:00:00').toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>

          {/* Right: Amount & Actions */}
          <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto pt-3 lg:pt-0 border-t border-slate-100 lg:border-t-0">
            {/* Amount */}
            <div className="text-left lg:text-right">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Monto</p>
              <p className={`text-base font-black ${textAccent}`}>
                {formatCurrency(e.amount)}
              </p>
              {e.paidAmount && e.paidAmount > 0 && (
                <p className="text-[9px] font-bold text-slate-400">
                  Saldado: {formatCurrency(e.paidAmount)}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              {e.status !== 'pagado' && e.status !== 'cobrado' ? (
                <>
                  <button
                    onClick={() => {
                      if (e.tipo === 'oc') handleOpenPayPo(e.metadata)
                      else if (e.tipo === 'servicio') handleOpenPayService(e.metadata)
                      else if (e.tipo === 'impuesto' || e.tipo === 'iva') handleOpenPayTax(e.metadata)
                      else if (e.tipo === 'venta') handleOpenCollectSale(e.metadata)
                    }}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition active:scale-95 text-white ${
                      e.tipo === 'venta' 
                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : isOverdue 
                          ? 'bg-rose-600 hover:bg-rose-700' 
                          : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {e.tipo === 'venta' ? 'Cobrar' : 'Pagar'}
                  </button>
                  <button
                    onClick={() => handleOpenReconcile(
                      docTypeMap[e.tipo],
                      e.id,
                      e.amount,
                      conceptMap[e.tipo]
                    )}
                    className="px-3.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-700 transition active:scale-95 flex items-center gap-1.5"
                    title="Vincular con un movimiento de caja existente"
                  >
                    <Link2 size={12} /> Vincular
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-[9px] font-black uppercase tracking-wider">
                  <CheckCircle2 size={14} className="text-slate-400" /> completado
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Filters bar inside the agenda view */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 border border-slate-250 rounded-[2rem] shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter by Type */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Obligación:</span>
              <div className="flex bg-white rounded-xl border border-slate-200 p-0.5 shadow-sm">
                {(['all', 'payable', 'receivable'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setAgendaFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      agendaFilter === f
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-55'
                    }`}
                  >
                    {f === 'all' ? 'Todos' : f === 'payable' ? 'A Pagar' : 'A Cobrar'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
              <div className="flex bg-white rounded-xl border border-slate-200 p-0.5 shadow-sm">
                {(['all', 'pending', 'completed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setAgendaStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      agendaStatusFilter === s
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-55'
                    }`}
                  >
                    {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendientes' : 'Completados'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[10px] font-bold text-slate-400">
            Filtrados: <span className="text-slate-700 font-black">{filteredEvents.length} obligaciones</span>
          </div>
        </div>

        {/* List layout */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400">
            <CalendarIcon className="mx-auto text-slate-350 mb-4 animate-bounce" size={40} />
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Sin compromisos</h4>
            <p className="text-xs font-semibold text-slate-400 mt-1">No se encontraron cobros o pagos con los filtros seleccionados para este mes.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Overdue section */}
            {vencidos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-rose-650 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span> ⚠️ Vencimientos Atrasados
                </h4>
                <div className="space-y-3">
                  {vencidos.map(e => renderEventCard(e, true))}
                </div>
              </div>
            )}

            {/* 2. Upcoming section */}
            {proximos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                  📅 Obligaciones Pendientes del Período
                </h4>
                <div className="space-y-3">
                  {proximos.map(e => renderEventCard(e, false))}
                </div>
              </div>
            )}

            {/* 3. Completed section */}
            {completados.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  ✅ Transacciones Completadas
                </h4>
                <div className="space-y-3">
                  {completados.map(e => renderEventCard(e, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
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
  const taxSubconcepts = concepts.find(c => c.name === 'Impuestos')?.cash_subconcepts || []
  
  // Gather subconcepts for services templates (Servicios, Administracion, Estructura)
  const allowedServiceConcepts = ['Servicios', 'Administracion', 'Estructura']
  const allServiceSubconcepts = concepts
    .filter(c => allowedServiceConcepts.includes(c.name))
    .flatMap(c => (c.cash_subconcepts || []).map(s => ({
      ...s,
      conceptName: c.name
    })))

  const cutoffDate = summary?.settings?.cutoffDate || ""

  const filteredPos = pos.filter(po => {
    // Si ya está pagado, aplicar filtros de visualización y fecha de corte
    if (po.estado_pago === 'pagado') {
      if (!showPaidPos) return false
      if (!cutoffDate) return true
      const dateToCompare = po.fecha_vencimiento_pago || po.created_at?.split('T')[0]
      return dateToCompare && dateToCompare >= cutoffDate
    }
    // Si está pendiente o parcial, mostrar siempre (es una deuda activa)
    return true
  }).sort((a, b) => {
    if (poSortOrder === 'proveedor') {
      const nameA = a.proveedores?.nombre?.toLowerCase() || ""
      const nameB = b.proveedores?.nombre?.toLowerCase() || ""
      return nameA.localeCompare(nameB)
    } else {
      const dateA = a.fecha_vencimiento_pago || a.created_at || ""
      const dateB = b.fecha_vencimiento_pago || b.created_at || ""
      return dateA.localeCompare(dateB)
    }
  })

  const filteredSales = sales.filter(s => {
    // Si ya está cobrado, aplicar fecha de corte
    if (s.estado_cobro === 'cobrado') {
      if (!cutoffDate) return true
      const dateToCompare = s.fecha_cobro || s.events_master?.event_date || s.created_at?.split('T')[0]
      return dateToCompare && dateToCompare >= cutoffDate
    }
    // Si está pendiente o parcial, mostrar siempre (es una cuenta a cobrar activa)
    return true
  })

  const filteredServiceBills = serviceBills.filter(sb => {
    if (sb.estado_pago === 'pagado') {
      if (!cutoffDate) return true
      return sb.fecha_vencimiento >= cutoffDate
    }
    return true
  })

  const filteredTaxBills = taxBills.filter(tb => {
    if (tb.estado_pago === 'pagado') {
      if (!cutoffDate) return true
      return tb.fecha_vencimiento >= cutoffDate
    }
    return true
  })

  const filteredPettyMovements = pettyMovements.filter(pm => {
    if (!cutoffDate) return true
    return pm.fecha >= cutoffDate
  })

  const supplierDebts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const map: Record<string, any> = {}
    
    pos.forEach(po => {
      if (po.estado_pago === 'pagado') return
      
      const supplierName = po.proveedores?.nombre || "Proveedor Desconocido"
      const totalAmount = Number(po.costo_total) || 0
      const paidAmount = Number(po.monto_pagado) || 0
      const pendingAmount = totalAmount - paidAmount
      if (pendingAmount <= 0) return
      
      if (!map[supplierName]) {
        map[supplierName] = {
          supplierName,
          totalDebt: 0,
          overdue: { over_60: 0, d_30_60: 0, d_15_30: 0, d_7_15: 0, d_0_7: 0 },
          pending: { d_1_7: 0, d_8_14: 0, d_15_30: 0, over_30: 0 }
        }
      }
      
      const supplier = map[supplierName]
      supplier.totalDebt += pendingAmount
      
      const dueDateStr = po.fecha_vencimiento_pago || po.created_at?.split('T')[0]
      if (dueDateStr) {
        const dueDate = new Date(dueDateStr + 'T12:00:00')
        dueDate.setHours(0, 0, 0, 0)
        
        const diffTime = dueDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) {
          // Overdue (Vencido)
          const absDays = Math.abs(diffDays)
          if (absDays > 60) {
            supplier.overdue.over_60 += pendingAmount
          } else if (absDays > 30) {
            supplier.overdue.d_30_60 += pendingAmount
          } else if (absDays > 15) {
            supplier.overdue.d_15_30 += pendingAmount
          } else if (absDays > 7) {
            supplier.overdue.d_7_15 += pendingAmount
          } else {
            supplier.overdue.d_0_7 += pendingAmount
          }
        } else {
          // Pending (Sin vencer)
          if (diffDays <= 7) {
            supplier.pending.d_1_7 += pendingAmount
          } else if (diffDays <= 14) {
            supplier.pending.d_8_14 += pendingAmount
          } else if (diffDays <= 30) {
            supplier.pending.d_15_30 += pendingAmount
          } else {
            supplier.pending.over_30 += pendingAmount
          }
        }
      } else {
        supplier.overdue.d_0_7 += pendingAmount
      }
    })
    
    return Object.values(map).sort((a: any, b: any) => b.totalDebt - a.totalDebt)
  }, [pos])

  const debtSummaryTotals = useMemo(() => {
    let overdueTotal = 0
    let pendingTotal = 0
    supplierDebts.forEach((s: any) => {
      overdueTotal += s.overdue.over_60 + s.overdue.d_30_60 + s.overdue.d_15_30 + s.overdue.d_7_15 + s.overdue.d_0_7
      pendingTotal += s.pending.d_1_7 + s.pending.d_8_14 + s.pending.d_15_30 + s.pending.over_30
    })
    return { overdueTotal, pendingTotal, total: overdueTotal + pendingTotal }
  }, [supplierDebts])

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
          { id: 'taxes', label: 'Liquidación de Impuestos' },
          { id: 'petty', label: 'Caja Chica' }
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Calendario Financiero</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Visualización consolidada de cobros (verde), proveedores (violeta), servicios (celeste), impuestos (amarillo), deudas vencidas (rojo) y obligaciones pagadas (gris).
                    </p>
                  </div>
                  {/* View Selector Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-center shrink-0 shadow-sm gap-1">
                    <button
                      onClick={() => setCalendarView('month')}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        calendarView === 'month'
                          ? 'bg-white text-indigo-600 shadow-md font-bold'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                      }`}
                    >
                      Mes
                    </button>
                    <button
                      onClick={() => setCalendarView('week')}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        calendarView === 'week'
                          ? 'bg-white text-indigo-600 shadow-md font-bold'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                      }`}
                    >
                      Semana
                    </button>
                    <button
                      onClick={() => setCalendarView('agenda')}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        calendarView === 'agenda'
                          ? 'bg-white text-indigo-600 shadow-md font-bold'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                      }`}
                    >
                      Cronograma
                    </button>
                  </div>
                </div>

                {/* Estructura de Deuda por Proveedor */}
                <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-6 shadow-sm">
                  <button
                    onClick={() => setShowDebtStructure(prev => !prev)}
                    className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left focus:outline-none"
                  >
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        📊 Estructura de Deuda por Proveedor
                      </h4>
                      <p className="text-[11px] text-slate-500 font-semibold mt-1">
                        Composición de saldos vencidos y por vencer agrupados por proveedor y plazos.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-[10px] font-bold text-slate-500">
                        <span className="block font-black text-xs text-slate-850">
                          Total: {formatCurrency(debtSummaryTotals.total)}
                        </span>
                        <span className="text-rose-600 font-black">Vencido: {formatCurrency(debtSummaryTotals.overdueTotal)}</span>
                        {" • "}
                        <span className="text-emerald-600 font-black">Por Vencer: {formatCurrency(debtSummaryTotals.pendingTotal)}</span>
                      </div>
                      <span className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-[9px] font-black uppercase text-indigo-600 tracking-wider hover:bg-slate-100 transition shadow-sm">
                        {showDebtStructure ? "Ocultar" : "Ver Detalle"}
                      </span>
                    </div>
                  </button>

                  {showDebtStructure && (
                    <div className="mt-6 border-t border-slate-200 pt-6 animate-in slide-in-from-top-4 duration-300">
                      {supplierDebts.length === 0 ? (
                        <p className="text-center text-xs font-bold text-slate-400 py-4 uppercase tracking-widest">
                          No hay deudas de proveedores pendientes en este momento
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {supplierDebts.map((s: any, idx: number) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
                              <div>
                                <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2.5">
                                  <h5 className="font-black text-xs text-slate-850 uppercase truncate max-w-[170px]" title={s.supplierName}>
                                    {s.supplierName}
                                  </h5>
                                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg shrink-0 shadow-sm">
                                    {formatCurrency(s.totalDebt)}
                                  </span>
                                </div>

                                <div className="space-y-3 mt-3">
                                  {/* Overdue (Vencido) Section */}
                                  <div>
                                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1.5">Vencido</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {s.overdue.over_60 > 0 && (
                                        <span className="text-[9px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                          &gt;60d: {formatCurrency(s.overdue.over_60)}
                                        </span>
                                      )}
                                      {s.overdue.d_30_60 > 0 && (
                                        <span className="text-[9px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                          30-60d: {formatCurrency(s.overdue.d_30_60)}
                                        </span>
                                      )}
                                      {s.overdue.d_15_30 > 0 && (
                                        <span className="text-[9px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                          15-30d: {formatCurrency(s.overdue.d_15_30)}
                                        </span>
                                      )}
                                      {s.overdue.d_7_15 > 0 && (
                                        <span className="text-[9px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                          7-15d: {formatCurrency(s.overdue.d_7_15)}
                                        </span>
                                      )}
                                      {s.overdue.d_0_7 > 0 && (
                                        <span className="text-[9px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                          0-7d: {formatCurrency(s.overdue.d_0_7)}
                                        </span>
                                      )}
                                      {(Object.values(s.overdue) as number[]).reduce((a, b) => a + b, 0) === 0 && (
                                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md italic">
                                          Sin deuda vencida
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Pending (Sin Vencer) Section */}
                                  <div>
                                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Sin Vencer</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {s.pending.d_1_7 > 0 && (
                                        <span className="text-[9px] font-black text-emerald-850 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                          1-7d: {formatCurrency(s.pending.d_1_7)}
                                        </span>
                                      )}
                                      {s.pending.d_8_14 > 0 && (
                                        <span className="text-[9px] font-black text-emerald-850 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                          8-14d: {formatCurrency(s.pending.d_8_14)}
                                        </span>
                                      )}
                                      {s.pending.d_15_30 > 0 && (
                                        <span className="text-[9px] font-black text-emerald-850 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                          15-30d: {formatCurrency(s.pending.d_15_30)}
                                        </span>
                                      )}
                                      {s.pending.over_30 > 0 && (
                                        <span className="text-[9px] font-black text-emerald-850 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                          &gt;30d: {formatCurrency(s.pending.over_30)}
                                        </span>
                                      )}
                                      {(Object.values(s.pending) as number[]).reduce((a, b) => a + b, 0) === 0 && (
                                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md italic">
                                          Sin vencimientos futuros
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {loadingEvents ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                ) : calendarView === 'month' ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
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
                ) : calendarView === 'week' ? (
                  <div className="animate-in fade-in duration-300">
                    {renderWeek()}
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300">
                    {renderAgenda()}
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Órdenes de Compra por Liquidar</h3>
                    <p className="text-xs text-slate-500 font-medium">Listado de órdenes recibidas pendientes de pago total o parcial.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-2xl shadow-sm text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showPaidPos}
                        onChange={(e) => setShowPaidPos(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mostrar Liquidadas</span>
                    </label>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-2xl shadow-sm">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ordenar:</span>
                      <select
                        value={poSortOrder}
                        onChange={(e) => setPoSortOrder(e.target.value as any)}
                        className="bg-transparent text-xs font-black uppercase tracking-wider text-indigo-600 outline-none cursor-pointer"
                      >
                        <option value="vencimiento">Vencimiento</option>
                        <option value="proveedor">Proveedor</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Proveedor</th>
                        <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Fecha Registro</th>
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
                        const regDate = po.created_at ? new Date(po.created_at.split('T')[0] + 'T12:00:00').toLocaleDateString('es-AR') : 'Sin fecha'
                        return (
                          <tr key={po.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-bold text-slate-800">
                              <p className="font-black truncate max-w-[200px]">{po.proveedores?.nombre}</p>
                              <p className="text-[10px] font-medium text-slate-400">ID: {po.id.split('-')[0]}...</p>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <input 
                                type="date"
                                value={po.created_at ? po.created_at.split('T')[0] : ""}
                                onChange={(e) => handleUpdatePOField(po.id, 'created_at', e.target.value)}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                              />
                            </td>
                            <td className="py-4 px-4 text-center">
                              <input 
                                type="date"
                                value={po.fecha_vencimiento_pago || ""}
                                onChange={(e) => handleUpdatePOField(po.id, 'fecha_vencimiento_pago', e.target.value)}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                              />
                              {isOverdue && <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mt-1">Vencida</span>}
                            </td>
                            <td className="py-4 px-4 text-right font-black text-slate-700">{formatCurrency(po.costo_total)}</td>
                            <td className="py-4 px-4 text-right font-black text-emerald-600">{formatCurrency(po.monto_pagado || 0)}</td>
                            <td className="py-4 px-4 text-center">
                              <select
                                value={po.estado_pago || 'pendiente'}
                                onChange={(e) => handleUpdatePOField(po.id, 'estado_pago', e.target.value as any)}
                                className={`px-2 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border outline-none cursor-pointer ${
                                  po.estado_pago === 'pagado'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : po.estado_pago === 'parcial'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-650 border-slate-200'
                                }`}
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="parcial">Parcial</option>
                                <option value="pagado">Pagado</option>
                              </select>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex justify-center gap-2">
                                {po.estado_pago !== 'pagado' ? (
                                  <>
                                    <button 
                                      onClick={() => handleOpenPayPo(po)}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
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
                              <td className="py-4 px-4 text-right font-black text-slate-700">
                                <div className="flex items-center justify-end gap-1.5 group">
                                  <span>{formatCurrency(bill.monto)}</span>
                                  <button 
                                    onClick={() => handleOpenEditBill('servicio', bill)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Editar Vencimiento"
                                  >
                                    <Edit size={12} />
                                  </button>
                                </div>
                              </td>
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
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
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
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${serv.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {serv.activo ? 'Recurrente' : 'No Recurrente'}
                            </span>
                            {!serv.activo && (
                              <button
                                onClick={() => handleGenerarManual('servicio', serv.id, serv.nombre)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition"
                                title="Generar para este mes"
                              >
                                Generar
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEditTemplate('servicio', serv)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition"
                              title="Editar Plantilla"
                            >
                              <Edit size={14} />
                            </button>
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
            {/* Panel 6: Taxes (Liquidación de Impuestos) */}
            {activeTab === 'taxes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Liquidación de Impuestos</h3>
                    <p className="text-xs text-slate-500 font-medium">Control de impuestos recurrentes, planes de pago y vencimientos fiscales.</p>
                  </div>
                  
                  {/* Selector Subtab */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setTaxesTab('vencimientos')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        taxesTab === 'vencimientos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Vencimientos del Mes
                    </button>
                    <button 
                      onClick={() => setTaxesTab('templates')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        taxesTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Plantillas de Impuestos
                    </button>
                  </div>
                </div>

                {taxesTab === 'vencimientos' ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Impuesto</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Vencimiento</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Monto</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Estado Pago</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Fecha Pago</th>
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTaxBills.map((bill) => {
                          const isOverdue = new Date(bill.fecha_vencimiento) < new Date() && bill.estado_pago !== 'pagado'
                          return (
                            <tr key={bill.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-4 px-6 font-bold text-slate-800">
                                <p className="font-black uppercase">{bill.impuestos?.nombre}</p>
                                <p className="text-[10px] font-medium text-slate-400">Ente Recaudador: {bill.impuestos?.ente_recaudador || '--'}</p>
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-slate-600">
                                {new Date(bill.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}
                                {isOverdue && <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest">Vencido</span>}
                              </td>
                              <td className="py-4 px-4 text-right font-black text-slate-700">
                                <div className="flex items-center justify-end gap-1.5 group">
                                  <span>{formatCurrency(bill.monto)}</span>
                                  <button 
                                    onClick={() => handleOpenEditBill('impuesto', bill)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Editar Vencimiento"
                                  >
                                    <Edit size={12} />
                                  </button>
                                </div>
                              </td>
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
                                        onClick={() => handleOpenPayTax(bill)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition"
                                      >
                                        Pagar
                                      </button>
                                      <button 
                                        onClick={() => handleOpenReconcile('impuesto', bill.id, bill.monto, 'Impuestos')}
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
                                        onClick={() => handleOpenRevert('impuesto', bill.id, bill.cash_movement_id, bill.monto)}
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
                        {taxBills.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No hay vencimientos de impuestos activos en este mes</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Listado de Plantillas de Impuestos</h4>
                      <button 
                        onClick={() => setCreateTaxModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Nueva Plantilla
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {taxesTemplates.map((tax) => (
                        <div key={tax.id} className="bg-white border border-slate-200 p-5 rounded-[2rem] hover:shadow-md transition flex justify-between items-center">
                          <div>
                            <h4 className="font-black text-sm text-slate-800 uppercase leading-snug">{tax.nombre}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">
                              Ente: {tax.ente_recaudador || '--'} • Vence el día habitual: {tax.dia_vencimiento_habitual}
                            </p>
                            <p className="text-[10px] font-black text-indigo-600 uppercase mt-0.5">
                              Monto Estimado: {formatCurrency(tax.monto_estimado)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${tax.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {tax.activo ? 'Recurrente' : 'No Recurrente'}
                            </span>
                            {!tax.activo && (
                              <button
                                onClick={() => handleGenerarManual('impuesto', tax.id, tax.nombre)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition"
                                title="Generar para este mes"
                              >
                                Generar
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEditTemplate('impuesto', tax)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition"
                              title="Editar Plantilla"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleTax(tax.id, !tax.activo)}
                              className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition ${
                                tax.activo 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-500 hover:text-white hover:border-rose-500' 
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                              }`}
                            >
                              {tax.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Panel 7: Petty Cash (Caja Chica) */}
            {activeTab === 'petty' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Caja Chica</h3>
                    <p className="text-xs text-slate-500 font-medium">Gastos directos registrados que no pasan por orden de compra o facturas de servicios.</p>
                  </div>
                  <button 
                    onClick={handleOpenPettyModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-md"
                  >
                    <Plus size={14} /> Registrar Gasto Caja Chica
                  </button>
                </div>

                {loadingPetty ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Detalle</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider">Subrubro</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Cuenta</th>
                          <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Importe</th>
                          <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPettyMovements.map((mv) => {
                          const isCancellation = mv.hash_id?.startsWith('cc_rev_')
                          return (
                            <tr key={mv.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-4 px-6 font-bold text-slate-600">
                                {new Date(mv.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                              </td>
                              <td className="py-4 px-6">
                                <p className={`font-black ${isCancellation ? 'text-emerald-600 italic' : 'text-slate-800'}`}>{mv.detalle}</p>
                                <p className="text-[9px] font-medium text-slate-400">ID: {mv.id.split('-')[0]}...</p>
                              </td>
                              <td className="py-4 px-4 font-bold text-slate-500 uppercase">
                                {mv.cash_subconcepts?.name || mv.conc_caja}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <select
                                  value={mv.cuenta_bancaria || 'efectivo'}
                                  onChange={(e) => handleUpdateCashMovementField(mv.id, 'cuenta_bancaria', e.target.value as any)}
                                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border outline-none cursor-pointer ${
                                    mv.cuenta_bancaria === 'mercado pago'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : mv.cuenta_bancaria === 'banco galicia'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : mv.cuenta_bancaria === 'tarjeta de credito'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : mv.cuenta_bancaria === 'pago fer'
                                      ? 'bg-pink-50 text-pink-700 border-pink-200'
                                      : mv.cuenta_bancaria === 'pago gaston'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-slate-50 text-slate-650 border-slate-200'
                                  }`}
                                >
                                  <option value="efectivo">Efectivo</option>
                                  <option value="mercado pago">Mercado Pago</option>
                                  <option value="banco galicia">Galicia</option>
                                  <option value="tarjeta de credito">Tarjeta de Crédito</option>
                                  <option value="pago fer">Pago Fer</option>
                                  <option value="pago gaston">Pago Gaston</option>
                                </select>
                              </td>
                              <td className={`py-4 px-4 text-right font-black ${mv.importe < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {formatCurrency(mv.importe)}
                              </td>
                              <td className="py-4 px-6 text-center">
                                {mv.importe < 0 ? (
                                  <button
                                    onClick={() => handleOpenAnularPetty(mv)}
                                    className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black uppercase tracking-wider text-[9px] px-3.5 py-1.5 rounded-xl transition"
                                    title="Anular gasto generando contrasiento"
                                  >
                                    Anular
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                    Compensatorio
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {filteredPettyMovements.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No hay egresos directos de caja chica en este período</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
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
                  <option value="tarjeta de credito">Tarjeta de Crédito</option>
                  <option value="pago fer">Pago Fer</option>
                  <option value="pago gaston">Pago Gaston</option>
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

      {/* Modal 2: Register Collection (Ventas) with Split Payments */}
      {collectSaleModal.open && collectSaleModal.sale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Registrar Cobro de Venta</h3>
            <p className="text-xs text-slate-400 font-medium mb-4">Completa los datos para asentar el cobro dividido del Show.</p>
            
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 mb-4 text-xs font-bold text-slate-600 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>Total Show:</span>
                <span>{formatCurrency(collectSaleModal.sale.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cobrado Histórico:</span>
                <span className="text-emerald-600">{formatCurrency(collectSaleModal.sale.monto_cobrado || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-black text-slate-800">
                <span>Saldo Pendiente:</span>
                <span className="text-rose-600">
                  {formatCurrency(Number(collectSaleModal.sale.total_amount) - Number(collectSaleModal.sale.monto_cobrado || 0))}
                </span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleExecuteCollectSale(); }} className="space-y-4">
              <div className="space-y-2.5">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Montos por Cuenta</label>
                
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number"
                      placeholder="Monto Efectivo"
                      value={splitAmounts.efectivo || ''}
                      onChange={(e) => setSplitAmounts(prev => ({ ...prev, efectivo: Number(e.target.value) }))}
                      className="w-full pl-7 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider text-slate-400">Efectivo</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number"
                      placeholder="Monto Mercado Pago"
                      value={splitAmounts["mercado pago"] || ''}
                      onChange={(e) => setSplitAmounts(prev => ({ ...prev, "mercado pago": Number(e.target.value) }))}
                      className="w-full pl-7 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider text-indigo-500">Mercado Pago</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number"
                      placeholder="Monto Banco Galicia"
                      value={splitAmounts["banco galicia"] || ''}
                      onChange={(e) => setSplitAmounts(prev => ({ ...prev, "banco galicia": Number(e.target.value) }))}
                      className="w-full pl-7 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider text-indigo-700">Banco Galicia</span>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 flex justify-between items-center text-xs font-bold text-indigo-950">
                <span>Total a Cobrar en Split:</span>
                <span className="font-black text-sm">
                  {formatCurrency(Number(splitAmounts.efectivo) + Number(splitAmounts["mercado pago"]) + Number(splitAmounts["banco galicia"]))}
                </span>
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

              <div className="flex items-center gap-3 py-1 select-none">
                <input 
                  type="checkbox"
                  id="generarCajaSale"
                  checked={formGenerarCaja}
                  onChange={(e) => setFormGenerarCaja(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generarCajaSale" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Generar movimientos en Flujo de Caja
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition shadow-md active:scale-98"
                >
                  Confirmar Cobro
                </button>
                <button 
                  type="button"
                  onClick={() => setCollectSaleModal({ open: false, sale: null })}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold text-xs rounded-2xl transition"
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
                  <option value="tarjeta de credito">Tarjeta de Crédito</option>
                  <option value="pago fer">Pago Fer</option>
                  <option value="pago gaston">Pago Gaston</option>
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
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Imputación Concepto/Subrubro</label>
                <select
                  value={newServiceSubconcept}
                  onChange={(e) => setNewServiceSubconcept(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Subrubro --</option>
                  {allServiceSubconcepts.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.conceptName} &gt; {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox"
                  id="newServiceActivo"
                  checked={newServiceActivo}
                  onChange={(e) => setNewServiceActivo(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="newServiceActivo" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  Obligación mensual recurrente (se genera automáticamente)
                </label>
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

      {/* Modal 8: Petty Cash Expense Registration */}
      {pettyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Registrar Gasto de Caja Chica</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Completa los datos para asentar un gasto directo sin orden de compra.</p>
            
            <form onSubmit={handleExecuteCreatePetty} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto ($)</label>
                <input 
                  type="number"
                  value={pettyMonto}
                  onChange={(e) => setPettyMonto(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Fecha</label>
                <input 
                  type="date"
                  value={pettyFecha}
                  onChange={(e) => setPettyFecha(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Concepto Principal (Egreso)</label>
                <select
                  value={pettyConcept}
                  onChange={(e) => {
                    setPettyConcept(e.target.value)
                    setPettySubconcept("")
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Rubro --</option>
                  {concepts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {pettyConcept && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Subconcepto Imputación</label>
                  <select
                    value={pettySubconcept}
                    onChange={(e) => setPettySubconcept(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    <option value="">-- Seleccionar Subrubro --</option>
                    {(concepts.find(c => c.id === pettyConcept)?.cash_subconcepts || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Cuenta Bancaria / Caja</label>
                <select
                  value={pettyCuenta}
                  onChange={(e) => setPettyCuenta(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="mercado pago">Mercado Pago</option>
                  <option value="banco galicia">Banco Galicia</option>
                  <option value="tarjeta de credito">Tarjeta de Crédito</option>
                  <option value="pago fer">Pago Fer</option>
                  <option value="pago gaston">Pago Gaston</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nota / Detalle</label>
                <input 
                  type="text"
                  placeholder="Ej: Articulos de limpieza"
                  value={pettyDetalle}
                  onChange={(e) => setPettyDetalle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs py-3 rounded-2xl transition shadow-md"
                >
                  Registrar Gasto
                </button>
                <button 
                  type="button"
                  onClick={() => setPettyModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 9: Confirm Petty Cash Annulation */}
      {anularPettyModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <RotateCcw className="mx-auto text-rose-500 mb-4" size={40} />
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">¿Confirmar Anulación de Gasto?</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">
              Esta acción registrará un contrasiento de signo positivo por valor de <strong>{formatCurrency(anularPettyModal.amount)}</strong> para anular contablemente el gasto: <em>"{anularPettyModal.detail}"</em>. Esto mantiene la inmutabilidad de la caja.
            </p>
            
            <div className="flex gap-2 justify-center">
              <button 
                onClick={handleExecuteAnularPetty}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider text-xs px-6 py-3 rounded-2xl transition flex-1"
              >
                Anular Gasto
              </button>
              <button 
                onClick={() => setAnularPettyModal({ open: false, movementId: "", amount: 0, detail: "" })}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 10: Create Tax Template */}
      {createTaxModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Crear Plantilla de Impuesto</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Registra un impuesto o tasa recurrente en la agenda fiscal.</p>
            
            <form onSubmit={handleCreateTax} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nombre del Impuesto / Obligación</label>
                <input 
                  type="text"
                  placeholder="Ej: Cargas Sociales Formulario 931"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Ente Recaudador</label>
                <input 
                  type="text"
                  placeholder="Ej: AFIP o Municipalidad"
                  value={newTaxEnte}
                  onChange={(e) => setNewTaxEnte(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Costo Estimado ($)</label>
                  <input 
                    type="number"
                    value={newTaxMonto}
                    onChange={(e) => setNewTaxMonto(e.target.value)}
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
                    value={newTaxDay}
                    onChange={(e) => setNewTaxDay(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Imputación Subrubro de Impuestos</label>
                <select
                  value={newTaxSubconcept}
                  onChange={(e) => setNewTaxSubconcept(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Subrubro --</option>
                  {taxSubconcepts.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox"
                  id="newTaxActivo"
                  checked={newTaxActivo}
                  onChange={(e) => setNewTaxActivo(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="newTaxActivo" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  Obligación mensual recurrente (se genera automáticamente)
                </label>
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
                  onClick={() => setCreateTaxModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 11: Register Payment (Impuestos) */}
      {payTaxModal.open && payTaxModal.bill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Pagar Obligación Fiscal</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Registra el pago de la factura impositiva.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleExecutePayTax(); }} className="space-y-4">
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
                  <option value="tarjeta de credito">Tarjeta de Crédito</option>
                  <option value="pago fer">Pago Fer</option>
                  <option value="pago gaston">Pago Gaston</option>
                </select>
              </div>

              <div className="flex items-center gap-3 py-2 select-none">
                <input 
                  type="checkbox"
                  id="generarCajaTax"
                  checked={formGenerarCaja}
                  onChange={(e) => setFormGenerarCaja(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generarCajaTax" className="text-xs font-bold text-slate-600 cursor-pointer">
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
                  onClick={() => setPayTaxModal({ open: false, bill: null })}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 12: Edit Template Modal */}
      {editTemplateModal.open && editTemplateModal.template && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">
              Editar Plantilla de {editTemplateModal.type === 'servicio' ? 'Servicio' : 'Impuesto'}
            </h3>
            <p className="text-xs text-slate-400 font-medium mb-6">
              Modifica los detalles de la plantilla de liquidación.
            </p>
            
            <form onSubmit={handleEditTemplateSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Nombre</label>
                <input 
                  type="text"
                  value={editTemplateName}
                  onChange={(e) => setEditTemplateName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  {editTemplateModal.type === 'servicio' ? 'Proveedor' : 'Ente Recaudador'}
                </label>
                <input 
                  type="text"
                  value={editTemplateEnteOrProveedor}
                  onChange={(e) => setEditTemplateEnteOrProveedor(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Costo Estimado ($)</label>
                  <input 
                    type="number"
                    value={editTemplateMonto}
                    onChange={(e) => setEditTemplateMonto(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Día Vence (1 al 31)</label>
                  <input 
                    type="number"
                    min="1"
                    max="31"
                    value={editTemplateDay}
                    onChange={(e) => setEditTemplateDay(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  {editTemplateModal.type === 'servicio' ? 'Imputación Concepto/Subrubro' : 'Imputación Subrubro de Impuestos'}
                </label>
                <select
                  value={editTemplateSubconcept}
                  onChange={(e) => setEditTemplateSubconcept(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600"
                  required
                >
                  <option value="">-- Seleccionar Subrubro --</option>
                  {editTemplateModal.type === 'servicio' ? (
                    allServiceSubconcepts.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.conceptName} &gt; {s.name}</option>
                    ))
                  ) : (
                    taxSubconcepts.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox"
                  id="editTemplateActivo"
                  checked={editTemplateActivo}
                  onChange={(e) => setEditTemplateActivo(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="editTemplateActivo" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  Obligación mensual recurrente (se genera automáticamente)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditTemplateModal({ open: false, type: 'servicio', template: null })}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditTemplate}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 disabled:opacity-50 font-black"
                >
                  {isSavingEditTemplate ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {editBillModal.open && editBillModal.bill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">Editar Vencimiento</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">
              Modifica los detalles del vencimiento de {editBillModal.type === 'servicio' ? 'servicio' : 'impuesto'}.
            </p>
            
            <form onSubmit={handleEditBillSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Monto ($)</label>
                <input 
                  type="number"
                  step="any"
                  value={editBillForm.monto}
                  onChange={(e) => setEditBillForm(prev => ({ ...prev, monto: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Fecha de Vencimiento</label>
                <input 
                  type="date"
                  value={editBillForm.fecha_vencimiento}
                  onChange={(e) => setEditBillForm(prev => ({ ...prev, fecha_vencimiento: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600"
                  required
                />
              </div>

              {editBillModal.bill.cash_movement_id && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h5 className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Atención: Vencimiento Pagado</h5>
                    <p className="text-[10px] font-semibold text-amber-700 mt-0.5">
                      Este vencimiento ya fue marcado como pagado. Al guardar el cambio, se actualizará automáticamente el importe del movimiento en el libro diario para mantener la consistencia.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditBillModal({ open: false, type: 'servicio', bill: null })}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditBill}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEditBill ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </form>
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
