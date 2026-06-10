"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  ArrowLeft, CheckCircle2, AlertCircle, Sparkles, HelpCircle, 
  DollarSign, Landmark, Calendar, ShoppingCart, UserCheck, 
  ChevronRight, ChevronLeft, Loader2, Save, Trash2, Check, ArrowRight
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  getTreasurySummaryAction, 
  updateTreasurySettingsAction,
  marcarVentaComoCobradaHistoricaAction,
  marcarPOComoPagadaHistoricaAction,
  crearDeudaAdHocAction,
  seedPendingDebtsAction,
  marcarTodasVentasCobradasHistoricasAction,
  marcarTodosPOsPagadosHistoricosAction,
  TreasurySummary
} from "@/app/actions/tesoreria"

export default function PuntoPartidaPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [summary, setSummary] = useState<TreasurySummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)

  // Step 1: Settings Form States
  const [cutoffDate, setCutoffDate] = useState("")
  const [mpStarting, setMpStarting] = useState("")
  const [galiciaStarting, setGaliciaStarting] = useState("")
  const [efectivoStarting, setEfectivoStarting] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)

  // Step 2 & 3 Data Lists
  const [pendingSales, setPendingSales] = useState<any[]>([])
  const [pendingPOs, setPendingPOs] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Ad-hoc PO Form States
  const [newAdhocProv, setNewAdhocProv] = useState("")
  const [newAdhocMonto, setNewAdhocMonto] = useState("")
  const [newAdhocFecha, setNewAdhocFecha] = useState("")
  const [addingAdhoc, setAddingAdhoc] = useState(false)
  const [seedingDebts, setSeedingDebts] = useState(false)
  const [processingBulkSales, setProcessingBulkSales] = useState(false)
  const [processingBulkPOs, setProcessingBulkPOs] = useState(false)

  const supabase = createClient()

  // Load summary and settings
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    const res = await getTreasurySummaryAction()
    if (res.success && res.data) {
      setSummary(res.data)
      setCutoffDate(res.data.settings.cutoffDate || "")
      setMpStarting(String(res.data.settings.mpStarting || 0))
      setGaliciaStarting(String(res.data.settings.galiciaStarting || 0))
      setEfectivoStarting(String(res.data.settings.efectivoStarting || 0))
    }
    setLoadingSummary(false)
  }, [])

  // Load historical pending POs and Sales
  const loadPendingData = useCallback(async () => {
    setLoadingData(true)
    try {
      // Fetch Unpaid Sales Headers
      const { data: salesData } = await supabase
        .from('event_sales_headers')
        .select(`
          id,
          total_amount,
          monto_cobrado,
          company_name,
          created_at,
          events_master!event_master_id (
            id,
            event_date,
            show_name
          )
        `)
        .in('estado_cobro', ['pendiente', 'parcial'])
        .order('created_at', { ascending: true })

      if (salesData) setPendingSales(salesData)

      // Fetch Unpaid Received Purchase Orders
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          costo_total,
          monto_pagado,
          created_at,
          fecha_vencimiento_pago,
          plazo_pago,
          proveedores (nombre)
        `)
        .eq('estado', 'RECIBIDA')
        .in('estado_pago', ['pendiente', 'parcial'])
        .order('created_at', { ascending: true })

      if (poData) setPendingPOs(poData)

      // Fetch all suppliers for the ad-hoc datalist
      const { data: provData } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .order('nombre')

      if (provData) setProveedores(provData || [])

    } catch (err) {
      console.error("Error loading pending data:", err)
    } finally {
      setLoadingData(false)
    }
  }, [supabase])

  useEffect(() => {
    loadSummary()
    loadPendingData()
  }, [loadSummary, loadPendingData])

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  // Save Step 1 settings
  const handleSaveSettings = async () => {
    if (!cutoffDate) {
      alert("Por favor, seleccioná una fecha de corte de inicio desde cero.")
      return
    }

    setSavingSettings(true)
    const res = await updateTreasurySettingsAction(
      cutoffDate,
      Number(mpStarting) || 0,
      Number(galiciaStarting) || 0,
      Number(efectivoStarting) || 0
    )

    if (res.success) {
      alert("Saldos iniciales y fecha de corte actualizados con éxito.")
      await loadSummary()
      setCurrentStep(2) // Advance to step 2
    } else {
      alert("Error al actualizar configuración: " + res.error)
    }
    setSavingSettings(false)
  }

  // Mark sale as collected historically (Clean up debt)
  const handleMarkSaleCollected = async (id: string) => {
    if (!window.confirm("¿Confirmás que este show ya fue cobrado históricamente? Se marcará como cobrado al 100% y no generará movimientos de caja nuevos.")) {
      return
    }

    setProcessingId(id)
    const res = await marcarVentaComoCobradaHistoricaAction(id)
    if (res.success) {
      setPendingSales(prev => prev.filter(s => s.id !== id))
    } else {
      alert("Error: " + res.error)
    }
    setProcessingId(null)
  }

  // Mark PO as paid historically (Clean up debt)
  const handleMarkPOPaid = async (id: string) => {
    if (!window.confirm("¿Confirmás que esta orden de compra ya fue abonada históricamente? Se marcará como pagada al 100% y no generará egresos en caja.")) {
      return
    }

    setProcessingId(id)
    const res = await marcarPOComoPagadaHistoricaAction(id)
    if (res.success) {
      setPendingPOs(prev => prev.filter(p => p.id !== id))
    }
    setProcessingId(null)
  }

  // Handle manual ad-hoc PO registration
  const handleAddAdhocDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdhocProv.trim() || !newAdhocMonto) {
      alert("Por favor, ingresá el nombre del proveedor y el monto.")
      return
    }

    // Split by '+' to support loading multiple amounts for the same supplier
    const valStr = newAdhocMonto
    const parts = valStr.split('+')
    const amounts: number[] = []

    for (const part of parts) {
      let clean = part.trim().replace('$', '')
      if (!clean) continue

      // Clean decimals and thousands separators (Argentine style fallback)
      if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.')
      } else if (clean.includes(',')) {
        const commaIdx = clean.indexOf(',')
        const decimals = clean.length - 1 - commaIdx
        if (decimals === 3) {
          clean = clean.replace(/,/g, '')
        } else {
          clean = clean.replace(',', '.')
        }
      } else if (clean.includes('.')) {
        const dotIdx = clean.indexOf('.')
        const decimals = clean.length - 1 - dotIdx
        if (decimals === 3) {
          clean = clean.replace(/\./g, '')
        }
      }

      const num = Number(clean)
      if (!isNaN(num)) {
        amounts.push(num)
      }
    }

    if (amounts.length === 0) {
      alert("El monto ingresado no es válido.")
      return
    }

    setAddingAdhoc(true)
    let successCount = 0
    let lastError = ""

    for (const amt of amounts) {
      const res = await crearDeudaAdHocAction(
        newAdhocProv,
        amt,
        newAdhocFecha || new Date().toISOString().split('T')[0]
      )
      if (res.success) {
        successCount++
      } else {
        lastError = res.error || "Error desconocido"
      }
    }

    if (successCount > 0) {
      setNewAdhocProv("")
      setNewAdhocMonto("")
      setNewAdhocFecha("")
      alert(`Se registraron ${successCount} deudas ad-hoc con éxito.` + (lastError ? ` (Error en algunas: ${lastError})` : ''))
      await loadPendingData()
      await loadSummary()
    } else {
      alert("Error: " + lastError)
    }
    setAddingAdhoc(false)
  }

  // Handle bulk seeding of the user's pending debts
  const handleSeedDebts = async () => {
    if (!window.confirm("¿Querés precargar todas las deudas pendientes del listado de Excel? Se agregarán las deudas que falten sin duplicar las existentes.")) {
      return
    }
    setSeedingDebts(true)
    const res = await seedPendingDebtsAction()
    if (res.success) {
      alert("¡Listado de deudas precargado con éxito!")
      await loadPendingData()
      await loadSummary()
    } else {
      alert("Error al precargar deudas: " + res.error)
    }
    setSeedingDebts(false)
  }

  // Bulk mark all historical sales as collected
  const handleMarkAllSalesCollected = async () => {
    if (!cutoffDate) return
    if (!window.confirm("¿Confirmás que querés marcar TODOS los shows históricos como YA COBRADOS en lote? Se actualizarán todos a cobrados al 100% sin generar movimientos en caja.")) {
      return
    }
    setProcessingBulkSales(true)
    const res = await marcarTodasVentasCobradasHistoricasAction(cutoffDate)
    if (res.success) {
      alert(`Se marcaron ${res.count} cobros históricos como cobrados con éxito.`);
      await loadPendingData()
      await loadSummary()
    } else {
      alert("Error: " + res.error)
    }
    setProcessingBulkSales(false)
  }

  // Bulk mark all historical POs as paid
  const handleMarkAllPOsPaid = async () => {
    if (!cutoffDate) return
    if (!window.confirm("¿Confirmás que querés marcar TODAS las órdenes de compra históricas como YA PAGADAS en lote? Se actualizarán todas a pagadas al 100% sin generar egresos en caja.")) {
      return
    }
    setProcessingBulkPOs(true)
    const res = await marcarTodosPOsPagadosHistoricosAction(cutoffDate)
    if (res.success) {
      alert(`Se marcaron ${res.count} pagos históricos como pagados con éxito.`);
      await loadPendingData()
      await loadSummary()
    } else {
      alert("Error: " + res.error)
    }
    setProcessingBulkPOs(false)
  }

  // Filter historical lists to show items BEFORE cutoff date and sort them
  const historicalSales = pendingSales
    .filter(s => {
      if (!cutoffDate) return true
      const eventDate = s.events_master?.event_date || s.created_at?.split('T')[0]
      return eventDate && eventDate < cutoffDate
    })
    .sort((a, b) => {
      const nameA = a.company_name || ""
      const nameB = b.company_name || ""
      return nameA.localeCompare(nameB)
    })

  const historicalPOs = pendingPOs
    .filter(po => {
      if (po.plazo_pago === 'ad-hoc') return true
      if (!cutoffDate) return true
      const dateToCompare = po.fecha_vencimiento_pago || po.created_at?.split('T')[0]
      return dateToCompare && dateToCompare < cutoffDate
    })
    .sort((a, b) => {
      const nameA = (a.proveedores as any)?.nombre || ""
      const nameB = (b.proveedores as any)?.nombre || ""
      return nameA.localeCompare(nameB)
    })

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/finanzas/tesoreria" className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition mb-2">
            <ArrowLeft size={14} /> Volver a Tesorería Central
          </Link>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-3 italic uppercase">
            <Sparkles className="text-indigo-600 animate-pulse" size={36} />
            Punto de Partida <span className="text-indigo-600">| Configuración</span>
          </h2>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-[10px] mt-1">
            Declaración de saldos iniciales y depuración de deudas históricas para el Kick Off
          </p>
        </div>
      </div>

      {/* Progress Wizard Steps */}
      <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-3xl text-center">
        {[
          { step: 1, title: "1. Corte y Cuentas" },
          { step: 2, title: "2. Cobros Históricos" },
          { step: 3, title: "3. Pagos Históricos" },
          { step: 4, title: "4. Kick Off!" }
        ].map(s => (
          <button
            key={s.step}
            disabled={s.step > 1 && !cutoffDate}
            onClick={() => setCurrentStep(s.step)}
            className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
              currentStep === s.step
                ? 'bg-gradient-to-br from-indigo-900 to-slate-950 text-white shadow-lg scale-102 font-bold'
                : 'text-slate-500 hover:text-slate-700 disabled:opacity-40'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Wizard Panels */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
        
        {loadingSummary || loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-4 text-indigo-600" size={32} />
            <p className="font-bold text-xs uppercase tracking-wider">Cargando consola de punto de partida...</p>
          </div>
        ) : (
          <>
            {/* STEP 1: CUTOFF & ACCOUNTS BALANCES */}
            {currentStep === 1 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Paso 1: Configurar Saldos y Fecha de Corte</h3>
                  <p className="text-xs text-slate-500 font-medium">Establecé la fecha de corte formal. Todo el historial anterior a esta fecha será ignorado en caja y deudas activas. Además, cargá los saldos iniciales actuales de cada cuenta.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Cutoff Date */}
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Fecha de Corte</label>
                      <input 
                        type="date"
                        value={cutoffDate}
                        onChange={(e) => setCutoffDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      />
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-[10px] font-bold text-indigo-900 leading-relaxed">
                      💡 <strong>¿Cómo funciona?</strong> Si seleccionás el <code>01/06/2026</code>, el sistema ignorará todos los ingresos/egresos anteriores a esa fecha en los reportes de caja. La caja comenzará exactamente con la suma de los saldos iniciales cargados a la derecha.
                    </div>
                  </div>

                  {/* Right Column: Account Balances */}
                  <div className="space-y-4">
                    <h4 className="font-black text-xs text-slate-400 uppercase tracking-wider">Saldos Iniciales Disponibles</h4>
                    
                    {/* Mercado Pago */}
                    <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl">
                      <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                        <DollarSign size={20} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Mercado Pago</label>
                        <input 
                          type="number"
                          value={mpStarting}
                          placeholder="0"
                          onChange={(e) => setMpStarting(e.target.value)}
                          className="w-full border-none p-0 text-lg font-black text-slate-800 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>

                    {/* Galicia */}
                    <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Landmark size={20} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Banco Galicia</label>
                        <input 
                          type="number"
                          value={galiciaStarting}
                          placeholder="0"
                          onChange={(e) => setGaliciaStarting(e.target.value)}
                          className="w-full border-none p-0 text-lg font-black text-slate-800 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>

                    {/* Efectivo */}
                    <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <DollarSign size={20} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Caja Efectivo</label>
                        <input 
                          type="number"
                          value={efectivoStarting}
                          placeholder="0"
                          onChange={(e) => setEfectivoStarting(e.target.value)}
                          className="w-full border-none p-0 text-lg font-black text-slate-800 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md"
                  >
                    {savingSettings ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Guardar y Avanzar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CLEAN UP HISTORICAL COLLECTIONS (SALES) */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Paso 2: Depuración de Cobros Históricos</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    A continuación se listan todos los shows impagos o cobrados parcialmente con fecha anterior al kickoff (<code>{cutoffDate}</code>).
                    Marcalos como <strong>"Ya Cobrado"</strong> si ese dinero ya ingresó en el pasado y está contemplado en tu saldo inicial. De lo contrario, dejalos pendientes para cobrarlos a partir de la fecha de corte.
                  </p>
                </div>

                {historicalSales.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                    <p className="font-black text-xs uppercase tracking-wider">¡Limpio! No hay cobros históricos pendientes.</p>
                    <p className="text-[10px] text-slate-400 font-medium">Todos los shows pendientes son posteriores a la fecha de corte.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Banner de depuración en lote */}
                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-xs font-black text-amber-950 uppercase tracking-wider">Depuración de Cobros en Lote</p>
                        <p className="text-[10px] text-amber-900/80 font-medium mt-1">Detectamos {historicalSales.length} cobros históricos. Si ya ingresaron todos y están sumados en los saldos declarados del Paso 1, marcalos todos como cobrados con un solo clic.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkAllSalesCollected}
                        disabled={processingBulkSales}
                        className="bg-amber-950 hover:bg-amber-900 disabled:bg-amber-800 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        {processingBulkSales ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Marcar Todos como Ya Cobrados
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Show / Empresa</th>
                            <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Fecha Show</th>
                            <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Monto Total</th>
                            <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Cobrado</th>
                            <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Depurar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {historicalSales.map((sale) => {
                            const isProcessing = processingId === sale.id
                            return (
                              <tr key={sale.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-4 px-6 font-bold text-slate-800">
                                  <p className="font-black text-slate-700">{sale.events_master?.show_name || 'Show General'}</p>
                                  <p className="text-[10px] font-medium text-slate-400">{sale.company_name}</p>
                                </td>
                                <td className="py-4 px-4 text-center font-bold text-slate-500">
                                  {sale.events_master?.event_date ? new Date(sale.events_master.event_date + 'T12:00:00').toLocaleDateString('es-AR') : '--'}
                                </td>
                                <td className="py-4 px-4 text-right font-black text-slate-700">{formatCurrency(sale.total_amount)}</td>
                                <td className="py-4 px-4 text-right font-bold text-slate-400">{formatCurrency(sale.monto_cobrado || 0)}</td>
                                <td className="py-4 px-6 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleMarkSaleCollected(sale.id)}
                                      disabled={isProcessing}
                                      className="bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5"
                                    >
                                      {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                      Ya Cobrado
                                    </button>
                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/60">
                                      Estado: Pendiente
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <button onClick={() => setCurrentStep(1)} className="text-slate-500 hover:text-slate-700 text-xs font-black uppercase tracking-widest flex items-center gap-1">
                    <ChevronLeft size={16} /> Volver
                  </button>
                  <button onClick={() => setCurrentStep(3)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-1 transition shadow-md">
                    Siguiente Paso <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CLEAN UP HISTORICAL PAYABLES (PURCHASE ORDERS) */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">Paso 3: Depuración de Cuentas a Pagar Históricas</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Listado de órdenes de compra recibidas e impagas con fecha anterior a <code>{cutoffDate}</code>.
                    Presioná <strong>"Ya Pagado"</strong> si estas facturas ya fueron saldadas y su valor está incluido en los saldos declarados del Paso 1. Si todavía las debés, dejalas pendientes.
                  </p>
                </div>

                {/* Herramientas de Carga de Deuda */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200">
                  {/* Formulario Manual */}
                  <form onSubmit={handleAddAdhocDebt} className="md:col-span-2 space-y-3">
                    <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingCart className="text-indigo-600 animate-pulse" size={16} />
                      Cargar Pago Pendiente sin OC (Ad-hoc)
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Proveedor</label>
                        <input 
                          type="text"
                          list="adhoc-proveedores-list"
                          placeholder="Ej. AC Papelera Bustamante"
                          value={newAdhocProv}
                          onChange={(e) => setNewAdhocProv(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        />
                        <datalist id="adhoc-proveedores-list">
                          {proveedores.map(p => (
                            <option key={p.id} value={p.nombre} />
                          ))}
                        </datalist>
                      </div>
                      
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Monto ($)</label>
                        <input 
                          type="text"
                          placeholder="Ej. 96000 o 96000+120000+189800"
                          value={newAdhocMonto}
                          onChange={(e) => setNewAdhocMonto(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Vencimiento (Opcional)</label>
                        <input 
                          type="date"
                          value={newAdhocFecha}
                          onChange={(e) => setNewAdhocFecha(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={addingAdhoc}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm"
                    >
                      {addingAdhoc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Agregar Deuda Manual
                    </button>
                  </form>

                  {/* Precarga Masiva */}
                  <div className="flex flex-col justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/60">
                    <div>
                      <h4 className="font-black text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="text-indigo-600" size={16} />
                        Importación Rápida
                      </h4>
                      <p className="text-[10px] font-medium text-indigo-950/70 leading-relaxed">
                        Cargá automáticamente todas las deudas del listado de Excel (AC Papelera, Galope, Icedream, Criollo, Horeca, Sintaxis, Sparkling) sin duplicar las ya existentes.
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleSeedDebts}
                      disabled={seedingDebts}
                      className="w-full bg-indigo-950 hover:bg-indigo-900 disabled:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 mt-4 shadow-sm"
                    >
                      {seedingDebts ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                      Precargar Listado Excel
                    </button>
                  </div>
                </div>

                {historicalPOs.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                    <p className="font-black text-xs uppercase tracking-wider">¡Limpio! No hay pagos históricos pendientes.</p>
                    <p className="text-[10px] text-slate-400 font-medium">Todas las órdenes de compra pendientes son de periodos activos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Banner de depuración en lote para deudas */}
                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-xs font-black text-amber-950 uppercase tracking-wider">Depuración de Deudas en Lote</p>
                        <p className="text-[10px] text-amber-900/80 font-medium mt-1">Detectamos {historicalPOs.length} deudas históricas. Si ya abonaste todas estas facturas en el pasado y están descontadas de los saldos iniciales del Paso 1, marcalas todas como pagadas.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkAllPOsPaid}
                        disabled={processingBulkPOs}
                        className="bg-amber-950 hover:bg-amber-900 disabled:bg-amber-800 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        {processingBulkPOs ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Marcar Todas como Ya Pagadas
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-[2rem]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider">Proveedor / ID</th>
                            <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-center">Vencimiento</th>
                            <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Costo Total</th>
                            <th className="py-4 px-4 font-black uppercase text-slate-400 tracking-wider text-right">Pagado</th>
                            <th className="py-4 px-6 font-black uppercase text-slate-400 tracking-wider text-center">Depurar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {historicalPOs.map((po) => {
                            const isProcessing = processingId === po.id
                            return (
                              <tr key={po.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-4 px-6 font-bold text-slate-800">
                                  <p className="font-black text-slate-700">{po.proveedores?.nombre}</p>
                                  <p className="text-[10px] font-medium text-slate-400">ID: {po.id.split('-')[0]}</p>
                                </td>
                                <td className="py-4 px-4 text-center font-bold text-slate-500">
                                  {po.fecha_vencimiento_pago ? new Date(po.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR') : '--'}
                                </td>
                                <td className="py-4 px-4 text-right font-black text-slate-700">{formatCurrency(po.costo_total)}</td>
                                <td className="py-4 px-4 text-right font-bold text-slate-400">{formatCurrency(po.monto_pagado || 0)}</td>
                                <td className="py-4 px-6 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleMarkPOPaid(po.id)}
                                      disabled={isProcessing}
                                      className="bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5"
                                    >
                                      {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                      Ya Pagado
                                    </button>
                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/60">
                                      Estado: Pendiente
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <button onClick={() => setCurrentStep(2)} className="text-slate-500 hover:text-slate-700 text-xs font-black uppercase tracking-widest flex items-center gap-1">
                    <ChevronLeft size={16} /> Volver
                  </button>
                  <button onClick={() => setCurrentStep(4)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-1 transition shadow-md">
                    Siguiente Paso <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: KICK OFF! SUCCESS STATE */}
            {currentStep === 4 && (
              <div className="py-8 text-center space-y-6 max-w-xl mx-auto">
                <div className="w-20 h-20 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm animate-bounce">
                  <Sparkles size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 uppercase italic">¡Tesorería Lista para el Kick Off!</h3>
                  <p className="text-slate-500 font-medium text-xs leading-relaxed">
                    Completaste la depuración de cuentas. El sistema ahora está operando a partir de la fecha de corte programada (<code>{cutoffDate}</code>) con tus saldos de cuentas iniciales y las obligaciones financieras activas.
                  </p>
                </div>

                {/* Dashboard preview */}
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 text-left space-y-4">
                  <h4 className="font-black text-xs text-slate-400 uppercase tracking-wider text-center">Estado del Kick Off</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Mercado Pago</p>
                      <p className="text-sm font-black text-slate-700 mt-1">{formatCurrency(summary?.mpSaldo || 0)}</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Galicia</p>
                      <p className="text-sm font-black text-slate-700 mt-1">{formatCurrency(summary?.galiciaSaldo || 0)}</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Efectivo</p>
                      <p className="text-sm font-black text-slate-700 mt-1">{formatCurrency(summary?.efectivoSaldo || 0)}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs font-black border-t border-slate-200 pt-4">
                    <span className="text-slate-400 uppercase tracking-wider">Saldo Total de Inicio</span>
                    <span className="text-indigo-600 text-lg">{formatCurrency(summary?.fondosDisponibles || 0)}</span>
                  </div>
                </div>

                <div className="pt-6 flex justify-center gap-4">
                  <button
                    onClick={() => router.push('/finanzas/tesoreria')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition shadow-md"
                  >
                    Volver a Tesorería Central <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

          </>
        )}

      </div>

    </div>
  )
}
