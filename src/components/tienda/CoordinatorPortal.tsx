"use client"

import React, { useState, useMemo } from 'react'
import { 
  Bus, MapPin, Users, Phone, CheckCircle2, Clock, 
  Search, Copy, Check, Navigation, AlertTriangle, 
  Sparkles, ExternalLink, Printer, ShieldCheck, 
  ChevronRight, MessageCircle, RefreshCw, Loader2, Store, Calendar, User
} from 'lucide-react'
import { saveCoordinatorCheckinBySlugAction } from '@/app/actions/logistics'
import Link from 'next/link'

interface Props {
  store: any
  companyName: string
  orders: any[]
  initialBus: any
  defaultCoordName?: string
  defaultCoordPhone?: string
}

export default function CoordinatorPortal({ 
  store, 
  companyName, 
  orders, 
  initialBus,
  defaultCoordName = '',
  defaultCoordPhone = ''
}: Props) {
  const [bus, setBus] = useState<any>(initialBus || {})
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false)
  const [copiedStoreLink, setCopiedStoreLink] = useState(false)

  // Check-in Form States (Pre-filled from Event Management if available, fully editable)
  const [coordName, setCoordName] = useState(bus?.coordinator_name || defaultCoordName)
  const [coordPhone, setCoordPhone] = useState(bus?.coordinator_phone || defaultCoordPhone)
  const [reference, setReference] = useState(bus?.location_reference || '')
  
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    bus?.location_lat && bus?.location_lng
      ? { lat: Number(bus.location_lat), lng: Number(bus.location_lng) }
      : null
  )
  const [gettingGps, setGettingGps] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [submittingCheckin, setSubmittingCheckin] = useState(false)
  const [checkinSuccess, setCheckinSuccess] = useState(bus?.status === 'estacionado' || bus?.status === 'entregado')

  const ev = store.events_master

  // Calculate totals
  const totals = useMemo(() => {
    let trad = 0
    let veg = 0
    let sintacc = 0
    let vegan = 0
    let totalViandas = 0
    let totalMoney = 0

    orders.forEach(o => {
      const qTrad = Number(o.qty_tradicional) || 0
      const qVeg = Number(o.qty_vegetariano) || 0
      const qStacc = Number(o.qty_sintacc) || 0
      const qVegan = Number(o.qty_vegano) || 0
      
      trad += qTrad
      veg += qVeg
      sintacc += qStacc
      vegan += qVegan
      totalViandas += (qTrad + qVeg + qStacc + qVegan)
      totalMoney += Number(o.total_amount) || 0
    })

    return {
      trad,
      veg,
      sintacc,
      vegan,
      totalViandas,
      totalMoney,
      totalPassengers: orders.length
    }
  }, [orders])

  // Filter orders by search term
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders
    const term = searchTerm.toLowerCase().trim()
    return orders.filter(o => {
      const name = (o.online_customers?.full_name || '').toLowerCase()
      const phone = (o.online_customers?.phone || '').toLowerCase()
      const busId = (o.bus_identifier || '').toLowerCase()
      return name.includes(term) || phone.includes(term) || busId.includes(term)
    })
  }, [orders, searchTerm])

  // Handle GPS Checkin
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización.')
      return
    }

    setGettingGps(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        setGettingGps(false)

        setSubmittingCheckin(true)
        try {
          const res = await saveCoordinatorCheckinBySlugAction({
            storeSlug: store.slug,
            coordinator_name: coordName.trim() || 'Coordinador',
            coordinator_phone: coordPhone.trim(),
            location_lat: lat,
            location_lng: lng,
            location_reference: reference.trim() || 'Estacionamiento Venue'
          })

          if (res.success && res.data) {
            setBus(res.data)
            setCheckinSuccess(true)
          }
        } catch (e) {
          console.error('Checkin auto-save error:', e)
        } finally {
          setSubmittingCheckin(false)
        }
      },
      err => {
        console.error('GPS error:', err)
        setGpsError('Por favor habilita el permiso de ubicación GPS en tu celular.')
        setGettingGps(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handleManualSaveCheckin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!coords) {
      alert('Por favor presioná "Marcar Ubicación GPS" antes de guardar para registrar el punto exacto de estacionamiento.')
      return
    }

    setSubmittingCheckin(true)
    try {
      const res = await saveCoordinatorCheckinBySlugAction({
        storeSlug: store.slug,
        coordinator_name: coordName.trim() || 'Coordinador',
        coordinator_phone: coordPhone.trim(),
        location_lat: coords.lat,
        location_lng: coords.lng,
        location_reference: reference.trim()
      })

      if (res.success && res.data) {
        setBus(res.data)
        setCheckinSuccess(true)
        alert('¡Check-in guardado con éxito! El equipo de catering ya puede ver la ubicación de tu micro.')
      } else {
        alert(res.error || 'Ocurrió un error al guardar.')
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setSubmittingCheckin(false)
    }
  }

  // Copy WhatsApp summary list
  const copyWhatsappList = () => {
    let text = `📋 *LISTADO DE COMPRADORES DE VIANDAS*\n`
    text += `🎪 *Evento:* ${ev?.show_name || store.title}\n`
    text += `🚌 *Empresa:* ${companyName}\n`
    text += `📅 *Fecha:* ${ev?.event_date || store.available_dates?.[0] || 'Día del Show'}\n\n`
    text += `📊 *RESUMEN TOTAL: ${totals.totalViandas} Viandas (${totals.totalPassengers} Pasajeros)*\n`
    if (totals.trad > 0) text += `  • Tradicional: ${totals.trad}\n`
    if (totals.veg > 0) text += `  • Vegetariano: ${totals.veg}\n`
    if (totals.sintacc > 0) text += `  • Sin TACC: ${totals.sintacc}\n`
    if (totals.vegan > 0) text += `  • Vegano: ${totals.vegan}\n`
    text += `\n📝 *DETALLE DE PASAJEROS:*\n`

    orders.forEach((o, i) => {
      const cust = o.online_customers
      const name = cust?.full_name || 'Pasajero'
      const phone = cust?.phone ? `(${cust.phone})` : ''
      const busId = o.bus_identifier ? `[Micro: ${o.bus_identifier}]` : ''

      const items: string[] = []
      if (o.qty_tradicional > 0) items.push(`${o.qty_tradicional}x Tradicional`)
      if (o.qty_vegetariano > 0) items.push(`${o.qty_vegetariano}x Veg`)
      if (o.qty_sintacc > 0) items.push(`${o.qty_sintacc}x Sin TACC`)
      if (o.qty_vegano > 0) items.push(`${o.qty_vegano}x Vegano`)

      text += `${i + 1}. ${name} ${phone} ${busId} ➔ ${items.join(', ')} ✅\n`
    })

    text += `\n_Super Catering Management System_`

    navigator.clipboard.writeText(text)
    setCopiedWhatsapp(true)
    setTimeout(() => setCopiedWhatsapp(false), 2500)
  }

  const copyStoreLink = () => {
    const url = `${window.location.origin}/tienda/${store.slug}`
    navigator.clipboard.writeText(url)
    setCopiedStoreLink(true)
    setTimeout(() => setCopiedStoreLink(false), 2500)
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col items-center justify-start p-4 sm:p-8 pb-32">
      <div className="w-full max-w-3xl space-y-6">

        {/* 1. Header Card - Light Theme */}
        <div className="bg-white border border-slate-200/80 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-black uppercase tracking-wider">
              <Bus size={14} className="text-indigo-600" />
              <span>{companyName || 'Transporte de Pasajeros'}</span>
            </div>

            <div className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
              bus?.status === 'entregado'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : bus?.status === 'estacionado'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                bus?.status === 'entregado' ? 'bg-emerald-500' : bus?.status === 'estacionado' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <span>
                {bus?.status === 'entregado'
                  ? 'Pedido Entregado'
                  : bus?.status === 'estacionado'
                  ? 'Estacionado / Check-in OK'
                  : 'En Viaje'}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600 block mb-1">
            Tablero de Control del Coordinador
          </span>
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-slate-900">
            {ev?.show_name || store.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500 font-bold">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-indigo-500" />
              <span>{ev?.venues?.name || 'Venue del Evento'}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <span>Fecha: {ev?.event_date || store.available_dates?.[0] || 'Día del Show'}</span>
            </div>
          </div>

          {/* Action Links Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap gap-2.5">
            <button
              onClick={copyStoreLink}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              {copiedStoreLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedStoreLink ? '¡Link Copiado!' : 'Copiar Link Tienda'}</span>
            </button>
            <Link
              href={`/tienda/${store.slug}`}
              target="_blank"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition shadow-sm active:scale-95"
            >
              <ExternalLink size={14} />
              <span>Abrir Tienda Online</span>
            </Link>
          </div>
        </div>

        {/* 2. Resumen Métricas de Viandas Pedidas */}
        <div className="bg-white border border-slate-200/80 rounded-[2.5rem] p-6 space-y-4 shadow-xl shadow-slate-200/60">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">
                Total Acumulado
              </span>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                <Users size={22} className="text-indigo-600" />
                <span>{totals.totalViandas} Viandas Pedidas</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Pasajeros
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 tabular-nums">
                {totals.totalPassengers}
              </span>
            </div>
          </div>

          {/* Desglose por Combo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block mb-1">
                🥪 Tradicional
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-900 tabular-nums">
                {totals.trad}
              </span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider block mb-1">
                🥗 Vegetariano
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-900 tabular-nums">
                {totals.veg}
              </span>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase text-indigo-700 tracking-wider block mb-1">
                🌾 Sin TACC
              </span>
              <span className="text-2xl sm:text-3xl font-black text-indigo-900 tabular-nums">
                {totals.sintacc}
              </span>
            </div>

            <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase text-teal-700 tracking-wider block mb-1">
                🌱 Vegano
              </span>
              <span className="text-2xl sm:text-3xl font-black text-teal-900 tabular-nums">
                {totals.vegan}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Planilla y Listado Detallado de Pasajeros Compradores */}
        <div className="bg-white border border-slate-200/80 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                Planilla de Pasajeros
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                <span>Listado de Compradores ({filteredOrders.length})</span>
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyWhatsappList}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                {copiedWhatsapp ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedWhatsapp ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer size={14} />
                <span>Imprimir</span>
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
              placeholder="Buscar pasajero por nombre, micro o celular..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition shadow-xs"
            />
          </div>

          {/* Passenger Cards / List */}
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {orders.length === 0 ? 'No hay compras registradas aún.' : 'No se encontraron pasajeros con esa búsqueda.'}
                </p>
              </div>
            ) : (
              filteredOrders.map((o, idx) => {
                const cust = o.online_customers
                const phoneClean = (cust?.phone || '').replace(/[^0-9]/g, '')

                return (
                  <div
                    key={o.id}
                    className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 tabular-nums">#{idx + 1}</span>
                        <h4 className="font-black text-sm text-slate-900 uppercase">
                          {cust?.full_name || 'Pasajero Anónimo'}
                        </h4>
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
                          Pagado
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        {cust?.phone && (
                          <span className="flex items-center gap-1 text-indigo-600 font-mono">
                            <Phone size={11} /> {cust.phone}
                          </span>
                        )}
                        {o.bus_identifier && (
                          <span className="bg-white text-slate-700 border border-slate-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            Micro: {o.bus_identifier}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Combos ordered */}
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {o.qty_tradicional > 0 && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-xl">
                            {o.qty_tradicional}x Tradicional
                          </span>
                        )}
                        {o.qty_vegetariano > 0 && (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-xl">
                            {o.qty_vegetariano}x Veg
                          </span>
                        )}
                        {o.qty_sintacc > 0 && (
                          <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black px-2.5 py-1 rounded-xl">
                            {o.qty_sintacc}x Sin TACC
                          </span>
                        )}
                        {o.qty_vegano > 0 && (
                          <span className="bg-teal-100 text-teal-900 border border-teal-200 text-[10px] font-black px-2.5 py-1 rounded-xl">
                            {o.qty_vegano}x Vegano
                          </span>
                        )}
                      </div>

                      {phoneClean && (
                        <a
                          href={`https://wa.me/${phoneClean}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                          title="Enviar WhatsApp al pasajero"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 4. Módulo de Check-in de Estacionamiento (GPS & Contacto Auto-Cargado y Editable) */}
        <div className="bg-white border border-slate-200/80 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shadow-xs">
                <Navigation size={22} className="text-amber-700" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">
                  Logística en el Venue
                </span>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  Check-in de Estacionamiento
                </h3>
              </div>
            </div>

            {checkinSuccess && (
              <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                <CheckCircle2 size={14} className="text-emerald-700" /> Estacionado
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Cuando llegues al estadio o predio y estaciones el micro, presioná el botón para registrar tu ubicación GPS y referencia para el repartidor.
          </p>

          <form onSubmit={handleManualSaveCheckin} className="space-y-4">
            {/* GPS Button */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <MapPin size={16} className={coords ? "text-emerald-600" : "text-slate-400"} />
                  <span className="text-xs font-bold text-slate-700">
                    {coords ? `Ubicación GPS fijada (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Sin ubicación GPS registrada'}
                  </span>
                </div>
                {gpsError && (
                  <p className="text-[11px] text-rose-600 font-bold">{gpsError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={gettingGps || submittingCheckin}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {gettingGps ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                <span>{gettingGps ? 'Obteniendo GPS...' : coords ? 'Actualizar GPS' : 'Marcar Ubicación GPS'}</span>
              </button>
            </div>

            {/* Reference & Contact Fields (Auto-filled & Fully Editable) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5 flex items-center gap-1">
                  <User size={12} className="text-indigo-600" /> Nombre Coordinador / Chofer
                </label>
                <input
                  type="text"
                  value={coordName}
                  onChange={e => setCoordName(e.target.value)}
                  placeholder="Tu nombre o del chofer"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5 flex items-center gap-1">
                  <Phone size={12} className="text-emerald-600" /> Celular WhatsApp
                </label>
                <input
                  type="text"
                  value={coordPhone}
                  onChange={e => setCoordPhone(e.target.value)}
                  placeholder="Ej: 11 5566 7788"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5 flex items-center gap-1">
                  <MapPin size={12} className="text-amber-600" /> Referencia de Estacionamiento
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="Ej: Fila 4 / Puerta 3"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingCheckin}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {submittingCheckin ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>Guardar Datos de Check-In</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
