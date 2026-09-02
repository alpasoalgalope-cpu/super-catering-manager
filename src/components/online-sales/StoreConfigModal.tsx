"use client"

import React, { useState, useMemo } from 'react'
import { X, Plus, Trash2, Save, Loader2, AlertCircle, Building2, Calendar, Sparkles, Check, DollarSign } from 'lucide-react'
import { createStoreEventAction } from '@/app/actions/online-sales'

interface Props {
  events: any[]
  rules?: any[]
  existingStores?: any[]
  onClose: () => void
  onCreated: () => void
}

export default function StoreConfigModal({ events, rules = [], existingStores = [], onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')

  const [formData, setFormData] = useState({
    event_master_id: '',
    slug: '',
    title: '',
    subtitle: '',
    description: 'Viandas oficiales para el regreso del evento. Reservá tu combo directamente con confirmación inmediata.',
    banner_image_url: '',
    sales_deadline: '',
    available_dates: [] as string[],
    
    // Combos
    combo_trad_enabled: true,
    combo_trad_price: 12000,
    combo_trad_name: 'Combo Tradicional + Agua sin Gas',
    combo_trad_desc: 'Sándwich Gigante de Jamón y Queso en pan Ciabatta de manteca fresco del día + Agua Mineral.',
    
    combo_veg_enabled: true,
    combo_veg_price: 12000,
    combo_veg_name: 'Combo Vegetariano + Agua sin Gas',
    combo_veg_desc: 'Sándwich en Ciabatta de Manteca de Queso, Huevo, Lechuga y Tomate + Agua Mineral.',
    
    combo_sintacc_enabled: true,
    combo_sintacc_price: 15000,
    combo_sintacc_name: 'Combo Sin TACC + Agua sin Gas',
    combo_sintacc_desc: 'Árabe de Jamón y Queso envasado al vacío (Apto Celíacos) + Agua Mineral.',
    
    combo_vegan_enabled: true,
    combo_vegan_price: 12000,
    combo_vegan_name: 'Combo Vegano + Agua sin Gas',
    combo_vegan_desc: 'Sándwich Vegano en Pan de Semillas con Vegetales Salteados + Agua Mineral.'
  })

  const [dateInput, setDateInput] = useState('')

  // Sorted events closest to furthest in the future
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = a.event_date || '9999-12-31'
      const dateB = b.event_date || '9999-12-31'
      return dateA.localeCompare(dateB)
    })
  }, [events])

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null
  }, [events, selectedEventId])

  // Extract companies (projections) for the selected event
  const eventCompanies = useMemo(() => {
    if (!selectedEvent) return []
    const projs = selectedEvent.event_projections || []
    return projs.map((p: any) => p.company_name).filter(Boolean)
  }, [selectedEvent])

  const slugify = (text: string) => {
    return (text || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
  }

  // When an event is picked, update dates and reset company
  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId)
    setSelectedCompany('')
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    const eventDate = ev.event_date
    const venueName = ev.venues?.name || ''
    const showName = ev.show_name || 'Evento'

    setFormData(prev => ({
      ...prev,
      event_master_id: eventId,
      title: showName,
      slug: slugify(`${showName}-${eventDate}`),
      subtitle: venueName ? `Viaje al evento ${showName} @ ${venueName}` : 'Cena de Regreso',
      available_dates: eventDate ? [eventDate] : []
    }))
  }

  // When a company is picked, auto-fill all details & pricing rules
  const handleSelectCompany = (companyName: string) => {
    setSelectedCompany(companyName)
    if (!selectedEvent) return

    const showName = selectedEvent.show_name || 'Evento'
    const eventDate = selectedEvent.event_date
    const venueName = selectedEvent.venues?.name || ''

    // Look up commercial rule for this company
    const rule = (rules || []).find(r => 
      r.company_name && companyName && r.company_name.toLowerCase().trim() === companyName.toLowerCase().trim()
    )

    const basePrice = rule?.price_base ? Number(rule.price_base) : (companyName.toLowerCase().includes('valbus') ? 8500 : 12000)
    const stPrice = rule?.price_sintacc_base ? Number(rule.price_sintacc_base) : (companyName.toLowerCase().includes('valbus') ? 10000 : 15000)

    const cleanSlug = `${slugify(showName)}-${slugify(companyName)}-${eventDate}`

    setFormData(prev => ({
      ...prev,
      title: `${showName} — ${companyName}`,
      slug: cleanSlug,
      subtitle: venueName ? `Viaje al evento ${showName} @ ${venueName}` : 'Cena de Regreso',
      available_dates: eventDate ? [eventDate] : [],
      combo_trad_price: basePrice,
      combo_veg_price: basePrice,
      combo_vegan_price: basePrice,
      combo_sintacc_price: stPrice,
      combo_trad_enabled: true,
      combo_veg_enabled: true,
      combo_vegan_enabled: true,
      combo_sintacc_enabled: true
    }))
  }

  const handleAddDate = () => {
    if (dateInput && !formData.available_dates.includes(dateInput)) {
      setFormData(prev => ({
        ...prev,
        available_dates: [...prev.available_dates, dateInput].sort()
      }))
      setDateInput('')
    }
  }

  const handleRemoveDate = (date: string) => {
    setFormData(prev => ({
      ...prev,
      available_dates: prev.available_dates.filter(d => d !== date)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.event_master_id) return setError("Selecciona un evento.")
    if (!formData.slug) return setError("El slug es obligatorio.")
    if (!formData.title) return setError("El título es obligatorio.")
    if (formData.available_dates.length === 0) return setError("Agrega al menos una fecha de viaje.")
    if (formData.combo_trad_enabled && formData.combo_trad_price <= 0) return setError("El precio del combo tradicional debe ser mayor a 0.")

    setLoading(true)

    try {
      const payload: any = {
        event_master_id: formData.event_master_id,
        slug: formData.slug,
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        description: formData.description || undefined,
        banner_image_url: formData.banner_image_url || undefined,
        sales_deadline: formData.sales_deadline ? new Date(formData.sales_deadline).toISOString() : undefined,
        available_dates: formData.available_dates,
        combo_trad_enabled: formData.combo_trad_enabled,
        combo_trad_price: formData.combo_trad_price,
        combo_trad_name: formData.combo_trad_name,
        combo_trad_desc: formData.combo_trad_desc,
        combo_veg_enabled: formData.combo_veg_enabled,
        combo_veg_price: formData.combo_veg_price,
        combo_veg_name: formData.combo_veg_name,
        combo_veg_desc: formData.combo_veg_desc,
        combo_sintacc_enabled: formData.combo_sintacc_enabled,
        combo_sintacc_price: formData.combo_sintacc_price,
        combo_sintacc_name: formData.combo_sintacc_name,
        combo_sintacc_desc: formData.combo_sintacc_desc,
        combo_vegan_enabled: formData.combo_vegan_enabled,
        combo_vegan_price: formData.combo_vegan_price,
        combo_vegan_name: formData.combo_vegan_name,
        combo_vegan_desc: formData.combo_vegan_desc,
        is_active: true
      }

      const result = await createStoreEventAction(payload)

      if (!result.success) {
        throw new Error(result.error || "Error al crear la tienda")
      }

      onCreated()
    } catch (err: any) {
      console.error("Error creating store:", err)
      setError(err.message || "Error al crear la tienda")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-4 sm:p-6 md:p-10">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              Nueva Tienda Online
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Configura y activa una tienda oficial para venta directa a pasajeros
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* STEP 1: EVENT & COMPANY SELECTOR */}
          <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 space-y-5">
            <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
              Evento y Empresa de Traslado
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Event Select (Sorted by date from nearest to furthest) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Evento Base (Ordenado por Fecha Próxima) *
                </label>
                <select 
                  value={selectedEventId}
                  onChange={(e) => handleSelectEvent(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">Seleccionar evento...</option>
                  {sortedEvents.map(e => {
                    const dateStr = e.event_date ? new Date(e.event_date + 'T12:00:00').toLocaleDateString('es-AR') : 'Sin fecha'
                    const venue = e.venues?.name ? ` (${e.venues.name})` : ''
                    return (
                      <option key={e.id} value={e.id}>
                        {dateStr} — {e.show_name}{venue}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Título de la Tienda *
                </label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Arcangel — RV Traslados"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Company Pills for selected event */}
            {selectedEvent && (
              <div className="pt-2 border-t border-slate-200/60">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  Empresas cargadas para este show (Hacé clic para auto-configurar):
                </label>
                {eventCompanies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {eventCompanies.map((comp: string) => {
                      const isSelected = selectedCompany.toLowerCase().trim() === comp.toLowerCase().trim()
                      const expectedSlug = `${slugify(selectedEvent.show_name)}-${slugify(comp)}-${selectedEvent.event_date}`
                      const alreadyHasStore = existingStores.some(s => s.slug === expectedSlug)

                      return (
                        <button
                          key={comp}
                          type="button"
                          onClick={() => handleSelectCompany(comp)}
                          className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer border ${
                            isSelected 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]' 
                              : alreadyHasStore
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-indigo-500'}`} />
                          <span>{comp}</span>
                          {alreadyHasStore && !isSelected && (
                            <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded-md font-bold">Ya existe</span>
                          )}
                          {isSelected && <Check className="w-4 h-4 ml-1" />}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No hay empresas asignadas en proyecciones para este evento.</p>
                )}
              </div>
            )}

            {/* Slug & Subtitle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Slug (URL de la Tienda) *
                </label>
                <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="text-slate-400 text-xs font-semibold select-none">/tienda/</span>
                  <input 
                    type="text" 
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
                    placeholder="evento-empresa-fecha"
                    className="w-full text-sm font-semibold text-slate-800 focus:outline-none bg-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Subtítulo / Venue (Opcional)
                </label>
                <input 
                  type="text" 
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Viaje al evento @ Movistar Arena"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* STEP 2: DATES */}
          <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
              Fechas de Viaje Disponibles
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {formData.available_dates.map(date => (
                <span key={date} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl font-bold text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                  {date}
                  <button type="button" onClick={() => handleRemoveDate(date)} className="text-indigo-400 hover:text-rose-500 ml-1 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1.5">
                <input 
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
                <button 
                  type="button" 
                  onClick={handleAddDate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* STEP 3: COMBOS & PRICING */}
          <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-xs">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">3</span>
                Menú y Precios Oficiales (Reglas Comerciales)
              </div>
              {selectedCompany && (
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                  Precios vinculados a {selectedCompany}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Tradicional */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm uppercase italic text-slate-800 flex items-center gap-1.5">
                    🥪 Combo Tradicional
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.combo_trad_enabled} 
                      onChange={(e) => setFormData({ ...formData, combo_trad_enabled: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    value={formData.combo_trad_price}
                    onChange={(e) => setFormData({ ...formData, combo_trad_price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 focus:outline-none"
                    placeholder="Precio"
                  />
                </div>
              </div>

              {/* Vegetariano */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm uppercase italic text-slate-800 flex items-center gap-1.5">
                    🥗 Combo Vegetariano
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.combo_veg_enabled} 
                      onChange={(e) => setFormData({ ...formData, combo_veg_enabled: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    value={formData.combo_veg_price}
                    onChange={(e) => setFormData({ ...formData, combo_veg_price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 focus:outline-none"
                    placeholder="Precio"
                  />
                </div>
              </div>

              {/* Sin TACC */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm uppercase italic text-slate-800 flex items-center gap-1.5">
                    🌾 Combo Sin TACC
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.combo_sintacc_enabled} 
                      onChange={(e) => setFormData({ ...formData, combo_sintacc_enabled: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    value={formData.combo_sintacc_price}
                    onChange={(e) => setFormData({ ...formData, combo_sintacc_price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 focus:outline-none"
                    placeholder="Precio"
                  />
                </div>
              </div>

              {/* Vegano */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm uppercase italic text-slate-800 flex items-center gap-1.5">
                    🌱 Combo Vegano
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.combo_vegan_enabled} 
                      onChange={(e) => setFormData({ ...formData, combo_vegan_enabled: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    value={formData.combo_vegan_price}
                    onChange={(e) => setFormData({ ...formData, combo_vegan_price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 focus:outline-none"
                    placeholder="Precio"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando Tienda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>🚀 Crear y Activar Tienda</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
