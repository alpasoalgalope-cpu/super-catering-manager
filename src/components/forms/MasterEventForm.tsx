"use client"

import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Plus, Save, Music, Calendar, MapPin, Building2, Users,
  Loader2, CheckCircle2, AlertCircle, Trash2, ChevronDown,
  ChevronUp, Settings2, Search, X
} from "lucide-react"
import VenueModal from "@/components/forms/VenueModal"
import CompanyModal from "@/components/forms/CompanyModal"
import CoordinatorModal from "@/components/forms/CoordinatorModal"

// --- Types ---
interface Venue { id: string; name: string; address?: string; meeting_point?: string }
interface Coordinator { id: string; name: string; company: string; phone?: string }
interface ProjectionRow { id?: string; company_name: string; projected_pax: number }
interface EventMaster {
  id: string
  event_date: string
  show_name: string
  venue_id: string | null
  coordinator_id: string | null
  status: string
  venues?: { name: string }
  coordinators?: { name: string }
  event_projections?: ProjectionRow[]
}

// --- Main Component ---
export default function MasterEventForm() {
  const [events, setEvents] = useState<EventMaster[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // --- New Event Draft ---
  const emptyDraft = { event_date: "", show_name: "", venue_id: "", coordinator_id: "", status: "pendiente", projections: [{ company_name: "", projected_pax: 0 }] }
  const [draft, setDraft] = useState(emptyDraft)
  const [showAddForm, setShowAddForm] = useState(false)

  // --- Modals ---
  const [venueModal, setVenueModal] = useState(false)
  const [companyModal, setCompanyModal] = useState(false)
  const [coordModal, setCoordModal] = useState(false)
  // Context: which projection row triggered the modal
  const [modalContext, setModalContext] = useState<number | null>(null)

  // --- Local edits for existing events ---
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<EventMaster> & { projections?: ProjectionRow[] }>>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [evRes, venRes, coordRes, compRes] = await Promise.all([
      supabase.from("events_master")
        .select("*, venues(name), coordinators(name), event_projections(id, company_name, projected_pax)")
        .order("event_date", { ascending: true }),
      supabase.from("venues").select("*").order("name"),
      supabase.from("coordinators").select("id, name, company, phone").order("name"),
      supabase.from("commercial_rules").select("company_name").order("company_name"),
    ])
    setEvents(evRes.data || [])
    setVenues(venRes.data || [])
    setCoordinators(coordRes.data || [])
    setCompanies((compRes.data || []).map((r: any) => r.company_name))
    setLocalEdits({})
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // --- New Event: Draft Handlers ---
  const updateDraftProjection = (idx: number, field: 'company_name' | 'projected_pax', value: any) => {
    setDraft(prev => {
      const updated = [...prev.projections]
      updated[idx] = { ...updated[idx], [field]: value }
      return { ...prev, projections: updated }
    })
  }

  const addDraftProjection = () =>
    setDraft(prev => ({ ...prev, projections: [...prev.projections, { company_name: "", projected_pax: 0 }] }))

  const removeDraftProjection = (idx: number) =>
    setDraft(prev => ({ ...prev, projections: prev.projections.filter((_, i) => i !== idx) }))

  const saveNewEvent = async () => {
    if (!draft.event_date || !draft.show_name) {
      setMessage({ type: 'error', text: "Fecha y Artista/Show son obligatorios." })
      return
    }
    setSaving("new")
    setMessage(null)
    try {
      const { data: evData, error: evErr } = await supabase
        .from("events_master")
        .insert([{
          event_date: draft.event_date,
          show_name: draft.show_name,
          venue_id: draft.venue_id || null,
          coordinator_id: draft.coordinator_id || null,
          status: draft.status,
        }])
        .select()
        .single()

      if (evErr) throw evErr

      const validProj = draft.projections.filter(p => p.company_name.trim() !== "")
      if (validProj.length > 0) {
        const { error: projErr } = await supabase.from("event_projections").insert(
          validProj.map(p => ({ event_id: evData.id, company_name: p.company_name, projected_pax: p.projected_pax }))
        )
        if (projErr) throw projErr
      }

      setMessage({ type: 'success', text: `¡Evento "${draft.show_name}" creado con éxito!` })
      setDraft(emptyDraft)
      setShowAddForm(false)
      fetchAll()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(null)
    }
  }

  // --- Existing Event: Edit Handlers ---
  // Key fix: local edits overlay on top of the base event, but projections come from
  // localEdits *first* (if the user modified them), otherwise from event_projections.
  const getEditState = (ev: EventMaster) => {
    const edit = localEdits[ev.id] || {}
    return {
      ...ev,
      ...edit,
      // Only override projections if the user has touched them in this session
      projections: edit.projections !== undefined ? edit.projections : (ev.event_projections || []),
    }
  }

  const updateEdit = (id: string, field: string, value: any) => {
    setLocalEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }

  const updateEditProjection = (eventId: string, idx: number, field: 'company_name' | 'projected_pax', value: any) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      const updated = [...currentProjs]
      updated[idx] = { ...updated[idx], [field]: value }
      return { ...prev, [eventId]: { ...current, projections: updated } }
    })
  }

  const addEditProjection = (eventId: string) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      return { ...prev, [eventId]: { ...current, projections: [...currentProjs, { company_name: "", projected_pax: 0 }] } }
    })
  }

  const removeEditProjection = (eventId: string, idx: number) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      return { ...prev, [eventId]: { ...current, projections: currentProjs.filter((_, i) => i !== idx) } }
    })
  }

  const saveEventEdits = async (ev: EventMaster) => {
    const edits = localEdits[ev.id]
    if (!edits) return
    setSaving(ev.id)
    setMessage(null)
    try {
      const { event_master_id, projections, event_projections, venues: _v, coordinators: _c, ...restEdits } = edits as any
      if (Object.keys(restEdits).length > 0) {
        const { error } = await supabase.from("events_master").update(restEdits).eq("id", ev.id)
        if (error) throw error
      }

      let savedProjections: ProjectionRow[] = ev.event_projections || []
      if (projections) {
        const results: ProjectionRow[] = []
        for (const proj of projections) {
          if (!proj.company_name.trim()) continue
          if (proj.id) {
            await supabase.from("event_projections").update({ projected_pax: proj.projected_pax }).eq("id", proj.id)
            results.push(proj)
          } else {
            const { data: newProj } = await supabase
              .from("event_projections")
              .upsert({ event_id: ev.id, company_name: proj.company_name, projected_pax: proj.projected_pax }, { onConflict: 'event_id,company_name' })
              .select()
              .single()
            if (newProj) results.push(newProj as ProjectionRow)
            else results.push(proj)
          }
        }
        // Delete projections not in the list anymore
        const keepIds = projections.filter((p: any) => p.id).map((p: any) => p.id)
        const originalIds = (ev.event_projections || []).map((p: any) => p.id)
        const toDelete = originalIds.filter((id: string) => !keepIds.includes(id))
        for (const id of toDelete) {
          await supabase.from("event_projections").delete().eq("id", id)
        }
        savedProjections = results
      }

      // Update local events state immediately (no full re-fetch needed)
      setEvents(prev => prev.map(e => {
        if (e.id !== ev.id) return e
        return {
          ...e,
          ...restEdits,
          event_projections: savedProjections,
          // Update nested venue/coordinator names if changed
          venues: edits.venue_id !== undefined
            ? venues.find(v => v.id === (edits.venue_id || e.venue_id)) ? { name: venues.find(v => v.id === edits.venue_id)?.name || e.venues?.name || '' } : e.venues
            : e.venues,
        }
      }))
      // Clear only the edits for this event
      setLocalEdits(prev => { const next = { ...prev }; delete next[ev.id]; return next })
      setMessage({ type: 'success', text: "¡Cambios guardados!" })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(null)
    }
  }

  // --- Modal Success Callbacks (don't reset main form) ---
  const onVenueCreated = (venue: Venue) => {
    setVenues(prev => [...prev, venue])
    if (modalContext === -1) {
      setDraft(prev => ({ ...prev, venue_id: venue.id }))
    } else if (modalContext !== null) {
      setLocalEdits(prev => ({ ...prev, [modalContext.toString()]: { ...(prev[modalContext.toString()] || {}), venue_id: venue.id } }))
    }
  }

  const onCompanyCreated = (name: string) => {
    setCompanies(prev => [...prev, name].sort())
    if (modalContext === -1) {
      setDraft(prev => ({
        ...prev,
        projections: prev.projections.length > 0
          ? prev.projections.map((p, i) => i === prev.projections.length - 1 ? { ...p, company_name: name } : p)
          : [{ company_name: name, projected_pax: 0 }]
      }))
    }
  }

  const onCoordCreated = (_id: string, name: string) => {
    // Refresh coordinators
    supabase.from("coordinators").select("id, name, company, phone").order("name").then(({ data }) => {
      setCoordinators(data || [])
      const newCoord = data?.find((c: any) => c.name === name)
      if (newCoord) {
        if (modalContext === -1) setDraft(prev => ({ ...prev, coordinator_id: newCoord.id }))
      }
    })
  }

  // --- Filter ---
  const filteredEvents = events.filter(e =>
    e.show_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.venues?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={40} />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 pb-24">

      {/* HEADER */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Settings2 size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">Gestión Operativa</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Eventos Maestros</h1>
          <p className="text-sm text-slate-500 mt-1">Cada evento es único por Fecha + Artista + Venue. Múltiples empresas por evento.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg ${showAddForm ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
        >
          {showAddForm ? <X size={18} /> : <Plus size={18} />}
          {showAddForm ? 'Cancelar' : 'Nuevo Evento'}
        </button>
      </div>

      {/* MESSAGE */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* NEW EVENT FORM */}
      {showAddForm && (
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] p-8 border-2 border-indigo-200 shadow-lg space-y-6">
          <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2"><Plus size={20} /> Registrar Nuevo Evento</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Calendar size={10} /> Fecha *</label>
              <input type="date" className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition font-bold"
                value={draft.event_date} onChange={e => setDraft({ ...draft, event_date: e.target.value })} />
            </div>

            {/* Artist */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Music size={10} /> Artista / Show *</label>
              <input className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition"
                placeholder="Ej: Metallica, La Renga..." value={draft.show_name}
                onChange={e => setDraft({ ...draft, show_name: e.target.value })} />
            </div>

            {/* Venue */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><MapPin size={10} /> Venue</label>
              <div className="flex gap-2">
                <select className="flex-1 p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition appearance-none bg-white"
                  value={draft.venue_id} onChange={e => setDraft({ ...draft, venue_id: e.target.value })}>
                  <option value="">-- Sin Venue --</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button type="button" onClick={() => { setModalContext(-1); setVenueModal(true) }}
                  className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-200 transition font-black">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Coordinator */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Users size={10} /> Coordinador</label>
              <div className="flex gap-2">
                <select className="flex-1 p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition appearance-none bg-white"
                  value={draft.coordinator_id} onChange={e => setDraft({ ...draft, coordinator_id: e.target.value })}>
                  <option value="">-- Sin Coordinador --</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => { setModalContext(-1); setCoordModal(true) }}
                  className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition font-black">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">Estado</label>
              <select className="w-full p-3 border border-slate-200 rounded-2xl outline-none appearance-none bg-white text-slate-700 font-bold"
                value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                <option value="pendiente">Pendiente</option>
                <option value="confirmado">Confirmado</option>
                <option value="ejecutado">Ejecutado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Companies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-700 flex items-center gap-2"><Building2 size={14} /> Empresas Asociadas</label>
              <button type="button" onClick={addDraftProjection}
                className="flex items-center gap-1 text-indigo-600 font-bold text-xs hover:underline">
                <Plus size={12} /> Agregar empresa
              </button>
            </div>

            {draft.projections.map((proj, idx) => (
              <div key={idx} className="flex gap-3 items-center bg-white rounded-2xl p-3 border border-slate-200">
                <div className="flex gap-2 flex-1">
                  <select className="flex-1 p-2 border border-slate-200 rounded-xl text-sm outline-none appearance-none"
                    value={proj.company_name} onChange={e => updateDraftProjection(idx, 'company_name', e.target.value)}>
                    <option value="">-- Empresa --</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" onClick={() => { setModalContext(-1); setCompanyModal(true) }}
                    className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Users size={14} className="text-slate-400 shrink-0" />
                  <input type="text" inputMode="numeric"
                    className="w-full p-2 border border-slate-200 rounded-xl text-center font-black text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={proj.projected_pax}
                    onChange={e => updateDraftProjection(idx, 'projected_pax', parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                    onFocus={e => e.target.select()} />
                </div>
                <button onClick={() => removeDraftProjection(idx)} className="text-slate-300 hover:text-rose-500 transition">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-indigo-100">
            <button onClick={() => { setShowAddForm(false); setDraft(emptyDraft) }}
              className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">
              Descartar
            </button>
            <button onClick={saveNewEvent} disabled={saving === "new"}
              className="px-10 py-3 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-500 transition shadow-lg flex items-center gap-2 disabled:opacity-50">
              {saving === "new" ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Crear Evento
            </button>
          </div>
        </div>
      )}

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition"
          placeholder="Buscar por artista o venue..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* EVENT LIST */}
      <div className="space-y-3">
        {filteredEvents.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest">No hay eventos registrados aún</p>
          </div>
        )}

        {filteredEvents.map(ev => {
          const state = getEditState(ev)
          const isDirty = !!localEdits[ev.id]
          const isExpanded = expandedId === ev.id
          const totalPax = (state.projections || []).reduce((a: number, p: ProjectionRow) => a + (p.projected_pax || 0), 0)

          return (
            <div key={ev.id} className={`bg-white rounded-2xl border transition-all ${isDirty ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-100'} shadow-sm`}>
              {/* Event Row */}
              <div className="p-5 flex flex-col lg:flex-row items-start lg:items-center gap-4">

                {/* Date */}
                <div className="w-32 shrink-0">
                  <label className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">Fecha</label>
                  <input type="date" className="w-full text-sm font-black bg-transparent outline-none text-slate-900"
                    value={state.event_date?.split('T')[0] || ''}
                    onChange={e => updateEdit(ev.id, 'event_date', e.target.value)} />
                </div>

                {/* Artist */}
                <div className="flex-1 min-w-0">
                  <label className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">Artista / Show</label>
                  <input className="w-full text-base font-black text-slate-800 bg-transparent outline-none focus:text-indigo-600 border-b border-transparent focus:border-indigo-200 transition truncate"
                    value={state.show_name || ''}
                    onChange={e => updateEdit(ev.id, 'show_name', e.target.value)} />
                </div>

                {/* Venue */}
                <div className="w-44">
                  <label className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">Venue</label>
                  <select className="w-full text-xs font-bold bg-transparent outline-none appearance-none text-slate-600"
                    value={state.venue_id || ''}
                    onChange={e => updateEdit(ev.id, 'venue_id', e.target.value)}>
                    <option value="">Sin Venue</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>

                {/* PAX Badge */}
                <div className="flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full">
                  <Users size={12} className="text-indigo-500" />
                  <span className="text-xs font-black text-indigo-700">{totalPax} PAX</span>
                </div>

                {/* Status Badge — Restricción: Sin azul/amarillo */}
                {(() => {
                  const s = (state.status || 'pendiente').toLowerCase()
                  const cls = s.includes('ejecut')
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : s === 'cancelado'
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : s === 'confirmado'
                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                  return (
                    <select
                      className={`text-xs font-black px-3 py-1.5 rounded-full outline-none appearance-none border transition-colors ${cls}`}
                      value={state.status || 'pendiente'}
                      onChange={e => updateEdit(ev.id, 'status', e.target.value)}>
                      <option value="pendiente">Pendiente</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="ejecutado">Ejecutado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  )
                })()}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {isDirty && (
                    <button onClick={() => saveEventEdits(ev)} disabled={saving === ev.id}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-500 transition flex items-center gap-1 disabled:opacity-50">
                      {saving === ev.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Guardar
                    </button>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Expanded: Companies */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50/60 rounded-b-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Building2 size={12} /> Empresas y PAX
                    </span>
                    <button onClick={() => addEditProjection(ev.id)}
                      className="text-indigo-600 text-xs font-black flex items-center gap-1 hover:underline">
                      <Plus size={12} /> Agregar empresa
                    </button>
                  </div>

                  {(state.projections || []).map((proj: ProjectionRow, idx: number) => (
                    <div key={idx} className="flex gap-3 items-center bg-white rounded-xl p-3 border border-slate-200">
                      <div className="flex gap-2 flex-1">
                        <select className="flex-1 p-2 border border-slate-200 rounded-lg text-sm outline-none appearance-none"
                          value={proj.company_name}
                          onChange={e => updateEditProjection(ev.id, idx, 'company_name', e.target.value)}>
                          <option value="">-- Empresa --</option>
                          {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => { setModalContext(null); setCompanyModal(true) }}
                          className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition">
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 w-28">
                        <Users size={12} className="text-slate-400 shrink-0" />
                        <input type="text" inputMode="numeric"
                          className="w-full p-2 border border-slate-200 rounded-lg text-center font-black text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={proj.projected_pax}
                          onChange={e => updateEditProjection(ev.id, idx, 'projected_pax', parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                          onFocus={e => e.target.select()} />
                      </div>
                      <button onClick={() => removeEditProjection(ev.id, idx)} className="text-slate-300 hover:text-rose-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* MODALS */}
      <VenueModal isOpen={venueModal} onClose={() => setVenueModal(false)} onSuccess={onVenueCreated} />
      <CompanyModal isOpen={companyModal} onClose={() => setCompanyModal(false)} onSuccess={onCompanyCreated} />
      <CoordinatorModal isOpen={coordModal} onClose={() => setCoordModal(false)} onSuccess={onCoordCreated} />
    </div>
  )
}
