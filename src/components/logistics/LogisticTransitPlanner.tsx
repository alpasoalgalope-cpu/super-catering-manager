"use client"

import React, { useState, useEffect, useTransition } from "react"
import { EventTransitPlan, TransitModality, TransitStop, TransitTravelMode } from "@/types/logistics"
import { 
  getEventTransitPlanAction, 
  calculateTransitPlanAction, 
  saveEventTransitPlanAction,
  syncTransitPlanToRemitosAction 
} from "@/app/actions/logistics"
import { 
  formatWhatsAppItinerary, 
  formatCoordinatorWhatsAppMessage, 
  calculateKitchenLoadingTime, 
  addMinutesToTimeString,
  ORIGIN_KITCHEN_ADDRESS 
} from "@/lib/transit-engine"
import {
  Truck, Clock, MapPin, Users, Copy, Check, Save, ArrowUpDown, 
  ChevronUp, ChevronDown, Navigation, ExternalLink, RefreshCw, 
  ShieldCheck, Loader2, Sparkles, MessageSquare, Send, Car, AlertCircle
} from "lucide-react"

interface Props {
  eventId: string
  onPlanSaved?: () => void
}

export default function LogisticTransitPlanner({ eventId, onPlanSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [copiedGeneral, setCopiedGeneral] = useState(false)
  const [copiedStopId, setCopiedStopId] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // State
  const [eventData, setEventData] = useState<any>(null)
  const [kitchenCallTime, setKitchenCallTime] = useState<string>("19:00")
  const [modality, setModality] = useState<TransitModality>("DESPACHO_PARALELO")
  const [dischargeMargin, setDischargeMargin] = useState<number>(12)
  const [travelMode, setTravelMode] = useState<TransitTravelMode>("DRIVE")
  const [stops, setStops] = useState<TransitStop[]>([])
  const [itineraryNotes, setItineraryNotes] = useState<string>("")
  const [isSavedInDb, setIsSavedInDb] = useState(false)

  // Derived Totals
  const totalViandas = stops.reduce((acc, s) => acc + (Number(s.viandas_count) || 0), 0)
  const totalWater = stops.reduce((acc, s) => acc + (Number(s.water_count) || 0), 0)
  const loadingTimeMinutes = calculateKitchenLoadingTime(totalViandas)
  const kitchenDepartureTime = addMinutesToTimeString(kitchenCallTime, loadingTimeMinutes)

  // 1. Initial Load
  const loadPlan = async () => {
    setLoading(true)
    try {
      const res = await getEventTransitPlanAction(eventId)
      if (res.success && res.data) {
        setEventData(res.data.event)
        const p = res.data.plan
        setKitchenCallTime(p.kitchen_call_time || "19:00")
        setModality(p.modality || "DESPACHO_PARALELO")
        setDischargeMargin(p.discharge_time_minutes || 12)
        setTravelMode(p.travel_mode || "DRIVE")
        setStops(p.stops_data || [])
        setItineraryNotes(p.itinerary_notes || "")
        setIsSavedInDb(res.data.isSaved)
      } else {
        showFeedback(res.error || "No se pudo cargar el plan logístico", "error")
      }
    } catch (e: any) {
      showFeedback("Error al cargar datos: " + e.message, "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      loadPlan()
    }
  }, [eventId])

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // 2. Recalculate routes on change
  const handleRecalculate = (
    currentStops = stops, 
    callTime = kitchenCallTime, 
    mod = modality, 
    margin = dischargeMargin,
    mode = travelMode
  ) => {
    if (!currentStops || currentStops.length === 0) return

    startTransition(async () => {
      try {
        const res = await calculateTransitPlanAction({
          stops: currentStops,
          kitchenCallTime: callTime,
          modality: mod,
          dischargeMarginMinutes: margin,
          travelMode: mode,
          eventDateIso: eventData?.event_date || new Date().toISOString().split("T")[0]
        })

        if (res.success && res.data) {
          setStops(res.data.calculatedStops)
        } else {
          showFeedback(res.error || "Error al recalcular rutas.", "error")
        }
      } catch (err: any) {
        showFeedback("Error: " + err.message, "error")
      }
    })
  }

  // Handle Modality Switch
  const handleModalityChange = (newModality: TransitModality) => {
    setModality(newModality)
    handleRecalculate(stops, kitchenCallTime, newModality, dischargeMargin, travelMode)
  }

  // Handle Call Time Change
  const handleCallTimeChange = (newTime: string) => {
    setKitchenCallTime(newTime)
    handleRecalculate(stops, newTime, modality, dischargeMargin, travelMode)
  }

  // Handle Discharge Margin Change
  const handleDischargeMarginChange = (margin: number) => {
    setDischargeMargin(margin)
    handleRecalculate(stops, kitchenCallTime, modality, margin, travelMode)
  }

  // Handle Stop Reordering (for Sergio sequential mode)
  const moveStop = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === stops.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const newStops = [...stops]
    const temp = newStops[index]
    newStops[index] = newStops[targetIndex]
    newStops[targetIndex] = temp

    // Update stop_order
    const reordered = newStops.map((s, idx) => ({ ...s, stop_order: idx + 1 }))
    setStops(reordered)
    handleRecalculate(reordered, kitchenCallTime, modality, dischargeMargin, travelMode)
  }

  // 3. Save Plan to Supabase
  const handleSavePlan = async () => {
    setIsSaving(true)
    try {
      const planToSave: EventTransitPlan = {
        event_master_id: eventId,
        kitchen_address: ORIGIN_KITCHEN_ADDRESS,
        kitchen_call_time: kitchenCallTime,
        loading_time_minutes: loadingTimeMinutes,
        kitchen_departure_time: kitchenDepartureTime,
        modality,
        discharge_time_minutes: dischargeMargin,
        travel_mode: travelMode,
        stops_data: stops,
        itinerary_notes: itineraryNotes
      }

      const res = await saveEventTransitPlanAction(planToSave)
      if (res.success) {
        setIsSavedInDb(true)
        showFeedback("¡Plan de tránsito guardado correctamente!", "success")
        if (onPlanSaved) onPlanSaved()
      } else {
        showFeedback(res.error || "No se pudo guardar el plan.", "error")
      }
    } catch (e: any) {
      showFeedback("Error al guardar: " + e.message, "error")
    } finally {
      setIsSaving(false)
    }
  }

  // 4. Sync Plan to Remitos
  const handleSyncRemitos = async () => {
    if (!confirm("¿Deseas actualizar el horario de entrega en los remitos de ventas con los rangos calculados?")) return
    setIsSyncing(true)
    try {
      const res = await syncTransitPlanToRemitosAction(eventId, stops)
      if (res.success) {
        showFeedback(`¡Sincronizado! Se actualizaron ${res.updatedCount} remitos de venta.`, "success")
      } else {
        showFeedback(res.error || "Error al sincronizar con remitos.", "error")
      }
    } catch (e: any) {
      showFeedback("Error: " + e.message, "error")
    } finally {
      setIsSyncing(false)
    }
  }

  // 5. Copy Itinerary for WhatsApp
  const handleCopyItinerary = () => {
    if (!eventData) return

    const planToExport: EventTransitPlan = {
      event_master_id: eventId,
      kitchen_address: ORIGIN_KITCHEN_ADDRESS,
      kitchen_call_time: kitchenCallTime,
      loading_time_minutes: loadingTimeMinutes,
      kitchen_departure_time: kitchenDepartureTime,
      modality,
      discharge_time_minutes: dischargeMargin,
      travel_mode: travelMode,
      stops_data: stops,
      itinerary_notes: itineraryNotes
    }

    const eventDateFormatted = eventData.event_date
      ? new Date(eventData.event_date + 'T12:00:00').toLocaleDateString('es-AR')
      : "Fecha S/D"

    const text = formatWhatsAppItinerary({
      showName: eventData.show_name || "Evento",
      eventDateStr: eventDateFormatted,
      venueName: (eventData.venues as any)?.name || "S/D",
      plan: planToExport
    })

    navigator.clipboard.writeText(text)
    setCopiedGeneral(true)
    showFeedback("¡Itinerario copiado al portapapeles para WhatsApp!", "success")
    setTimeout(() => setCopiedGeneral(false), 3000)
  }

  // 6. Copy Single Coordinator Message
  const handleCopyCoordinatorMsg = (stop: TransitStop) => {
    const text = formatCoordinatorWhatsAppMessage({
      showName: eventData?.show_name || "Evento",
      stop
    })

    navigator.clipboard.writeText(text)
    setCopiedStopId(stop.id)
    showFeedback(`Mensaje para ${stop.company_name} copiado.`, "success")
    setTimeout(() => setCopiedStopId(null), 2500)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-indigo-600 mb-3" size={32} />
        <p className="text-slate-600 font-bold text-sm">Cargando Planificación Logística y Google Maps...</p>
      </div>
    )
  }

  const isSequential = modality === "DEDICADA_SECUENCIAL_SERGIO"

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles size={11} /> Google Maps Routes API
              </span>
              {isSavedInDb && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Guardado
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Truck className="text-indigo-400" size={24} />
              Planificación y Estimación de Tránsito Logístico
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Origen: <span className="text-slate-300 font-semibold">{ORIGIN_KITCHEN_ADDRESS}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleCopyItinerary}
              className="flex-1 md:flex-initial bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/20"
            >
              {copiedGeneral ? <Check size={16} /> : <Copy size={16} />}
              {copiedGeneral ? "¡Copiado!" : "Copiar Itinerario WhatsApp"}
            </button>

            <button
              onClick={handleSavePlan}
              disabled={isSaving}
              className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar
            </button>

            <button
              onClick={handleSyncRemitos}
              disabled={isSyncing}
              title="Sincronizar horarios calculados con los remitos impresos"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium p-2.5 rounded-2xl transition border border-slate-700"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {feedbackMsg && (
          <div className={`mt-4 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
          }`}>
            <AlertCircle size={14} />
            {feedbackMsg.text}
          </div>
        )}
      </div>

      <div className="p-6 sm:p-8 space-y-8">

        {/* TIMELINE METRICS BANNER */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Viandas Totales</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-1.5">
              <span>{totalViandas}</span>
              <span className="text-xs font-normal text-slate-500">viandas</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">+{totalWater} aguas</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tiempo de Carga</span>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 flex items-center gap-1.5">
              <span>{loadingTimeMinutes}</span>
              <span className="text-xs font-normal text-slate-500">min</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">5 min / 100 viandas</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Citación en Cocina</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {kitchenCallTime} <span className="text-xs font-normal text-slate-500">hs</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Carga en Munro</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Salida de Munro</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">
              {kitchenDepartureTime} <span className="text-xs font-normal text-slate-500">hs</span>
            </div>
            <p className="text-[11px] text-emerald-700/80 font-medium">Citación + Carga</p>
          </div>
        </div>

        {/* CONTROLS: CITATION TIME & MODALITY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          
          {/* 1. CITATION INPUT */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
              <Clock size={14} className="text-indigo-500" />
              Hora de Citación / Carga (Cocina)
            </label>
            <input
              type="time"
              value={kitchenCallTime}
              onChange={(e) => handleCallTimeChange(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
            <p className="text-[11px] text-slate-400">
              Salida estimada calculada: <strong className="text-indigo-600">{kitchenDepartureTime} hs</strong>
            </p>
          </div>

          {/* 2. MODALITY SELECTOR */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
              <Car size={14} className="text-indigo-500" />
              Modalidad de Transporte Logístico
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleModalityChange("DESPACHO_PARALELO")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  modality === "DESPACHO_PARALELO"
                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${modality === "DESPACHO_PARALELO" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <Car size={18} />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-wide text-slate-900">
                    Despacho en Paralelo
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Múltiples móviles / Ubers en simultáneo tras la carga en Munro.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModalityChange("DEDICADA_SECUENCIAL_SERGIO")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  modality === "DEDICADA_SECUENCIAL_SERGIO"
                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${modality === "DEDICADA_SECUENCIAL_SERGIO" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <Truck size={18} />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-wide text-slate-900">
                    Sergio - Recorrido Secuencial
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Un solo furgón propio con paradas encadenadas y margen de espera.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* SEQUENTIAL CONFIG: DISCHARGE TIME */}
        {isSequential && (
          <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-amber-900">Margen de descarga / espera por parada</p>
                <p className="text-[11px] text-amber-700">Tiempo estimado en cada punto antes de continuar hacia la siguiente empresa.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {[10, 12, 15, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleDischargeMarginChange(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dischargeMargin === m
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/50"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STOPS LIST / TIMELINE */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-600" />
              {isSequential ? "Orden de Paradas y Estimaciones de Entrega" : "Móviles y Horarios de Llegada por Empresa"}
            </h3>

            {isPending && (
              <span className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 animate-pulse">
                <Loader2 size={13} className="animate-spin" /> Recalculando con Google Maps...
              </span>
            )}
          </div>

          <div className="space-y-3">
            {stops.map((stop, index) => {
              const stopNumber = index + 1
              const isFirst = index === 0
              const isLast = index === stops.length - 1

              return (
                <div
                  key={stop.id || index}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 transition shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* LEFT: ORDER + COMPANY + CARGO */}
                  <div className="flex items-start gap-3.5 min-w-[260px]">
                    {/* ORDER CONTROLS (IF SEQUENTIAL) */}
                    {isSequential ? (
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveStop(index, 'up')}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                          title="Subir parada"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          {stopNumber}
                        </div>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => moveStop(index, 'down')}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                          title="Bajar parada"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                        {stopNumber}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-slate-900 uppercase">
                          {stop.company_name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                          {stop.viandas_count} viandas
                        </span>
                        {stop.water_count > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700">
                            {stop.water_count} aguas
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-medium space-y-0.5">
                        <p className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-700">{stop.delivery_point || stop.destination_name}</span>
                          {stop.destination_address && (
                            <span className="text-slate-400 truncate max-w-xs">({stop.destination_address})</span>
                          )}
                        </p>
                        {stop.coordinator_name && (
                          <p className="flex items-center gap-1.5">
                            <Users size={12} className="text-slate-400 shrink-0" />
                            <span>{stop.coordinator_name}</span>
                            {stop.coordinator_phone && (
                              <span className="text-slate-400">({stop.coordinator_phone})</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CENTER: GOOGLE MAPS TRANSIT + EXACT ETA */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Tránsito</span>
                      <span className="font-bold text-slate-700">
                        {stop.duration_minutes || 30} min
                      </span>
                      {stop.distance_meters ? (
                        <span className="text-slate-400 text-[10px] ml-1">
                          ({(stop.distance_meters / 1000).toFixed(1)} km)
                        </span>
                      ) : null}
                    </div>

                    <div className="h-6 w-px bg-slate-200" />

                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">ETA Técnico</span>
                      <span className="font-bold text-slate-900">
                        {stop.exact_eta || "20:00"} hs
                      </span>
                    </div>

                    {isSequential && stop.departure_from_stop && !isLast && (
                      <>
                        <div className="h-6 w-px bg-slate-200" />
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Salida P{stopNumber}</span>
                          <span className="font-bold text-slate-600">
                            {stop.departure_from_stop} hs
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* RIGHT: COORDINATOR 30-MIN RANGE BADGE & ACTIONS */}
                  <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                    
                    {/* COORDINATOR 30-MIN WINDOW PILL */}
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider block">
                        Rango Coordinador (30 min)
                      </span>
                      <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 font-black text-sm">
                        {stop.coordinator_range_formatted || "20:00 a 20:30 hs"}
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-1.5">
                      {stop.google_maps_url && (
                        <a
                          href={stop.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir ruta en Google Maps para chofer"
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          <Navigation size={15} />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyCoordinatorMsg(stop)}
                        title="Copiar mensaje individual para el coordinador"
                        className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                      >
                        {copiedStopId === stop.id ? <Check size={15} /> : <MessageSquare size={15} />}
                      </button>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

    </div>
  )
}
