"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Calculator, Truck, Users, Plus, Trash2, Calendar,
  ClipboardList, MapPin, AlertCircle, CheckCircle2,
  Save, Printer, Loader2, Building2, ChevronDown, ChevronUp
} from "lucide-react"

interface UnitRecord {
  id: string
  name: string
  vehicle_id: string
  coordinator_id: string
  sold: number
  liberated: number
  traditional: number
  vegetarian: number
  vegana: number
  sin_tacc: number
  water: number
  observations: string
  details: { id: string; category: string; qty: number; obs: string }[]
  isExpanded: boolean
}

interface EventMaster {
  id: string
  event_date: string
  show_name: string
  status: string
  venues?: { name: string; address?: string; meeting_point?: string }
  coordinators?: { id: string; name: string; phone?: string }
  event_projections?: { id: string; company_name: string; projected_pax: number }[]
}

const newUnit = (name: string): UnitRecord => ({
  id: crypto.randomUUID(),
  name,
  vehicle_id: "",
  coordinator_id: "",
  sold: 0, liberated: 0,
  traditional: 0, vegetarian: 0, vegana: 0, sin_tacc: 0,
  water: 0, observations: "", details: [], isExpanded: true,
})

export default function EventSalesForm({ commercialRules = [], coordinators = [], vehicles = [], clients = [] }: any) {
  // Master event selection
  const [events, setEvents] = useState<EventMaster[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [loadingEvents, setLoadingEvents] = useState(true)

  // Form state
  const [deliveryTime, setDeliveryTime] = useState("")
  const [deliveryPoint, setDeliveryPoint] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [units, setUnits] = useState<UnitRecord[]>([newUnit("Micro 1")])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load events_master on mount
  useEffect(() => {
    supabase
      .from("events_master")
      .select("*, venues(name, address, meeting_point), coordinators(id, name, phone), event_projections(id, company_name, projected_pax)")
      .in("status", ["pendiente", "confirmado", "proyectado", "Pendiente", "Confirmado"])
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        setEvents(data || [])
        setLoadingEvents(false)
      })
  }, [])

  // --- Derived Data ---
  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId) || null, [events, selectedEventId])
  const availableCompanies = useMemo(() => selectedEvent?.event_projections?.map(p => p.company_name) || [], [selectedEvent])
  const projectedPax = useMemo(() => selectedEvent?.event_projections?.find(p => p.company_name === selectedCompany)?.projected_pax || 0, [selectedEvent, selectedCompany])

  // Pre-populate delivery point from venue
  useEffect(() => {
    if (selectedEvent?.venues?.meeting_point) {
      setDeliveryPoint(selectedEvent.venues.meeting_point)
    } else if (selectedEvent?.venues?.name) {
      setDeliveryPoint(selectedEvent.venues.name)
    }
    if (selectedEvent?.venues?.address) {
      setDeliveryAddress(selectedEvent.venues.address)
    }
  }, [selectedEvent])

  // Reset company when event changes
  useEffect(() => {
    setSelectedCompany("")
  }, [selectedEventId])

  // --- Commercial Rule ---
  const activeRule = useMemo(() => {
    if (!selectedCompany) return null
    return commercialRules.find((r: any) =>
      r.company_name?.toLowerCase().trim() === selectedCompany?.toLowerCase().trim()
    ) || null
  }, [selectedCompany, commercialRules])

  // --- Unit Handlers ---
  const addUnit = () => setUnits(prev => [...prev, newUnit(`Micro ${prev.length + 1}`)])
  const removeUnit = (id: string) => setUnits(prev => prev.length > 1 ? prev.filter(u => u.id !== id) : prev)

  const updateUnit = useCallback((id: string, field: keyof UnitRecord, value: any) => {
    setUnits(prev => prev.map(u => {
      if (u.id !== id) return u
      const updated = { ...u, [field]: value }
      if ((field === 'sold' || field === 'liberated') && activeRule?.includes_water) {
        updated.water = (Number(updated.sold) || 0) + (Number(updated.liberated) || 0)
      }
      return updated
    }))
  }, [activeRule])

  // --- Totals & Validation ---
  const totals = useMemo(() => {
    const consolidated = units.reduce((acc, u) => ({
      sold: acc.sold + (Number(u.sold) || 0),
      liberated: acc.liberated + (Number(u.liberated) || 0),
      trad: acc.trad + (Number(u.traditional) || 0),
      veg: acc.veg + (Number(u.vegetarian) || 0),
      vegan: acc.vegan + (Number(u.vegana) || 0),
      st: acc.st + (Number(u.sin_tacc) || 0),
      water: acc.water + (Number(u.water) || 0)
    }), { sold: 0, liberated: 0, trad: 0, veg: 0, vegan: 0, st: 0, water: 0 })

    if (!activeRule) {
      return {
        ...consolidated,
        amount: 0,
        allValid: false,
        unitsValidity: [],
        CupoGratis: 0,
        SinTaccExcedentes: 0,
        SinTaccFacturables: 0,
        price_base: 0,
        price_sintacc_effective: 0,
        price_sintacc_threshold: 0,
        hasSpecialSinTaccPrice: false
      }
    }

    const SinTaccFacturables = Math.max(0, consolidated.st - consolidated.liberated)
    const pax = projectedPax || 0
    const limitPct = Number(activeRule.sintacc_limit_pct || 0)
    const CupoGratis = Math.ceil(pax * (limitPct / 100))
    const SinTaccExcedentes = Math.max(0, SinTaccFacturables - CupoGratis)

    const price_base = Number(activeRule.price_base || 0)
    // Regla de Oro: special_sintacc_price tiene prioridad absoluta
    // Si la empresa tiene precio especial (ej: RV TRASLADOS = $10.000), se usa ese.
    // Si no, se usa price_sintacc_base del evento, y si tampoco existe, se usa price_base.
    const price_sintacc_effective = Number(activeRule.special_sintacc_price) > 0
      ? Number(activeRule.special_sintacc_price)
      : Number(activeRule.price_sintacc_base || price_base)
    const price_sintacc_threshold = Number(activeRule.price_sintacc_threshold || 0)

    const amount = (consolidated.sold * price_base) +
      (SinTaccFacturables * (price_sintacc_effective - price_base)) +
      (SinTaccExcedentes * (price_sintacc_threshold - price_sintacc_effective))

    const unitsValidity = units.map(u => {
      const sumCat = (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0)
      const sumOp = (Number(u.sold) || 0) + (Number(u.liberated) || 0)
      return { id: u.id, isValid: sumCat === sumOp }
    })
    const allValid = unitsValidity.every(v => v.isValid) && selectedEventId !== "" && selectedCompany !== ""
    return {
      ...consolidated,
      CupoGratis,
      SinTaccExcedentes,
      SinTaccFacturables,
      amount,
      allValid,
      unitsValidity,
      price_base,
      price_sintacc_effective,
      price_sintacc_threshold,
      hasSpecialSinTaccPrice: Number(activeRule.special_sintacc_price) > 0,
    }
  }, [units, activeRule, projectedPax, selectedEventId, selectedCompany])

  // --- Save ---
  const saveAll = async () => {
    if (!totals?.allValid) return
    setLoading(true)
    setMessage(null)
    try {
      const { data: header, error: hErr } = await supabase
        .from('event_sales_headers')
        .insert([{
          event_id: selectedEventId,
          event_master_id: selectedEventId,
          company: selectedCompany,
          company_name: selectedCompany,
          event_date: selectedEvent?.event_date,
          venue: selectedEvent?.venues?.name,
          coordinator_name: selectedEvent?.coordinators?.name,
          delivery_time: deliveryTime,
          delivery_point: deliveryPoint,
          delivery_address: deliveryAddress,
          pax_projected: projectedPax,
          total_amount: totals.amount
        }])
        .select()
        .single()

      if (hErr) throw hErr

      const unitsToInsert = units.map(u => {
        const breakdown = u.details.map(d => ({
          type: d.category,
          qty: d.qty,
          note: d.obs
        }))
        return {
          header_id: header.id,
          unit_name: u.name,
          sold_qty: u.sold,
          liberated_qty: u.liberated,
          traditional: u.traditional,
          vegetarian: u.vegetarian,
          vegana: u.vegana,
          sin_tacc: u.sin_tacc,
          water_qty: u.water,
          special_breakdown: breakdown.length > 0 ? JSON.stringify(breakdown) : null,
          traditional_special: breakdown.filter(b => b.type === 'traditional').reduce((a, b) => a + b.qty, 0),
          vegetarian_special: breakdown.filter(b => b.type === 'vegetarian').reduce((a, b) => a + b.qty, 0),
          vegana_special: breakdown.filter(b => b.type === 'vegana').reduce((a, b) => a + b.qty, 0),
          observations: u.observations
        }
      })

      const { error: uErr } = await supabase.from('event_sales_units').insert(unitsToInsert)
      if (uErr) throw uErr

      // Persistir asignaciones de flota
      const validClientRecord = clients.find((c: any) => c.name?.toLowerCase() === selectedCompany?.toLowerCase())
      const cId = validClientRecord?.id
      
      const busesToSave = units.filter(u => u.vehicle_id).map(u => ({
         event_id: selectedEventId,
         client_id: cId,
         vehicle_id: u.vehicle_id,
         coordinator_id: u.coordinator_id || null
      }))
      
      if (busesToSave.length > 0) {
         const { error: bErr } = await supabase.from('event_bus_assignments').upsert(busesToSave)
         if (bErr) throw bErr
      }

      // STICKY SELECTION: Reset only units, keep Event + Company selected
      setUnits([newUnit("Micro 1")])
      setDeliveryTime("")
      setMessage({ type: 'success', text: `¡Venta guardada para ${selectedCompany}! Podés seguir cargando micros.` })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Error al guardar" })
    } finally {
      setLoading(false)
    }
  }

  // --- PDF Print ---
  const handlePrint = () => {
    if (!selectedEvent) return
    const venueName = selectedEvent.venues?.name || ""
    const dateStr = selectedEvent.event_date?.replace(/-/g, '') || ""
    const docTitle = `${dateStr} - ${selectedCompany} - REMITO DE DESCARGA`

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; }
            .page-break { page-break-after: always; padding: 20px 0; }
            .page-break:last-child { page-break-after: avoid; }
            .header { border-bottom: 4px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 10px; background: #f8fafc; padding: 20px; border-radius: 12px; }
            .meta-item b { display: block; text-transform: uppercase; font-size: 9px; color: #64748b; margin-bottom: 2px; }
            .meta-item span { font-weight: 800; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 25px; }
            th { background: #f8fafc; text-align: left; padding: 8px 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .total-row { background: #1e293b; color: white; }
            .total-row td { font-weight: 900; font-size: 14px; padding: 10px 12px; }
            .section-title { font-size: 13px; text-transform: uppercase; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 25px; margin-bottom: 10px; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
            @media print {
              body { padding: 0 !important; }
              .page-break { padding: 40px; min-height: 100vh; box-sizing: border-box; }
            }
          </style>
        </head>
        <body>
          ${units.map((u, index) => {
            const vehicle = vehicles.find((v: any) => v.id === u.vehicle_id)
            const patente = vehicle?.plate || 'S/D'
            
            const coordinator = coordinators.find((c: any) => c.id === u.coordinator_id)
            const coordName = coordinator?.name || 'S/D'
            const coordPhone = coordinator?.phone || 'S/D'

            const totalSandwiches = (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0)
            const waterQty = Number(u.water) || 0

            return `
              <div class="page-break">
                <div class="header">
                  <h1 style="margin:0;font-size:20px;font-weight:900;">REMITO DE DESCARGA POR EMPRESA</h1>
                  <p style="margin:4px 0 0;color:#6366f1;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;font-size:12px;">UNIDAD: ${u.name}</p>
                </div>

                <div class="meta-grid">
                  <div class="meta-item"><b>Empresa de Transporte</b><span>${selectedCompany}</span></div>
                  <div class="meta-item"><b>Vehículo / Patente</b><span>${vehicle?.internal_name || 'S/D'} ${patente !== 'S/D' ? `(${patente})` : ''}</span></div>
                  <div class="meta-item"><b>Coordinador / Responsable</b><span>${coordName}</span></div>
                  <div class="meta-item"><b>Teléfono Coordinador</b><span>${coordPhone}</span></div>
                </div>
                
                <div style="margin-bottom: 25px; border-top: 2px solid #e2e8f0; padding-top: 15px;" class="meta-grid">
                  <div class="meta-item"><b>Evento / Show</b><span>${selectedEvent.show_name}</span></div>
                  <div class="meta-item"><b>Fecha</b><span>${new Date(selectedEvent.event_date + 'T12:00:00').toLocaleDateString('es-AR')}</span></div>
                  <div class="meta-item"><b>Horario de Descarga</b><span>${deliveryTime || 'S/D'}</span></div>
                  <div class="meta-item"><b>Punto de Entrega / Venue</b><span>${venueName} - ${deliveryPoint || ''}</span></div>
                </div>

                <h3 class="section-title">1. Detalle de Viandas (Sólidos)</h3>
                <table>
                  <thead>
                    <tr><th>Tipo de Menu</th><th>Cantidad</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Menu Tradicional</td><td>${u.traditional}</td></tr>
                    <tr><td>Menu Vegetariano</td><td>${u.vegetarian}</td></tr>
                    <tr><td>Menu Vegano</td><td>${u.vegana}</td></tr>
                    <tr><td>Menu Sin TACC</td><td>${u.sin_tacc}</td></tr>
                    <tr class="total-row"><td>TOTAL SANDWICHES</td><td>${totalSandwiches}</td></tr>
                  </tbody>
                </table>

                <h3 class="section-title">2. Detalle de Bebidas (Líquidos)</h3>
                <table>
                  <thead>
                    <tr><th>Tipo de Bebida</th><th>Cantidad</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Agua Sin Gas (500ml)</td><td>${waterQty}</td></tr>
                    <tr class="total-row"><td>TOTAL BEBIDAS</td><td>${waterQty}</td></tr>
                  </tbody>
                </table>

                ${u.details && u.details.length > 0 ? `
                  <div style="margin-top: 15px; padding: 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;">
                     <h4 style="margin: 0 0 8px 0; color: #b45309; font-size: 11px; text-transform: uppercase;">Pedidos Especiales</h4>
                     ${u.details.filter((d:any) => d.obs && d.qty > 0).map((d:any) => `<div style="font-size: 12px; color: #92400e;">▸ ${d.qty}x ${d.category.toUpperCase()} - ${d.obs}</div>`).join('')}
                  </div>
                ` : ''}

                <div style="margin-top: 25px; border: 2px dashed #cbd5e1; padding: 15px; border-radius: 12px;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #475569;">Observaciones Operativas</p>
                  <p style="color: #0f172a; font-size: 12px; min-height: 40px; font-style: italic;">${u.observations || 'Sin observaciones...'}</p>
                </div>

                <div style="margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                  <div></div>
                  <div style="border-top: 1px solid #94a3b8; padding-top: 10px;">
                    <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 11px; text-transform: uppercase;">Conforme Recepción Cliente</p>
                    <div style="font-size: 12px; color: #475569; display: grid; grid-template-columns: 1fr; gap: 15px;">
                      <div>Nombre: ..............................................................</div>
                      <div>Firma: .................................................................</div>
                      <div>Fecha y Hora: .......................................................</div>
                    </div>
                  </div>
                </div>

                <div class="footer">
                  Página ${index + 1} de ${units.length} | Generado por Super Catering Manager — ${new Date().toLocaleString('es-AR')} | ${docTitle}.pdf
                </div>
              </div>
            `
          }).join('')}
          <script>window.onload = () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 500) }, 100) }</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // --- Render ---
  return (
    <div className="flex flex-col gap-8 pb-32">

      {/* SECTION 1: EVENTO + EMPRESA */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-6 border-b pb-4">
          <ClipboardList className="text-indigo-500" />
          <h2 className="text-xl font-bold text-slate-800">Selección de Evento</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
              <Calendar size={10} /> Evento Maestro
            </label>
            {loadingEvents ? (
              <div className="flex items-center gap-2 p-4 text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Cargando eventos...
              </div>
            ) : (
              <select
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition font-bold"
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
              >
                <option value="">-- Seleccionar Evento --</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.event_date + 'T12:00:00').toLocaleDateString('es-AR')} — {e.show_name} @ {e.venues?.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Company Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
              <Building2 size={10} /> Empresa
            </label>
            <select
              disabled={!selectedEventId}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition font-bold disabled:opacity-50"
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
            >
              <option value="">-- Seleccionar Empresa --</option>
              {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Event Info Banner */}
        {selectedEvent && selectedCompany && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">PAX Proyectados</p>
              <p className="text-2xl font-black text-slate-800">{projectedPax}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Venue</p>
              <p className="text-sm font-bold text-slate-700">{selectedEvent.venues?.name || "S/D"}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Precio Sin TACC</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                {totals?.price_sintacc_effective ? `$${Number(totals.price_sintacc_effective).toLocaleString('es-AR')}` : '—'}
                {totals?.hasSpecialSinTaccPrice && (
                  <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-black uppercase">especial</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Delivery */}
        {selectedEvent && selectedCompany && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">Horario Entrega (HH:MM)</label>
              <input type="time"
                className="w-full p-3 border border-slate-200 rounded-2xl bg-white outline-none font-bold text-indigo-600"
                value={deliveryTime}
                onChange={e => setDeliveryTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><MapPin size={10} /> Punto de Encuentro</label>
              <input className="w-full p-3 border border-slate-200 rounded-2xl bg-white outline-none"
                placeholder="Ej: Portón 4"
                value={deliveryPoint}
                onChange={e => setDeliveryPoint(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">Dirección / Referencia</label>
              <input className="w-full p-3 border border-slate-200 rounded-2xl bg-white outline-none"
                placeholder="Ej: Av. Figueroa Alcorta..."
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: UNITS */}
      {selectedEventId && selectedCompany && (
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          <div className="flex-1 space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Truck size={18} className="text-indigo-500" /> Unidades de Transporte
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {units.map((u) => {
                const validity = totals?.unitsValidity.find(v => v.id === u.id)
                // Filter dropdowns by Master selectedCompany
                const selectedClientName = selectedCompany.toLowerCase()
                const cRecord = clients.find((c: any) => c.name?.toLowerCase() === selectedClientName)
                const clientId = cRecord?.id
                const filteredVehicles = vehicles.filter((v: any) => v.client_id === clientId)
                const filteredCoordinators = coordinators.filter((c: any) => c.company?.toLowerCase() === selectedClientName)
                return (
                  <div key={u.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {/* Card Header */}
                    <div className={`p-5 flex justify-between items-center ${validity?.isValid ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${validity?.isValid ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                        <input
                          className="bg-transparent font-black text-slate-800 outline-none w-36"
                          value={u.name}
                          onChange={e => updateUnit(u.id, 'name', e.target.value)} />
                      </div>
                      <button onClick={() => removeUnit(u.id)} className="text-slate-400 hover:text-rose-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      
                      {/* Logística integrada */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Vehículo Físico</label>
                          <select
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-indigo-400 transition"
                            value={u.vehicle_id}
                            onChange={e => updateUnit(u.id, 'vehicle_id', e.target.value)}
                          >
                            <option value="">-- Seleccionar --</option>
                            {filteredVehicles.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.internal_name} {v.plate ? `(${v.plate})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Coordinador M.</label>
                          <select
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-indigo-400 transition"
                            value={u.coordinator_id}
                            onChange={e => updateUnit(u.id, 'coordinator_id', e.target.value)}
                          >
                            <option value="">-- Seleccionar --</option>
                            {filteredCoordinators.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Operatividad */}
                      <div className="grid grid-cols-2 gap-4 border-b pb-6">
                        {['sold', 'liberated'].map(field => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">{field === 'sold' ? 'Vendidos' : 'Liberados'}</label>
                            <input type="text" inputMode="numeric"
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-center font-black text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={(u as any)[field]}
                              onChange={e => updateUnit(u.id, field as any, parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                              onFocus={e => e.target.select()} />
                          </div>
                        ))}
                      </div>

                      {/* Categories */}
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        {[
                          { key: 'traditional', label: 'Tradicional' },
                          { key: 'vegetarian', label: 'Vegetariana' },
                          { key: 'vegana', label: 'Vegana' },
                          { key: 'sin_tacc', label: 'Sin TACC' },
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">{label}</label>
                            <input type="text" inputMode="numeric"
                              className="w-full p-2 border border-slate-200 rounded-xl text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={(u as any)[key]}
                              onChange={e => updateUnit(u.id, key as any, parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                              onFocus={e => e.target.select()} />
                          </div>
                        ))}
                      </div>

                      {/* Water & Specials */}
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Agua Sugerida{activeRule?.includes_water && " (V+L)"}</label>
                          <input type="text" inputMode="numeric"
                            className="w-20 p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center font-black text-indigo-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={u.water}
                            onChange={e => updateUnit(u.id, 'water', parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                            onFocus={e => e.target.select()} />
                        </div>

                        {/* Special Orders */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-indigo-600 border-b border-indigo-50 pb-2">
                            <label className="text-[10px] font-black uppercase">Pedidos Especiales</label>
                            <button onClick={() => updateUnit(u.id, 'details', [...u.details, { id: crypto.randomUUID(), category: 'traditional', qty: 0, obs: '' }])}
                              className="p-1 hover:bg-indigo-50 rounded-lg transition">
                              <Plus size={14} />
                            </button>
                          </div>

                          {u.details.map(det => (
                            <div key={det.id} className="grid grid-cols-12 items-center bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden divide-x divide-slate-100">
                              <select
                                className="col-span-3 bg-transparent text-[9px] font-black px-2 h-8 outline-none uppercase text-slate-400 appearance-none"
                                value={det.category}
                                onChange={e => updateUnit(u.id, 'details', u.details.map(d => d.id === det.id ? { ...d, category: e.target.value } : d))}>
                                <option value="traditional">TRAD.</option>
                                <option value="vegetarian">VEGIE</option>
                                <option value="vegana">VEGAN</option>
                                <option value="sin_tacc">ST</option>
                              </select>
                              <input type="text" inputMode="numeric"
                                className="col-span-2 bg-white text-center font-black text-indigo-600 text-xs h-8 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={det.qty || 0}
                                onChange={e => updateUnit(u.id, 'details', u.details.map(d => d.id === det.id ? { ...d, qty: parseInt(e.target.value.replace(/\D/g, '')) || 0 } : d))}
                                onFocus={e => e.target.select()} />
                              <input
                                placeholder="Sin Cebolla, Sin Mayo..."
                                className="col-span-6 bg-transparent text-[10px] px-3 h-8 outline-none text-slate-600 italic placeholder:text-slate-300"
                                value={det.obs}
                                onChange={e => updateUnit(u.id, 'details', u.details.map(d => d.id === det.id ? { ...d, obs: e.target.value } : d))} />
                              <button
                                onClick={() => updateUnit(u.id, 'details', u.details.filter(d => d.id !== det.id))}
                                className="col-span-1 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Observaciones Generales</label>
                            <textarea rows={1}
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none resize-none"
                              placeholder="Otras notas..."
                              value={u.observations}
                              onChange={e => updateUnit(u.id, 'observations', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {!validity?.isValid && (
                      <div className="bg-rose-500 text-white text-[10px] font-bold py-1 text-center">
                        ERROR: {(Number(u.traditional||0)+Number(u.vegetarian||0)+Number(u.vegana||0)+Number(u.sin_tacc||0))} categorías ≠ {(Number(u.sold||0)+Number(u.liberated||0))} producción
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add Unit Button */}
              <button onClick={addUnit}
                className="flex flex-col items-center justify-center gap-3 border-4 border-dashed border-slate-200 rounded-[2rem] p-8 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                <div className="p-4 bg-slate-100 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition shadow-sm">
                  <Plus size={32} />
                </div>
                <span className="font-black text-sm uppercase tracking-widest">Añadir Micro / Traffic</span>
              </button>
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
              {message && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-bold text-center ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                  {message.type === 'success' ? <CheckCircle2 className="inline mr-2" size={14} /> : <AlertCircle className="inline mr-2" size={14} />}
                  {message.text}
                </div>
              )}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total a Liquidar</p>
                    <p className="text-3xl font-black text-slate-800">${totals?.amount.toLocaleString("es-AR")}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-200 hidden md:block" />
                  <div>
                    <span className={`text-xs font-bold flex items-center gap-2 ${totals?.allValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {totals?.allValid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {totals?.allValid ? 'Datos Validados' : 'Error en Distribución'}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {totals?.allValid ? 'Listo para persistir' : 'Revisá que categorías = producción'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button onClick={handlePrint}
                    className="px-5 py-2.5 border border-slate-200 bg-white rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition flex items-center justify-center text-sm shadow-sm gap-2">
                    <Printer size={16} /> REMITO PDF
                  </button>
                  <button onClick={saveAll} disabled={!totals?.allValid || loading}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${totals?.allValid ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {loading ? 'GUARDANDO...' : 'CONFIRMAR Y GUARDAR'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[380px] flex flex-col gap-6 sticky top-24">
            <div className="bg-[#1e293b] text-white p-8 rounded-[3rem] shadow-2xl space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Calculator className="text-indigo-400" />
                <h2 className="text-xl font-bold">Liquidación Global</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Vendidos</p>
                  <p className="text-3xl font-black">{totals?.sold}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Liberados</p>
                  <p className="text-3xl font-black">{totals?.liberated}</p>
                </div>
              </div>

              {activeRule && (
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="text-white/60 font-bold uppercase text-[9px] tracking-widest">Detalle Sin TACC</span>
                    {totals?.hasSpecialSinTaccPrice && (
                      <span className="bg-purple-500/30 text-purple-300 text-[8px] font-black px-2 py-0.5 rounded uppercase">Precio especial</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Precio aplicado (c/u)</span>
                    <span className="font-bold text-white">${Number(totals?.price_sintacc_effective || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Cupo libre ({activeRule.sintacc_limit_pct}% de {projectedPax})</span>
                    <span className="font-bold text-emerald-400">{totals?.CupoGratis} un.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60 italic">Facturables / Excedentes</span>
                    <span className="font-bold text-rose-400">{totals?.SinTaccFacturables} / {totals?.SinTaccExcedentes} un.</span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 text-center">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Monto Total</p>
                <p className="text-6xl font-black tracking-tighter text-white">
                  ${totals?.amount.toLocaleString("es-AR")}
                </p>
              </div>
            </div>

            {/* Kitchen Summary */}
            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
              <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-200 pb-3">Resumen Cocina</h4>
              <div className="space-y-2">
                {[
                  { key: 'trad', label: 'Tradicional' },
                  { key: 'veg', label: 'Vegetariana' },
                  { key: 'vegan', label: 'Vegana' },
                  { key: 'st', label: 'Sin TACC' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-sm font-bold text-indigo-800">{label}</span>
                    <span className="text-2xl font-black text-indigo-950">{(totals as any)?.[key]}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-indigo-200 flex justify-between items-center">
                  <span className="text-xs font-black text-indigo-400">AGUA TOTAL</span>
                  <span className="text-2xl font-black text-indigo-600">{totals?.water}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!selectedEventId || !selectedCompany) && (
        <div className="text-center py-24 bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-200">
          <Truck className="mx-auto text-slate-200 mb-6" size={80} />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-2">Seleccioná un Evento y una Empresa</h3>
          <p className="text-slate-400">Una vez seleccionados, podrás cargar los micros y sus viandas.</p>
        </div>
      )}
    </div>
  )
}