"use client"

import React, { useState } from "react"
import { BusLogistic } from "@/types/logistics"
import { checkinBusAction } from "@/app/actions/logistics"
import {
  MapPin, Bus, User, Phone, CheckCircle2, AlertTriangle,
  Clock, Package, KeyRound, Loader2, Navigation, Sparkles, Check
} from "lucide-react"

interface Props {
  token: string
  initialBus: BusLogistic
  initialBreakdown: {
    tradicional: number
    vegetariano: number
    sintacc: number
    vegano: number
    water: number
    total_paid: number
    liberated_viandas: number
    liberated_water: number
    total_delivery_viandas: number
    total_delivery_water: number
  }
}

export default function CoordinatorCheckin({ token, initialBus, initialBreakdown }: Props) {
  const [bus, setBus] = useState<BusLogistic>(initialBus)
  const [breakdown, setBreakdown] = useState(initialBreakdown)

  const [coordName, setCoordName] = useState(bus.coordinator_name || "")
  const [coordPhone, setCoordPhone] = useState(bus.coordinator_phone || "")
  const [reference, setReference] = useState(bus.location_reference || "")
  const [pin, setPin] = useState(bus.pin_confirmation || Math.floor(1000 + Math.random() * 9000).toString())

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    bus.location_lat && bus.location_lng
      ? { lat: Number(bus.location_lat), lng: Number(bus.location_lng) }
      : null
  )
  const [gettingGps, setGettingGps] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successSaved, setSuccessSaved] = useState(bus.status === "estacionado" || bus.status === "entregado")

  // Auto-saves immediately upon obtaining GPS
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización.")
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

        // AUTO-SAVE immediately to database
        setSubmitting(true)
        try {
          const res = await checkinBusAction(token, {
            coordinator_name: coordName.trim() || bus.coordinator_name || "Coordinador",
            coordinator_phone: coordPhone.trim() || bus.coordinator_phone || "",
            location_lat: lat,
            location_lng: lng,
            location_reference: reference.trim() || bus.location_reference || "",
            pin_confirmation: pin
          })

          if (res.success && res.data) {
            setBus(res.data)
            setSuccessSaved(true)
          }
        } catch (e) {
          console.error("Auto-save error:", e)
        } finally {
          setSubmitting(false)
        }
      },
      err => {
        console.error("GPS error:", err)
        setGpsError("Por favor habilita el permiso de ubicación GPS en tu celular.")
        setGettingGps(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!coords) {
      alert("Por favor marca la ubicación GPS de tu estacionamiento antes de confirmar.")
      return
    }

    setSubmitting(true)
    const res = await checkinBusAction(token, {
      coordinator_name: coordName.trim() || "Coordinador",
      coordinator_phone: coordPhone.trim(),
      location_lat: coords.lat,
      location_lng: coords.lng,
      location_reference: reference.trim(),
      pin_confirmation: pin
    })

    if (res.success && res.data) {
      setBus(res.data)
      setSuccessSaved(true)
    } else {
      alert(res.error || "Ocurrió un error al guardar el check-in.")
    }
    setSubmitting(false)
  }

  const ev = (bus as any).events_master

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 pb-24">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Header Event Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-black uppercase tracking-wider">
              <Bus size={13} />
              <span>{bus.company_name || "Transporte de Pasajeros"}</span>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              bus.status === 'entregado' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              bus.status === 'estacionado' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              <span className="w-2 h-2 rounded-full animate-pulse bg-current" />
              {bus.status === 'entregado' ? 'Pedido Entregado' : bus.status === 'estacionado' ? 'Estacionado / Esperando' : 'En Viaje'}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">
            {ev?.show_name || "Evento Recital"}
          </h1>
          <p className="text-xs text-indigo-200/80 font-bold mt-1 flex items-center gap-1.5">
            <MapPin size={12} className="text-indigo-400" />
            {ev?.venues?.name || "Predio / Estadio"} • {ev?.event_date || ""}
          </p>

          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Identificación Coche</p>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">{bus.bus_identifier}</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PIN de Entrega</p>
              <p className="text-lg font-black text-amber-400 tracking-widest bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-xl font-mono">
                {pin}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown Viandas Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <Package size={18} />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Viandas para este Coche</h3>
            </div>
            <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 rounded-full">
              {breakdown.total_delivery_viandas} Viandas + {breakdown.total_delivery_water} Aguas
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Tradicional</p>
              <p className="text-lg font-black text-white">{breakdown.tradicional}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Vegetariano</p>
              <p className="text-lg font-black text-emerald-400">{breakdown.vegetariano}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Sin TACC</p>
              <p className="text-lg font-black text-amber-400">{breakdown.sintacc}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Vegano</p>
              <p className="text-lg font-black text-teal-400">{breakdown.vegano}</p>
            </div>
          </div>

          {breakdown.liberated_viandas > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400" />
                <span className="font-bold text-indigo-200">Bonificación Tripulación (Chofer/Coordi):</span>
              </div>
              <span className="font-black text-indigo-300">+{breakdown.liberated_viandas} vianda{breakdown.liberated_viandas > 1 ? 's' : ''} {breakdown.liberated_water > 0 && `+ ${breakdown.liberated_water} agua`}</span>
            </div>
          )}
        </div>

        {/* Checkin Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl space-y-5">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 mb-1">
              <Navigation size={16} className="text-indigo-400" />
              Punto de Encuentro y Check-in
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Al llegar al predio, tocá el botón para enviar tu posición GPS exacta a la camioneta de reparto.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={gettingGps || submitting}
              className={`w-full py-4 px-5 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2.5 transition shadow-lg cursor-pointer ${
                coords
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30"
              }`}
            >
              {gettingGps || submitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Guardando Ubicación GPS...</span>
                </>
              ) : coords ? (
                <>
                  <CheckCircle2 size={18} className="text-emerald-200" />
                  <span>📍 Ubicación Guardada (Actualizar GPS)</span>
                </>
              ) : (
                <>
                  <MapPin size={18} />
                  <span>📍 Marcar Ubicación de Estacionamiento</span>
                </>
              )}
            </button>

            {coords && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center flex items-center justify-center gap-1.5">
                <Check size={14} className="text-emerald-400" />
                <p className="text-xs font-bold text-emerald-300">
                  GPS Guardado: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
              </div>
            )}

            {gpsError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-center text-xs font-bold text-rose-300 flex items-center justify-center gap-2">
                <AlertTriangle size={14} />
                <span>{gpsError}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User size={12} /> Tu Nombre (Coordinador)
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Aye"
                value={coordName}
                onChange={e => setCoordName(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Phone size={12} /> WhatsApp / Celular
              </label>
              <input
                type="tel"
                placeholder="Ej: +54 9 3415 63-5494"
                value={coordPhone}
                onChange={e => setCoordPhone(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Referencia Visual del Micro
            </label>
            <input
              type="text"
              placeholder="Ej: Frente al portón 4, bajo el ombú grande, micro blanco"
              value={reference}
              onChange={e => setReference(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-white outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black uppercase text-sm tracking-wider rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin text-slate-950" size={18} />
                <span>Guardando...</span>
              </>
            ) : successSaved ? (
              <>
                <Check size={18} strokeWidth={3} />
                <span>Guardar Cambios de Check-in</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Confirmar Llegada y Estacionamiento</span>
              </>
            )}
          </button>
        </form>

        {successSaved && (
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2 animate-in fade-in zoom-in duration-300">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center justify-center gap-1.5">
              <CheckCircle2 size={16} /> ¡Check-in confirmado para {bus.bus_identifier}!
            </p>
            <p className="text-xs text-slate-300 font-medium">
              La camioneta de reparto ya tiene tus coordenadas en su hoja de ruta. Al momento de la entrega, te solicitarán el PIN <strong className="text-amber-400">{pin}</strong>.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
