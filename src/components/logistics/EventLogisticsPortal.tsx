"use client"

import React, { useState, useMemo } from 'react'
import { 
  Bus, MapPin, Phone, MessageCircle, Navigation, CheckCircle2, 
  Clock, AlertTriangle, Users, Package, RefreshCw, Copy, Check, 
  ExternalLink, Share2, Search, ArrowLeft, Send, Truck, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react'
import Link from 'next/link'
import { updateBusStatusAction } from '@/app/actions/logistics'

interface Props {
  event: any
  summaryData: any
  initialBuses: any[]
}

export default function EventLogisticsPortal({ event, summaryData, initialBuses }: Props) {
  const [buses, setBuses] = useState<any[]>(initialBuses || [])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedBusId, setExpandedBusId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  // Handle Marking a Bus as Delivered
  const handleToggleDelivered = async (busId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'entregado' ? 'estacionado' : 'entregado'
    setUpdatingId(busId)
    try {
      const res = await updateBusStatusAction(busId, newStatus as any)
      if (res.success) {
        setBuses(prev => prev.map(b => b.id === busId ? { ...b, status: newStatus } : b))
      } else {
        alert(res.error || 'No se pudo actualizar el estado.')
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setUpdatingId(null)
    }
  }

  // Calculate Aggregates
  const totals = useMemo(() => {
    let trad = 0
    let veg = 0
    let sintacc = 0
    let vegan = 0
    let water = 0
    let totalViandas = 0
    let parkedCount = 0
    let deliveredCount = 0
    let onWayCount = 0

    buses.forEach(b => {
      const bk = b.breakdown || {}
      trad += Number(bk.tradicional) || 0
      veg += Number(bk.vegetariano) || 0
      sintacc += Number(bk.sintacc) || 0
      vegan += Number(bk.vegano) || 0
      water += Number(bk.water) || 0
      totalViandas += (Number(bk.total_delivery_viandas) || Number(bk.tradicional || 0) + Number(bk.vegetariano || 0) + Number(bk.sintacc || 0) + Number(bk.vegano || 0))

      if (b.status === 'entregado') deliveredCount++
      else if (b.status === 'estacionado') parkedCount++
      else onWayCount++
    })

    return {
      trad,
      veg,
      sintacc,
      vegan,
      water,
      totalViandas,
      totalBuses: buses.length,
      parkedCount,
      deliveredCount,
      onWayCount
    }
  }, [buses])

  // Filter buses
  const filteredBuses = useMemo(() => {
    return buses.filter(b => {
      const matchesStatus = filterStatus === 'all' || b.status === filterStatus
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term || 
        (b.company_name || '').toLowerCase().includes(term) ||
        (b.coordinator_name || '').toLowerCase().includes(term) ||
        (b.coordinator_phone || '').toLowerCase().includes(term) ||
        (b.location_reference || '').toLowerCase().includes(term)

      return matchesStatus && matchesSearch
    })
  }, [buses, filterStatus, searchTerm])

  // WhatsApp Broadcast Messages
  const buildKitchenLoadMessage = () => {
    return `🚚 *PLANILLA DE RETIRO DE COCINA & DESPACHO*\n` +
      `🎪 *Show:* ${event.show_name}\n` +
      `📅 *Fecha:* ${event.event_date}\n` +
      `📍 *Sede:* ${event.venues?.name || 'Venue'}\n\n` +
      `📦 *CONSOLIDADO A CARGAR EN CAMIONETA:*\n` +
      `  • 🥪 Tradicional: ${totals.trad} viandas\n` +
      `  • 🥗 Vegetariano: ${totals.veg} viandas\n` +
      `  • 🌾 Sin TACC: ${totals.sintacc} viandas\n` +
      `  • 🌱 Vegano: ${totals.vegan} viandas\n` +
      `  • 💧 Aguas Minerales: ${totals.water} unidades\n` +
      `📊 *TOTAL A TRANSPORTAR:* ${totals.totalViandas} viandas para ${totals.totalBuses} micros\n\n` +
      `_Super Catering Manager - Logística Oficial_`
  }

  const buildArrivalBroadcast = () => {
    return `🚚 *¡LOGÍSTICA EN CAMINO AL ESTADIO!*\n\n` +
      `Hola a todos los coordinadores de *${event.show_name}*!\n` +
      `La camioneta de reparto ya está cargada y en camino al predio para la entrega de las viandas.\n\n` +
      `📍 *IMPORTANTE:* Quienes ya hayan estacionado, por favor marquen su GPS en su Tablero de Control para que el chofer los ubique rápidamente.\n\n` +
      `¡Muchas gracias!`
  }

  const buildGeneralStatusSummary = () => {
    let msg = `📋 *ESTADO DE CHECK-IN DE MICROS - ${event.show_name}*\n`
    msg += `📅 ${event.event_date} | 📍 ${event.venues?.name || 'Venue'}\n\n`
    msg += `📊 *Resumen:* ${totals.parkedCount} Estacionados | ${totals.onWayCount} En Viaje | ${totals.deliveredCount} Entregados\n\n`

    buses.forEach((b, i) => {
      const statusEmoji = b.status === 'entregado' ? '✅' : b.status === 'estacionado' ? '📍' : '🟡'
      const statusText = b.status === 'entregado' ? 'Entregado' : b.status === 'estacionado' ? 'Estacionado' : 'En Viaje'
      const coord = b.coordinator_name ? `(${b.coordinator_name})` : ''
      const ref = b.location_reference ? `— Ref: ${b.location_reference}` : ''
      msg += `${i + 1}. ${statusEmoji} *${b.company_name}* ${coord} ➔ ${statusText} ${ref}\n`
    })

    return msg
  }

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800 flex flex-col items-center justify-start p-4 sm:p-6 pb-32">
      <div className="w-full max-w-4xl space-y-6">

        {/* 1. Header Card - Mobile First */}
        <div className="bg-white border border-slate-200/90 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
            >
              <ArrowLeft size={14} /> Volver al Monitor
            </Link>

            <div className="flex items-center gap-2">
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Logística en Vivo</span>
              </span>
            </div>
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600 block mb-1">
            Hoja de Ruta y Despacho
          </span>
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-slate-900">
            {event.show_name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500 font-bold">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-indigo-500" />
              <span>{event.venues?.name || 'Venue del Evento'}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              <span>Fecha: {event.event_date}</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Total Viandas</span>
              <span className="text-2xl font-black text-indigo-600 tabular-nums">{totals.totalViandas}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
              <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider block mb-0.5">Estacionados</span>
              <span className="text-2xl font-black text-emerald-700 tabular-nums">{totals.parkedCount}</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
              <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block mb-0.5">En Viaje</span>
              <span className="text-2xl font-black text-amber-700 tabular-nums">{totals.onWayCount}</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
              <span className="text-[9px] font-black uppercase text-blue-700 tracking-wider block mb-0.5">Entregados</span>
              <span className="text-2xl font-black text-blue-700 tabular-nums">{totals.deliveredCount}</span>
            </div>
          </div>
        </div>

        {/* 2. Sección Consolidado de Carga (Retiro de Cocina / Local) */}
        <div className="bg-white border border-slate-200/90 rounded-[2.5rem] p-6 sm:p-8 space-y-4 shadow-xl shadow-slate-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                Carga de Camioneta
              </span>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                <Package size={20} className="text-indigo-600" />
                <span>Consolidado a Retirar de Cocina</span>
              </h2>
            </div>

            <button
              onClick={() => handleCopy(buildKitchenLoadMessage(), 'kitchen-load')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              {copiedKey === 'kitchen-load' ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKey === 'kitchen-load' ? '¡Copiado!' : 'Copiar Resumen Carga'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 text-center">
              <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block mb-1">🥪 Tradicional</span>
              <span className="text-2xl font-black text-amber-900 tabular-nums">{totals.trad}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 text-center">
              <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider block mb-1">🥗 Vegetariano</span>
              <span className="text-2xl font-black text-emerald-900 tabular-nums">{totals.veg}</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 text-center">
              <span className="text-[9px] font-black uppercase text-indigo-700 tracking-wider block mb-1">🌾 Sin TACC</span>
              <span className="text-2xl font-black text-indigo-900 tabular-nums">{totals.sintacc}</span>
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-2xl p-3.5 text-center">
              <span className="text-[9px] font-black uppercase text-teal-700 tracking-wider block mb-1">🌱 Vegano</span>
              <span className="text-2xl font-black text-teal-900 tabular-nums">{totals.vegan}</span>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3.5 text-center col-span-2 sm:col-span-1">
              <span className="text-[9px] font-black uppercase text-sky-700 tracking-wider block mb-1">💧 Agua Mineral</span>
              <span className="text-2xl font-black text-sky-900 tabular-nums">{totals.water}</span>
            </div>
          </div>
        </div>

        {/* 3. Centro de Mensajes Concentrados para WhatsApp */}
        <div className="bg-white border border-slate-200/90 rounded-[2.5rem] p-6 space-y-4 shadow-xl shadow-slate-200/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
            Comunicaciones Rápidas
          </span>
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-600" />
            <span>Centro de Mensajes WhatsApp</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleCopy(buildArrivalBroadcast(), 'msg-arrival')}
              className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left transition flex items-start justify-between gap-3 group cursor-pointer"
            >
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                  <Truck size={14} className="text-indigo-600" /> Aviso de Camioneta en Camino
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Avisa a todos los micros que el reparto salió y pide que marquen GPS.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shrink-0">
                {copiedKey === 'msg-arrival' ? '✅ Copiado' : 'Copiar'}
              </span>
            </button>

            <button
              onClick={() => handleCopy(buildGeneralStatusSummary(), 'msg-status')}
              className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left transition flex items-start justify-between gap-3 group cursor-pointer"
            >
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Resumen de Arribo de Micros
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Listado de qué empresas ya están en el predio con sus referencias.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shrink-0">
                {copiedKey === 'msg-status' ? '✅ Copiado' : 'Copiar'}
              </span>
            </button>
          </div>
        </div>

        {/* 4. Lista de Micros y Ubicaciones GPS en Vivo */}
        <div className="bg-white border border-slate-200/90 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                Logística en el Predio
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                <Bus size={20} className="text-indigo-600" />
                <span>Micros y Puntos de Entrega ({filteredBuses.length})</span>
              </h3>
            </div>

            {/* Filter Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                  filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos ({buses.length})
              </button>
              <button
                onClick={() => setFilterStatus('estacionado')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                  filterStatus === 'estacionado' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Estacionados ({totals.parkedCount})
              </button>
              <button
                onClick={() => setFilterStatus('en_viaje')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                  filterStatus === 'en_viaje' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                En Viaje ({totals.onWayCount})
              </button>
              <button
                onClick={() => setFilterStatus('entregado')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                  filterStatus === 'entregado' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                Entregados ({totals.deliveredCount})
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por empresa, coordinador, celular o referencia..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Bus Cards List */}
          <div className="space-y-4">
            {filteredBuses.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6">
                <Bus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  No hay micros con ese estado o búsqueda.
                </p>
              </div>
            ) : (
              filteredBuses.map(b => {
                const bk = b.breakdown || {}
                const phoneClean = (b.coordinator_phone || '').replace(/[^0-9]/g, '')
                const hasGps = b.location_lat && b.location_lng
                const mapsUrl = hasGps ? `https://www.google.com/maps/dir/?api=1&destination=${b.location_lat},${b.location_lng}` : null
                const isExpanded = expandedBusId === b.id
                const isDelivered = b.status === 'entregado'
                const isParked = b.status === 'estacionado'

                return (
                  <div
                    key={b.id}
                    className={`border rounded-3xl p-5 transition shadow-xs space-y-4 ${
                      isDelivered
                        ? 'bg-blue-50/40 border-blue-200'
                        : isParked
                        ? 'bg-emerald-50/40 border-emerald-200 ring-2 ring-emerald-500/10'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Top Row: Empresa, Viandas & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-lg text-slate-900 uppercase">
                            {b.company_name}
                          </h4>
                          {b.bus_identifier && b.bus_identifier !== 'Micro Principal' && (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              {b.bus_identifier}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-semibold mt-1">
                          {b.coordinator_name && (
                            <span className="flex items-center gap-1 text-slate-700 font-bold">
                              👤 {b.coordinator_name}
                            </span>
                          )}
                          {b.coordinator_phone && (
                            <span className="font-mono text-indigo-600">
                              📞 {b.coordinator_phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge & Deliver Button */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs ${
                          isDelivered
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isParked
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isDelivered ? 'bg-blue-600' : isParked ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                          }`} />
                          <span>{isDelivered ? 'Entregado' : isParked ? 'Estacionado / Check-in OK' : 'En Viaje'}</span>
                        </span>

                        <button
                          onClick={() => handleToggleDelivered(b.id, b.status)}
                          disabled={updatingId === b.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs active:scale-95 ${
                            isDelivered
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                          }`}
                        >
                          {isDelivered ? 'Desmarcar' : '✅ Marcar Entregado'}
                        </button>
                      </div>
                    </div>

                    {/* Ubicación GPS & Referencia de Estacionamiento */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <MapPin size={14} className={hasGps ? "text-emerald-600" : "text-slate-400"} />
                          <span>
                            {hasGps
                              ? `Ubicación GPS fijada (${b.location_lat.toFixed(4)}, ${b.location_lng.toFixed(4)})`
                              : 'Coordinador aún no envió su ubicación GPS'}
                          </span>
                        </div>
                        {b.location_reference && (
                          <p className="text-xs text-slate-600 font-semibold pl-5">
                            📍 <i>Referencia:</i> "{b.location_reference}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {hasGps && (
                          <a
                            href={mapsUrl!}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                          >
                            <Navigation size={13} />
                            <span>Navegar GPS</span>
                          </a>
                        )}

                        {phoneClean && (
                          <a
                            href={`https://wa.me/${phoneClean}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                            title="WhatsApp al coordinador"
                          >
                            <MessageCircle size={15} />
                          </a>
                        )}

                        {phoneClean && (
                          <a
                            href={`tel:${phoneClean}`}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                            title="Llamar al coordinador"
                          >
                            <Phone size={15} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Viandas Desglose de este Micro */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Viandas a Entregar:</span>
                        {bk.tradicional > 0 && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                            {bk.tradicional}x Tradicional
                          </span>
                        )}
                        {bk.vegetariano > 0 && (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                            {bk.vegetariano}x Veg
                          </span>
                        )}
                        {bk.sintacc > 0 && (
                          <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                            {bk.sintacc}x Sin TACC
                          </span>
                        )}
                        {bk.vegano > 0 && (
                          <span className="bg-teal-100 text-teal-900 border border-teal-200 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                            {bk.vegano}x Vegano
                          </span>
                        )}
                        {bk.water > 0 && (
                          <span className="bg-sky-100 text-sky-900 border border-sky-200 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                            {bk.water}x Agua
                          </span>
                        )}
                      </div>

                      {/* Botón desplegar pasajeros */}
                      {b.orders && b.orders.length > 0 && (
                        <button
                          onClick={() => setExpandedBusId(isExpanded ? null : b.id)}
                          className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{isExpanded ? 'Ocultar Pasajeros' : `Ver Pasajeros (${b.orders.length})`}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>

                    {/* Desplegable de Pasajeros Compradores */}
                    {isExpanded && b.orders && b.orders.length > 0 && (
                      <div className="pt-3 border-t border-slate-200/80 space-y-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                          Planilla de Pasajeros Compradores:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {b.orders.map((ord: any, idx: number) => (
                            <div key={ord.id || idx} className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs flex justify-between items-center">
                              <div>
                                <span className="font-bold text-slate-800 uppercase block">
                                  {idx + 1}. {ord.online_customers?.full_name || 'Pasajero'}
                                </span>
                                {ord.online_customers?.phone && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {ord.online_customers.phone}
                                  </span>
                                )}
                              </div>
                              <span className="bg-emerald-50 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-md border border-emerald-100">
                                Pagado
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
