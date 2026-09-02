"use client"

import React, { useState, useEffect } from "react"
import { DispatchLoadSheet, BusDeliveryItem } from "@/types/logistics"
import { confirmDeliveryAction, generateBusTokensForEventAction, getDispatchSummaryAction } from "@/app/actions/logistics"
import { getNavigationLinks } from "@/lib/routing-engine"
import {
  Truck, Package, Navigation, Phone, MessageSquare, CheckCircle2,
  AlertTriangle, Clock, MapPin, Search, ChevronRight, Check,
  ExternalLink, KeyRound, Loader2, Sparkles, RefreshCw, Layers, Copy
} from "lucide-react"

interface Props {
  initialData: DispatchLoadSheet
}

export default function DeliveryDashboard({ initialData }: Props) {
  const [data, setData] = useState<DispatchLoadSheet>(initialData)
  const [activeTab, setActiveTab] = useState<'hoja_carga' | 'ruta'>('hoja_carga')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [deliveringStop, setDeliveringStop] = useState<BusDeliveryItem | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState<string | null>(null)

  // Live Auto-Refresh every 8 seconds to receive new GPS coordinates from coordinators in real-time
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getDispatchSummaryAction(data.event.id)
        if (res.success && res.data) {
          setData(res.data)
        }
      } catch (e) {
        console.error("Auto-polling error:", e)
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [data.event.id])

  const toggleCheckItem = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleOpenDelivery = (stop: BusDeliveryItem) => {
    setDeliveringStop(stop)
    setPinInput("")
    setPinError(null)
  }

  const handleCopyCoordiLink = (token: string) => {
    const url = `${window.location.origin}/coordi/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  const handleConfirmDelivery = async () => {
    if (!deliveringStop) return

    setLoadingAction(deliveringStop.logistic.id)
    setPinError(null)

    const res = await confirmDeliveryAction(deliveringStop.logistic.id, pinInput)

    if (res.success) {
      setData(prev => ({
        ...prev,
        stops: prev.stops.map(s => 
          s.logistic.id === deliveringStop.logistic.id 
            ? { ...s, logistic: { ...s.logistic, status: 'entregado', delivered_at: new Date().toISOString() } }
            : s
        ),
        metrics: {
          ...prev.metrics,
          buses_estacionados: Math.max(0, prev.metrics.buses_estacionados - 1),
          buses_entregados: prev.metrics.buses_entregados + 1
        }
      }))
      setDeliveringStop(null)
    } else {
      setPinError(res.error || "PIN incorrecto o error al registrar la entrega.")
    }

    setLoadingAction(null)
  }

  const handleSyncTokens = async () => {
    setLoadingAction("sync")
    const res = await getDispatchSummaryAction(data.event.id)
    if (res.success && res.data) {
      setData(res.data)
    }
    setLoadingAction(null)
  }

  const stops = data.stops || []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 lg:p-8 pb-28 w-full max-w-6xl mx-auto space-y-6">
      
      {/* Header Flete / Despacho Adaptable */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-black uppercase tracking-wider">
            <Truck size={14} />
            <span>Reparto y Despacho de Camioneta</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" title="GPS en vivo" />
          </div>

          <button
            onClick={handleSyncTokens}
            disabled={loadingAction === "sync"}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-slate-300 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Actualizar datos ahora"
          >
            <RefreshCw size={14} className={loadingAction === "sync" ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black italic uppercase tracking-tighter text-white">
              {data.event.show_name}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 font-bold mt-1 flex items-center gap-1.5">
              <MapPin size={13} className="text-indigo-400" />
              {data.event.venue_name} • {data.event.event_date}
            </p>
          </div>

          {/* Quick totals in header for PC/Tablet */}
          <div className="hidden sm:flex items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-white/5">
            <div className="text-right pr-3 border-r border-white/10">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Carga Total</p>
              <p className="text-base font-black text-white">{data.totals.grand_total_viandas} Viandas</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-blue-400 uppercase">Bebidas</p>
              <p className="text-base font-black text-blue-400">{data.totals.grand_total_water} Aguas</p>
            </div>
          </div>
        </div>

        {/* Status Metrics Bar - Grid Adaptable */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 border-t border-white/10 text-center">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Micros Totales</p>
            <p className="text-xl sm:text-3xl font-black text-white mt-0.5">{data.metrics.total_buses}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-amber-500/20">
            <p className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider">Estacionados</p>
            <p className="text-xl sm:text-3xl font-black text-amber-300 mt-0.5">{data.metrics.buses_estacionados}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
            <p className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider">Entregados</p>
            <p className="text-xl sm:text-3xl font-black text-emerald-400 mt-0.5">{data.metrics.buses_entregados}</p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
        <button
          onClick={() => setActiveTab('hoja_carga')}
          className={`flex-1 py-3.5 px-3 rounded-xl font-black uppercase text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'hoja_carga'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package size={16} />
          <span>Hoja de Carga ({data.totals.grand_total_viandas} Viandas)</span>
        </button>

        <button
          onClick={() => setActiveTab('ruta')}
          className={`flex-1 py-3.5 px-3 rounded-xl font-black uppercase text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'ruta'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation size={16} />
          <span>Ruta Secuenciada ({stops.length} Paradas)</span>
        </button>
      </div>

      {/* TAB 1: HOJA DE CARGA (CHECKLIST EN GRILLA RESPONSIVA) */}
      {activeTab === 'hoja_carga' && (
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <Package size={22} className="text-indigo-400" />
                Planilla de Carga de la Camioneta
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Verificá y tildá las cantidades totales de viandas y aguas antes de salir del centro de producción.
              </p>
            </div>
            
            <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
              Checklist Pre-Despacho
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[
              { key: 'trad', label: 'Sandwiches Tradicionales (Jamón y Queso)', count: data.totals.tradicional, color: 'text-white' },
              { key: 'veg', label: 'Sandwiches Vegetarianos', count: data.totals.vegetariano, color: 'text-emerald-400' },
              { key: 'stacc', label: 'Viandas Selladas Sin TACC (Celiacos)', count: data.totals.sintacc, color: 'text-amber-400' },
              { key: 'vegan', label: 'Sandwiches Veganos', count: data.totals.vegano, color: 'text-teal-400' },
              { key: 'lib', label: 'Viandas Bonificadas Tripulación (Chofer/Coordi)', count: data.totals.liberated_viandas, color: 'text-indigo-300' },
              { key: 'water', label: 'Botellas de Agua Mineral', count: data.totals.grand_total_water, color: 'text-blue-400' },
            ].map(item => {
              const isChecked = checkedItems[item.key] || false
              return (
                <label
                  key={item.key}
                  onClick={() => toggleCheckItem(item.key)}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border cursor-pointer select-none transition-all duration-200 ${
                    isChecked
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-md shadow-emerald-950/20'
                      : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl border flex items-center justify-center transition ${
                      isChecked ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-md' : 'border-slate-600 bg-slate-900'
                    }`}>
                      {isChecked && <Check size={16} strokeWidth={4} />}
                    </div>
                    <span className={`text-xs sm:text-sm font-bold ${isChecked ? 'line-through opacity-70' : ''}`}>
                      {item.label}
                    </span>
                  </div>

                  <span className={`text-lg sm:text-2xl font-black shrink-0 ${item.color}`}>
                    {item.count} un.
                  </span>
                </label>
              )
            })}
          </div>

          {/* Grand Totals Summary Card */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="text-center sm:text-left">
              <p className="font-bold text-indigo-300 uppercase text-[10px] tracking-wider">Total General a Despachar</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">{data.totals.grand_total_viandas} Viandas</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="font-bold text-blue-300 uppercase text-[10px] tracking-wider">Bebidas y Aguas</p>
              <p className="text-2xl sm:text-3xl font-black text-blue-400 mt-0.5">{data.totals.grand_total_water} Botellas</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RUTA SECUENCIADA */}
      {activeTab === 'ruta' && (
        <div className="space-y-4">
          {stops.length === 0 ? (
            <div className="bg-slate-900 p-12 rounded-[2.5rem] border border-slate-800 text-center space-y-4">
              <Truck size={48} className="mx-auto text-slate-600" />
              <div>
                <h3 className="text-base font-black uppercase text-white">No hay micros registrados para este evento</h3>
                <p className="text-xs text-slate-400 mt-1">Generá los accesos de micros para activar el ruteo automático.</p>
              </div>
              <button
                onClick={handleSyncTokens}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-lg transition"
              >
                Generar Micros Automáticamente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {stops.map((stop, idx) => {
                const b = stop.logistic
                const isDelivered = b.status === 'entregado'
                const isParked = b.status === 'estacionado'
                const nav = b.location_lat && b.location_lng
                  ? getNavigationLinks(Number(b.location_lat), Number(b.location_lng), b.bus_identifier)
                  : null

                const phoneClean = (b.coordinator_phone || '').replace(/\D/g, '')
                const whatsappUrl = phoneClean
                  ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hola ${b.coordinator_name || 'Coordinador'}, soy el chofer del catering de ${data.event.show_name}. Te comparto el link de check-in para que nos marques tu posición al llegar: ${typeof window !== 'undefined' ? window.location.origin : ''}/coordi/${b.token_access}`)}`
                  : null

                return (
                  <div
                    key={b.id}
                    className={`border rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-6 shadow-xl transition-all space-y-4 flex flex-col justify-between ${
                      isDelivered
                        ? 'bg-slate-950/60 border-slate-800/80 opacity-75'
                        : isParked
                        ? 'bg-slate-900 border-amber-500/40 shadow-amber-950/10'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    {/* Top Section */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                            isDelivered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                            isParked ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                              {b.bus_identifier}
                            </h3>
                            <p className="text-xs font-bold text-slate-400">
                              {b.company_name || "Empresa"} {b.coordinator_name && `• Coordi: ${b.coordinator_name}`}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          isDelivered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          isParked ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {isDelivered ? 'Entregado' : isParked ? 'Estacionado' : 'En Viaje'}
                        </span>
                      </div>

                      {/* Coordinator Checkin Quick Access Box */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <MapPin size={13} className="text-amber-400" />
                          <span className="font-bold text-[11px]">Check-in del Coordi:</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/coordi/${b.token_access}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition"
                            title="Abrir formulario de Check-in del Coordinador"
                          >
                            <span>Abrir</span>
                            <ExternalLink size={10} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyCoordiLink(b.token_access)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                            title="Copiar link para WhatsApp"
                          >
                            {copiedToken === b.token_access ? (
                              <>
                                <Check size={10} className="text-emerald-400" />
                                <span className="text-emerald-400">¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={10} />
                                <span>Copiar Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Reference & GPS Location */}
                      {b.location_reference && (
                        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium">
                          <strong className="text-indigo-400 uppercase text-[10px] block mb-0.5">Referencia de ubicación:</strong>
                          {b.location_reference}
                        </div>
                      )}

                      {/* Viandas to Deliver Breakdown */}
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
                        <div className="flex flex-wrap gap-2 text-slate-300">
                          <span className="font-bold">🥪 Trad: <strong className="text-white">{stop.breakdown.tradicional}</strong></span>
                          <span className="font-bold">🥗 Veg: <strong className="text-emerald-400">{stop.breakdown.vegetariano}</strong></span>
                          <span className="font-bold">🌾 STACC: <strong className="text-amber-400">{stop.breakdown.sintacc}</strong></span>
                          {stop.breakdown.vegano > 0 && <span className="font-bold">🌱 Veg: <strong className="text-teal-400">{stop.breakdown.vegano}</strong></span>}
                          <span className="font-bold">💧 Agua: <strong className="text-blue-400">{stop.breakdown.water}</strong></span>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-white/5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">A Entregar:</span>
                          <span className="font-black text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-lg border border-emerald-400/20">
                            {stop.breakdown.total_delivery_viandas} viandas + {stop.breakdown.water} aguas
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Section */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      {/* Quick Action Navigation & Contact Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {nav ? (
                          <a
                            href={nav.waze}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition shadow-lg shadow-cyan-950/40"
                          >
                            <Navigation size={13} /> Waze
                          </a>
                        ) : (
                          <span className="p-2.5 bg-slate-950 text-slate-600 border border-slate-800 rounded-xl text-xs font-bold text-center">
                            Sin GPS
                          </span>
                        )}

                        {nav ? (
                          <a
                            href={nav.googleMaps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition shadow-lg shadow-blue-950/40"
                          >
                            <MapPin size={13} /> Maps
                          </a>
                        ) : (
                          <span className="p-2.5 bg-slate-950 text-slate-600 border border-slate-800 rounded-xl text-xs font-bold text-center">
                            Sin GPS
                          </span>
                        )}

                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition"
                          >
                            <MessageSquare size={13} /> WhatsApp
                          </a>
                        ) : (
                          <span className="p-2.5 bg-slate-950 text-slate-600 border border-slate-800 rounded-xl text-xs font-bold text-center">
                            Sin Tel
                          </span>
                        )}

                        {b.coordinator_phone ? (
                          <a
                            href={`tel:${b.coordinator_phone}`}
                            className="p-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition"
                          >
                            <Phone size={13} /> Llamar
                          </a>
                        ) : (
                          <span className="p-2.5 bg-slate-950 text-slate-600 border border-slate-800 rounded-xl text-xs font-bold text-center">
                            Sin Tel
                          </span>
                        )}
                      </div>

                      {/* Delivery Confirmation Trigger */}
                      {!isDelivered ? (
                        <button
                          onClick={() => handleOpenDelivery(stop)}
                          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 size={16} /> Confirmar Entrega en este Micro
                        </button>
                      ) : (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                          <Check size={14} strokeWidth={3} /> Entrega finalizada ({new Date(b.delivered_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {deliveringStop && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Entrega en Destino</p>
                <h3 className="text-xl font-black text-white uppercase">{deliveringStop.logistic.bus_identifier}</h3>
              </div>
              <button
                onClick={() => setDeliveringStop(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p><strong>Bajar:</strong> {deliveringStop.breakdown.total_delivery_viandas} viandas + {deliveringStop.breakdown.water} aguas</p>
              {deliveringStop.logistic.coordinator_name && (
                <p><strong>Coordinador:</strong> {deliveringStop.logistic.coordinator_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <KeyRound size={12} /> PIN de 4 dígitos del Coordinador (Opcional)
              </label>
              <input
                type="text"
                maxLength={4}
                placeholder="Ej: 4821"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-xl font-mono font-black text-amber-400 tracking-widest outline-none focus:border-emerald-500"
              />
            </div>

            {pinError && (
              <p className="text-xs font-bold text-rose-400 text-center">{pinError}</p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeliveringStop(null)}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={loadingAction !== null}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                {loadingAction ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
