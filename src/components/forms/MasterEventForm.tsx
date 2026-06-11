"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import {
  Plus, Save, Music, Calendar, MapPin, Building2, Users,
  Loader2, CheckCircle2, AlertCircle, Trash2, ChevronDown,
  ChevronUp, Settings2, Search, X, Truck, DollarSign
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import VenueModal from "@/components/forms/VenueModal"
import CompanyModal from "@/components/forms/CompanyModal"
import CoordinatorModal from "@/components/forms/CoordinatorModal"
import FleetModal from "@/components/forms/FleetModal"
import { updateEventMasterAction } from "@/app/actions/events"
import { getEventProfitability } from "@/app/actions/events"

// --- Helper Component ---
function EventProfitabilityBadge({ eventId, status, refreshKey }: { eventId: string, status?: string, refreshKey?: number }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getEventProfitability(eventId).then(res => {
      if (res.success) setData(res.data)
      setLoading(false)
    })
  }, [eventId, refreshKey])

  if (loading) return <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1"><Loader2 size={12} className="animate-spin" /> Calculando...</div>
  if (!data) return null

  const format = (num: number) => "$" + num.toLocaleString('es-AR')
  const rentabilidad = data.rentabilidad || 0
  const pct = data.facturacion > 0 ? (rentabilidad / data.facturacion) * 100 : 0
  const isPos = rentabilidad > 0
  const isNeg = rentabilidad < 0

  return (
    <div className="flex flex-col gap-1 mt-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
      <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest gap-2">
        <span>Venta Real: {data.totalUnidades || 0} U.</span>
        <span title="Incluye IVA y Bebidas">Esc. (C/IVA): {format(data.escandallo)}</span>
      </div>
      <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest gap-2">
         <span>Fact: {format(data.facturacion)}</span>
         <div className="flex gap-2 text-[8px]">
            {data.logistics_cost > 0 && <span>Log: {format(data.logistics_cost)}</span>}
            {data.extras_cost > 0 && <span className="text-amber-600">Ext: {format(data.extras_cost)}</span>}
            {data.commissions_cost > 0 && <span className="text-rose-600">Com: {format(data.commissions_cost)}</span>}
         </div>
      </div>
      <div className={`text-xs font-black px-2 py-1 rounded-lg border flex items-center justify-between ${isPos ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isNeg ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        <span className="uppercase tracking-widest text-[9px] opacity-80">Rentabilidad Final</span>
        <span>{format(rentabilidad)} ({pct.toFixed(1)}%)</span>
      </div>
    </div>
  )
}

// --- Types ---
interface Venue { id: string; name: string; address?: string; meeting_point?: string }
interface Coordinator { id: string; name: string; company: string; phone?: string }
interface Vehicle { id: string; internal_name: string; plate?: string; client_id: string; vehicle_type?: string }
interface BusAssignment { 
  id?: string; 
  vehicle_id: string; 
  coordinator_id: string; 
  client_id?: string; 
  crew_count?: number;
  unit_name?: string;
  coordinator_name?: string;
  observations?: string;
}
interface ProjectionRow { id?: string; company_name: string; projected_pax: number; bus_assignments?: BusAssignment[] }
interface EventMaster {
  id: string
  event_date: string
  show_name: string
  venue_id: string | null
  coordinator_id: string | null
  status: string
  logistics_cost?: number
  extras_cost?: number
  commissions_cost?: number
  venues?: { name: string }
  coordinators?: { name: string }
  event_projections?: ProjectionRow[]
}

// --- Main Component ---
export default function MasterEventForm() {
  const searchParams = useSearchParams()
  const eventIdFromUrl = searchParams.get('eventId')

  const [events, setEvents] = useState<EventMaster[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [conversionMap, setConversionMap] = useState<Record<string, number>>({})
  const [clientIdMap, setClientIdMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [view, setView] = useState<"upcoming" | "past" | "all">("upcoming")
  const [companyFilter, setCompanyFilter] = useState("")
  const [venueFilter, setVenueFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const today = (() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()

  // --- New Event Draft ---
  interface DraftEvent {
    event_dates: string[];
    show_name: string;
    venue_id: string;
    coordinator_id: string;
    status: string;
    logistics_cost: number;
    extras_cost: number;
    commissions_cost: number;
    projections: ProjectionRow[];
  }
  const emptyDraft: DraftEvent = { 
    event_dates: [""], 
    show_name: "", 
    venue_id: "", 
    coordinator_id: "", 
    status: "pendiente", 
    logistics_cost: 0,
    extras_cost: 0,
    commissions_cost: 0,
    projections: [{ company_name: "", projected_pax: 0, bus_assignments: [] }] 
  }
  const [draft, setDraft] = useState<DraftEvent>(emptyDraft)
  const [showAddForm, setShowAddForm] = useState(false)

  // --- Modals ---
  const [venueModal, setVenueModal] = useState(false)
  const [companyModal, setCompanyModal] = useState(false)
  const [coordModal, setCoordModal] = useState(false)
  const [fleetModal, setFleetModal] = useState(false)
  // Context: which projection row triggered the modal
  const [modalContext, setModalContext] = useState<number | null>(null)

  // --- Local edits for existing events ---
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<EventMaster> & { projections?: ProjectionRow[] }>>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [evRes, venRes, coordRes, compRes, vehRes, busRes] = await Promise.all([
      supabase.from("events_master")
        .select("*, venues(name), coordinators(name), event_projections(id, company_name, projected_pax)")
        .order("event_date", { ascending: false }),
      supabase.from("venues").select("*").order("name"),
      supabase.from("coordinators").select("id, name, company, phone").order("name"),
      supabase.from("clients").select("id, name, conversion_factor").order("name"),
      supabase.from("vehicles").select("id, internal_name, plate, client_id, vehicle_type").order("internal_name"),
      supabase.from("event_bus_assignments").select("*")
    ])
    
    setVenues(venRes.data || [])
    setCoordinators(coordRes.data || [])
    setVehicles(vehRes.data || [])
    
    const cMap: Record<string, number> = {}
    const idMap: Record<string, string> = {}
    const cNames: string[] = []
    compRes.data?.forEach((r: any) => {
      cNames.push(r.name)
      cMap[r.name] = Number(r.conversion_factor) || 1.0
      idMap[r.name] = r.id
    })
    setCompanies(cNames)
    setConversionMap(cMap)
    setClientIdMap(idMap)

    const allBuses = busRes.data || []
    const processedEvents = (evRes.data || []).map((ev: any) => {
      const evBuses = allBuses.filter((b: any) => b.event_id === ev.id)
      const mappedProjections = (ev.event_projections || []).map((proj: any) => {
        const client_id = idMap[proj.company_name]
        const projBuses = evBuses.filter((b: any) => b.client_id === client_id).map((b: any) => ({
          id: b.id,
          vehicle_id: b.vehicle_id,
          coordinator_id: b.coordinator_id,
          client_id: b.client_id,
          crew_count: b.crew_count
        }))
        return { ...proj, bus_assignments: projBuses }
      })
      return { ...ev, event_projections: mappedProjections }
    })
    
    setEvents(processedEvents)
    if (processedEvents.length > 0) {
      if (eventIdFromUrl) {
        setExpandedIds(new Set([eventIdFromUrl]))
        const ev = processedEvents.find((e: any) => e.id === eventIdFromUrl)
        if (ev) {
          if (ev.event_date < today) {
            setView("all")
          }
          setSearchTerm(ev.show_name || "")
        }
      } else {
        // Auto-expand only the first 5 UPCOMING events (to match default view)
        const upcomingIds = processedEvents
          .filter(e => e.event_date >= today)
          .slice(0, 5)
          .map(e => e.id)
        setExpandedIds(new Set(upcomingIds))
      }
    }
    setLocalEdits({})
    setLoading(false)
  }, [eventIdFromUrl])

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
    setDraft(prev => ({ ...prev, projections: [...prev.projections, { company_name: "", projected_pax: 0, bus_assignments: [] }] }))

  const removeDraftProjection = (idx: number) =>
    setDraft(prev => ({ ...prev, projections: prev.projections.filter((_, i) => i !== idx) }))

  const addDraftBus = (projIdx: number) => {
    setDraft(prev => {
      const updated = [...prev.projections]
      const currentBuses = updated[projIdx].bus_assignments || []
      updated[projIdx] = { ...updated[projIdx], bus_assignments: [...currentBuses, { vehicle_id: "", coordinator_id: "" }] }
      return { ...prev, projections: updated }
    })
  }

  const updateDraftBus = (projIdx: number, busIdx: number, field: string, value: any) => {
    setDraft(prev => {
      const updated = [...prev.projections]
      const currentBuses = [...(updated[projIdx].bus_assignments || [])]
      let finalValue = value
      
      // Auto-fill crew count when vehicle changes
      if (field === 'vehicle_id') {
        const v = vehicles.find(veh => veh.id === value)
        let crewCount = 0
        if (v) {
          const type = (v.vehicle_type || '').toLowerCase()
          const name = (v.internal_name || '').toLowerCase()
          
          if (type === 'micro' || name.includes('bus') || name.includes('micro') || name.includes('coche')) {
            crewCount = 3
          } else if (type === 'trafic') {
            crewCount = 2
          } else if (name.includes('trafic') || name.includes('mini') || name.includes('combi')) {
            crewCount = 2
          }
        }
        currentBuses[busIdx] = { ...currentBuses[busIdx], vehicle_id: value, crew_count: crewCount }
      } else {
        currentBuses[busIdx] = { ...currentBuses[busIdx], [field]: value }
      }

      updated[projIdx] = { ...updated[projIdx], bus_assignments: currentBuses }
      return { ...prev, projections: updated }
    })
  }

  const removeDraftBus = (projIdx: number, busIdx: number) => {
    setDraft(prev => {
      const updated = [...prev.projections]
      const currentBuses = (updated[projIdx].bus_assignments || []).filter((_, i) => i !== busIdx)
      updated[projIdx] = { ...updated[projIdx], bus_assignments: currentBuses }
      return { ...prev, projections: updated }
    })
  }

  const saveNewEvent = async () => {
    const validDates = Array.from(new Set(draft.event_dates.filter(d => d.trim() !== "")))
    if (validDates.length === 0 || !draft.show_name) {
      setMessage({ type: 'error', text: "Debes ingresar al menos una fecha y el nombre del Artista/Show." })
      return
    }
    setSaving("new")
    setMessage(null)
    try {
      for (const date of validDates) {
        const { data: evData, error: evErr } = await supabase
          .from("events_master")
          .insert([{
            event_date: date,
            show_name: draft.show_name,
            venue_id: draft.venue_id || null,
            coordinator_id: draft.coordinator_id || null,
            status: draft.status,
            logistics_cost: draft.logistics_cost || 0,
            extras_cost: draft.extras_cost || 0,
            commissions_cost: draft.commissions_cost || 0,
          }])
          .select()
          .single()

        if (evErr) {
          if (evErr.code === '23505') {
            throw new Error(`Ya existe un evento registrado para "${draft.show_name}" en la fecha ${new Date(date).toLocaleDateString('es-AR')}. No se pueden duplicar eventos en la misma fecha y venue.`)
          }
          throw evErr
        }

        const validProj = draft.projections.filter(p => p.company_name.trim() !== "")
        if (validProj.length > 0) {
          const { error: projErr } = await supabase.from("event_projections").insert(
            validProj.map(p => ({ event_id: evData.id, company_name: p.company_name, projected_pax: p.projected_pax }))
          )
          if (projErr) throw projErr

          const busInserts: any[] = []
          validProj.forEach(p => {
            if (p.bus_assignments && p.bus_assignments.length > 0) {
              const cid = clientIdMap[p.company_name]
              if (cid) {
                p.bus_assignments.forEach(b => {
                  if (b.vehicle_id || b.coordinator_id) {
                     busInserts.push({
                        event_id: evData.id,
                        client_id: cid,
                        vehicle_id: b.vehicle_id || null,
                        coordinator_id: b.coordinator_id || null,
                        crew_count: b.crew_count || 0
                     })
                  }
                })
              }
            }
          })
          if (busInserts.length > 0) {
            const { error: busErr } = await supabase.from("event_bus_assignments").insert(busInserts)
            if (busErr) throw busErr
          }
        }
      }

      setMessage({ type: 'success', text: `¡${validDates.length} eventos para "${draft.show_name}" creados con éxito!` })
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
      return { ...prev, [eventId]: { ...current, projections: [...currentProjs, { company_name: "", projected_pax: 0, bus_assignments: [] }] } }
    })
  }

  const removeEditProjection = (eventId: string, idx: number) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      return { ...prev, [eventId]: { ...current, projections: currentProjs.filter((_, i) => i !== idx) } }
    })
  }

  const addEditBus = (eventId: string, projIdx: number) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      const updated = [...currentProjs]
      const currentBuses = updated[projIdx].bus_assignments || []
      updated[projIdx] = { ...updated[projIdx], bus_assignments: [...currentBuses, { vehicle_id: "", coordinator_id: "" }] }
      return { ...prev, [eventId]: { ...current, projections: updated } }
    })
  }

  const updateEditBus = (eventId: string, projIdx: number, busIdx: number, field: string, value: any) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      const updated = [...currentProjs]
      const currentBuses = [...(updated[projIdx].bus_assignments || [])]
      
      let finalBus = { ...currentBuses[busIdx], [field]: value }

      // Auto-fill crew count when vehicle changes
      if (field === 'vehicle_id') {
        const v = vehicles.find(veh => veh.id === value)
        if (v) {
          const type = (v.vehicle_type || '').toLowerCase()
          const name = (v.internal_name || '').toLowerCase()
          
          if (type === 'micro' || name.includes('bus') || name.includes('micro') || name.includes('coche')) {
            finalBus.crew_count = 3
          } else if (type === 'trafic') {
            finalBus.crew_count = 2
          } else if (name.includes('trafic') || name.includes('mini') || name.includes('combi')) {
            finalBus.crew_count = 2
          } else {
            finalBus.crew_count = 0
          }
        }
      }

      currentBuses[busIdx] = finalBus
      updated[projIdx] = { ...updated[projIdx], bus_assignments: currentBuses }
      return { ...prev, [eventId]: { ...current, projections: updated } }
    })
  }

  const removeEditBus = (eventId: string, projIdx: number, busIdx: number) => {
    setLocalEdits(prev => {
      const current = prev[eventId] || {}
      const currentProjs = current.projections ?? ((events.find(e => e.id === eventId)?.event_projections) || [])
      const updated = [...currentProjs]
      const currentBuses = (updated[projIdx].bus_assignments || []).filter((_, i) => i !== busIdx)
      updated[projIdx] = { ...updated[projIdx], bus_assignments: currentBuses }
      return { ...prev, [eventId]: { ...current, projections: updated } }
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
        const res = await updateEventMasterAction(ev.id, restEdits)
        if (!res.success) throw new Error(res.error)
      }

      let savedProjections: ProjectionRow[] = ev.event_projections || []
      if (projections) {
        const results: ProjectionRow[] = []
        const busInserts: any[] = []

        for (const proj of projections) {
          if (!proj.company_name.trim()) continue
          let finalProj = { ...proj }
          if (proj.id) {
            await supabase.from("event_projections").update({ projected_pax: proj.projected_pax }).eq("id", proj.id)
            results.push(finalProj)
          } else {
            const { data: newProj } = await supabase
              .from("event_projections")
              .upsert({ event_id: ev.id, company_name: proj.company_name, projected_pax: proj.projected_pax }, { onConflict: 'event_id,company_name' })
              .select()
              .single()
            if (newProj) {
              finalProj.id = newProj.id
              results.push(finalProj)
            } else {
              results.push(finalProj)
            }
          }

          const cid = clientIdMap[proj.company_name]
          if (cid && proj.bus_assignments && proj.bus_assignments.length > 0) {
            proj.bus_assignments.forEach((b: any) => {
              if (b.vehicle_id || b.coordinator_id) {
                busInserts.push({
                  event_id: ev.id,
                  client_id: cid,
                  vehicle_id: b.vehicle_id || null,
                  coordinator_id: b.coordinator_id || null,
                  crew_count: b.crew_count || 0
                })
              }
            })
          }
        }

        // Delete projections not in the list anymore
        const keepIds = projections.filter((p: any) => p.id).map((p: any) => p.id)
        const originalIds = (ev.event_projections || []).map((p: any) => p.id)
        const toDelete = originalIds.filter((id: string) => !keepIds.includes(id))
        for (const id of toDelete) {
          await supabase.from("event_projections").delete().eq("id", id)
        }

        // Overwrite all bus assignments for this event
        await supabase.from("event_bus_assignments").delete().eq("event_id", ev.id)
        if (busInserts.length > 0) {
          await supabase.from("event_bus_assignments").insert(busInserts)
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
      setRefreshCounter(prev => prev + 1)
      setMessage({ type: 'success', text: "¡Cambios guardados!" })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
      throw err // Re-throw for handleSaveAll to catch
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAll = async () => {
    const eventIds = Object.keys(localEdits)
    if (eventIds.length === 0) return
    
    setSaving("all")
    setMessage(null)
    
    let successCount = 0
    let failCount = 0
    
    try {
      for (const id of eventIds) {
        const ev = events.find(e => e.id === id)
        if (ev) {
          try {
            await saveEventEdits(ev)
            successCount++
          } catch (e) {
            failCount++
          }
        }
      }
      
      if (failCount === 0) {
        setMessage({ type: 'success', text: `¡Se guardaron todos los cambios con éxito (${successCount} eventos)!` })
      } else {
        setMessage({ type: 'error', text: `Se guardaron ${successCount} eventos, pero ${failCount} fallaron. Revisá los errores individuales.` })
      }
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este evento maestro? Esta acción eliminará también todas sus proyecciones y asignaciones de micros asociadas. No se puede deshacer.")) {
      return
    }

    setSaving(eventId)
    setMessage(null)
    try {
      // 1. Eliminar asignaciones de micros (por si no hay cascade)
      await supabase.from("event_bus_assignments").delete().eq("event_id", eventId)
      
      // 2. Eliminar proyecciones (tienen cascade, pero por seguridad)
      await supabase.from("event_projections").delete().eq("event_id", eventId)

      // 3. Eliminar el evento maestro
      const { error } = await supabase.from("events_master").delete().eq("id", eventId)
      
      if (error) throw error

      setEvents(prev => prev.filter(e => e.id !== eventId))
      setMessage({ type: 'success', text: "Evento eliminado correctamente." })
    } catch (err: any) {
      console.error("Error deleting event:", err)
      setMessage({ type: 'error', text: "Error al eliminar: " + err.message })
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
  const filteredEvents = events.filter(e => {
    // Search
    const searchMatch = !searchTerm || 
      e.show_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.venues?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    if (!searchMatch) return false

    // Tabs
    if (view === "upcoming" && e.event_date < today) return false
    if (view === "past" && e.event_date >= today) return false

    // Dropdowns
    if (venueFilter && e.venue_id !== venueFilter) return false
    if (statusFilter && e.status !== statusFilter) return false
    if (companyFilter) {
      const hasCompany = e.event_projections?.some(p => p.company_name === companyFilter)
      if (!hasCompany) return false
    }

    return true
  })

  const sortedFilteredEvents = [...filteredEvents].sort((a, b) => {
    if (view === "upcoming") {
       return a.event_date.localeCompare(b.event_date) // Hoy -> Fin de año (Asc)
    }
    // Pasados o Todos: Hoy -> Principios de año (Desc)
    return b.event_date.localeCompare(a.event_date)
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={40} />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50/50 -m-8 p-8 space-y-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-6">

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

      {/* TABS & SEARCH */}
      <div className="flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-max">
           <button onClick={() => setView("upcoming")} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${view === "upcoming" ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Próximos</button>
           <button onClick={() => setView("past")} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${view === "past" ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Pasados</button>
           <button onClick={() => setView("all")} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${view === "all" ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Todos</button>
        </div>

        <div className="relative flex-1 max-w-md">
           <input 
            type="text" 
            placeholder="Buscar por Artista o Venue..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-900 placeholder:text-slate-400"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
           />
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* DROPDOWN FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
         <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Building2 size={12}/> Empresa</label>
            <select value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)} className="w-full bg-white p-3.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-900 text-xs uppercase appearance-none cursor-pointer hover:border-slate-400 transition">
               <option value="">Todas las Empresas</option>
               {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
         </div>
         <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><MapPin size={12}/> Venue</label>
            <select value={venueFilter} onChange={e=>setVenueFilter(e.target.value)} className="w-full bg-white p-3.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-900 text-xs uppercase appearance-none cursor-pointer hover:border-slate-400 transition">
               <option value="">Todos los Venues</option>
               {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
         </div>
         <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Settings2 size={12}/> Estado</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full bg-white p-3.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-900 text-xs uppercase appearance-none cursor-pointer hover:border-slate-400 transition">
               <option value="">Cualquier Estado</option>
               <option value="pendiente">Pendiente</option>
               <option value="confirmado">Confirmado</option>
               <option value="ejecutado">Ejecutado</option>
               <option value="cancelado">Cancelado</option>
            </select>
         </div>
      </div>

      {/* NEW EVENT FORM */}
      {showAddForm && (
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] p-8 border-2 border-indigo-200 shadow-lg space-y-6">
          <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2"><Plus size={20} /> Registrar Nuevo Evento</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date(s) */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Calendar size={10} /> Fecha(s) del Evento *</label>
              <div className="space-y-2">
                {draft.event_dates.map((date, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="date" className="flex-1 p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition font-bold"
                      value={date} onChange={e => {
                        const newDates = [...draft.event_dates]
                        newDates[idx] = e.target.value
                        setDraft({ ...draft, event_dates: newDates })
                      }} />
                    {idx > 0 && (
                      <button type="button" onClick={() => setDraft({ ...draft, event_dates: draft.event_dates.filter((_, i) => i !== idx) })}
                        className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setDraft({ ...draft, event_dates: [...draft.event_dates, ""] })}
                  className="w-full py-2 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition uppercase tracking-widest">
                  + Agregar otra fecha
                </button>
              </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Logistics Cost Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Truck size={10} /> Gastos Logística ($)</label>
              <input type="number" className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition font-bold"
                placeholder="0" value={draft.logistics_cost || ''}
                onChange={e => setDraft({ ...draft, logistics_cost: Number(e.target.value) || 0 })} />
            </div>

            {/* Extras Cost Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Plus size={10} /> Gastos Extras / Mano de Obra ($)</label>
              <input type="number" className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 transition font-bold text-amber-700"
                placeholder="0" value={draft.extras_cost || ''}
                onChange={e => setDraft({ ...draft, extras_cost: Number(e.target.value) || 0 })} />
            </div>

            {/* Commissions Cost Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><DollarSign size={10} /> Comisiones (RV Traslados) ($)</label>
              <input type="number" className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-rose-400 transition font-bold text-rose-700"
                placeholder="Auto-calculado" value={draft.commissions_cost || ''}
                onChange={e => setDraft({ ...draft, commissions_cost: Number(e.target.value) || 0 })} />
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

            {draft.projections.map((proj, idx) => {
              const cid = clientIdMap[proj.company_name]
              const filteredVehicles = vehicles.filter(v => v.client_id === cid)
              const filteredCoordinators = coordinators.filter(c => c.company === proj.company_name)

              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="flex gap-3 items-center p-3">
                    <div className="flex gap-2 flex-1">
                      <select className="flex-1 p-2 border border-slate-200 rounded-xl text-sm outline-none appearance-none font-bold"
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

                  {/* Logistics Sub-form */}
                  {proj.company_name && (
                    <div className="bg-slate-50 border-t border-slate-100 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Truck size={12} /> Logística Planificada (Micros)
                        </label>
                        <button type="button" onClick={() => addDraftBus(idx)} className="text-indigo-600 text-[10px] font-black flex items-center gap-1 hover:underline">
                          <Plus size={10} /> Agregar Micro
                        </button>
                      </div>
                      
                      {(proj.bus_assignments || []).map((bus: any, bIdx: number) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <div className="flex-1 flex gap-1">
                            <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                              value={bus.vehicle_id} onChange={e => updateDraftBus(idx, bIdx, 'vehicle_id', e.target.value)}>
                              <option value="">-- Vehículo --</option>
                              {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.internal_name} {v.plate ? `(${v.plate})` : ''}</option>)}
                            </select>
                            <button type="button" onClick={() => setFleetModal(true)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition">
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="flex-1 flex gap-1">
                            <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                              value={bus.coordinator_id} onChange={e => updateDraftBus(idx, bIdx, 'coordinator_id', e.target.value)}>
                              <option value="">-- Coordinador --</option>
                              {filteredCoordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button type="button" onClick={() => setCoordModal(true)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition">
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="flex flex-col w-12">
                            <label className="text-[8px] font-black uppercase text-slate-400 text-center">Trip.</label>
                            <input type="text" inputMode="numeric"
                              className="w-full p-2 border border-slate-200 rounded-lg text-center font-black text-xs outline-none"
                              value={bus.crew_count || 0}
                              onChange={e => updateDraftBus(idx, bIdx, 'crew_count', parseInt(e.target.value.replace(/\D/g, '')) || 0)} />
                          </div>
                          <button onClick={() => removeDraftBus(idx, bIdx)} className="p-1 text-slate-300 hover:text-rose-500 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {(!proj.bus_assignments || proj.bus_assignments.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic">No hay logística planificada.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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

      {/* SEARCH (OLD - REMOVED IN FAVOR OF NEW FILTERS) */}

      {/* EVENT LIST */}
      <div className="space-y-3">
        {sortedFilteredEvents.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest">No hay eventos registrados aún</p>
          </div>
        )}

        {sortedFilteredEvents.map((ev, index) => {
          const state = getEditState(ev)
          const isDirty = !!localEdits[ev.id]
          const isExpanded = expandedIds.has(ev.id)
          const totalPax = (state.projections || []).reduce((a: number, p: ProjectionRow) => a + (p.projected_pax || 0), 0)
          
          const evDate = new Date(state.event_date + 'T12:00:00')
          const day = evDate.getDate()
          const month = evDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.','')

          return (
            <div key={ev.id} className={`bg-white rounded-3xl border shadow-sm transition-all hover:shadow-md ${isDirty ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200'} overflow-hidden`}>
              {/* Event Card Layout: [Date] -> [Artist/Venue] -> [PAX] -> [Status/Action] */}
              <div className="p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center gap-6">

                {/* 1. Date Block (Now Editable) */}
                <div className="flex flex-col items-center justify-center bg-slate-50 p-2 rounded-2xl border border-slate-100 shrink-0 min-w-[100px] hover:bg-white hover:border-indigo-200 transition-all group/date">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover/date:text-indigo-500">Fecha Evento</label>
                  <input 
                    type="date"
                    className="bg-transparent text-sm font-black text-slate-900 outline-none cursor-pointer text-center w-full"
                    value={state.event_date || ''}
                    onChange={e => updateEdit(ev.id, 'event_date', e.target.value)}
                  />
                </div>

                {/* 2. Artist & Venue */}
                <div className="flex-1 min-w-0 space-y-1">
                  <input className="w-full text-xl font-black text-slate-900 bg-transparent outline-none focus:text-indigo-600 transition truncate italic uppercase"
                    value={state.show_name || ''}
                    onChange={e => updateEdit(ev.id, 'show_name', e.target.value)} />
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400" />
                    <select className="flex-1 text-sm font-semibold text-slate-600 bg-transparent outline-none appearance-none cursor-pointer"
                      value={state.venue_id || ''}
                      onChange={e => updateEdit(ev.id, 'venue_id', e.target.value)}>
                      <option value="">Sin Venue</option>
                      {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* 3. PAX & Performance */}
                <div className="flex flex-col items-end gap-1 shrink-0 md:min-w-[120px]">
                  <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                    <Users size={14} className="text-indigo-600" />
                    <span className="text-sm font-black text-indigo-900 tabular-nums">{totalPax} PAX</span>
                  </div>
                  {(() => {
                    let adjusted = 0
                    state.projections?.forEach((p: any) => {
                       const factor = conversionMap[p.company_name] || 1.0
                       adjusted += (p.projected_pax || 0) * factor
                    })
                    return null
                  })()}
                  {state.event_date === today && (
                    <EventProfitabilityBadge eventId={ev.id} status={state.status} refreshKey={refreshCounter} />
                  )}
                </div>

                {/* 4. Status & Action */}
                <div className="flex flex-row md:flex-col items-center gap-3 shrink-0 md:min-w-[150px]">
                  {(() => {
                    const s = (state.status || 'pendiente').toLowerCase()
                    const cls = s === 'ejecutado'
                      ? 'bg-indigo-600 text-white font-bold border-indigo-700'
                      : s === 'cancelado'
                      ? 'bg-red-50 text-red-700 border-red-100'
                      : s === 'confirmado'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                    
                    return (
                      <div className="relative w-full">
                        <select
                          className={`w-full text-[10px] font-black px-4 py-2.5 rounded-xl outline-none appearance-none border transition-all text-center uppercase tracking-widest cursor-pointer ${cls}`}
                          value={state.status || 'pendiente'}
                          onChange={e => updateEdit(ev.id, 'status', e.target.value)}>
                          <option value="pendiente">Pendiente</option>
                          <option value="confirmado">Confirmado</option>
                          <option value="ejecutado">Ejecutado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>
                    )
                  })()}
                  
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <button onClick={() => saveEventEdits(ev)} disabled={saving === ev.id}
                        className="px-4 py-2 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition disabled:opacity-50 shadow-lg flex items-center gap-2">
                        {saving === ev.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span className="text-xs">Guardar</span>
                      </button>
                    )}
                    <button onClick={() => handleDeleteEvent(ev.id)} disabled={saving === ev.id}
                      className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition" title="Eliminar Evento">
                      {saving === ev.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={20} />}
                    </button>
                    <Link href={`/ventas-evento?eventId=${ev.id}`} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 transition shadow-sm flex items-center gap-2">
                       <DollarSign size={16} />
                       <span className="text-xs">Ventas</span>
                    </Link>
                    <Link href={`/inventario/trazabilidad?event_id=${ev.id}`} className="px-4 py-2 bg-emerald-50 text-emerald-600 font-black rounded-xl hover:bg-emerald-100 transition shadow-sm flex items-center gap-2">
                       <Truck size={16} />
                       <span className="text-xs">Consolidado</span>
                    </Link>
                    <button onClick={() => {
                      setExpandedIds(prev => {
                        const next = new Set(prev)
                        if (next.has(ev.id)) next.delete(ev.id)
                        else next.add(ev.id)
                        return next
                      })
                    }}
                      className={`p-2 rounded-xl transition ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Today Badge */}
              {state.event_date?.split('T')[0] === today && (
                <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm z-10">
                  ¡HOY!
                </div>
              )}

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
                  
                  <div className="flex items-center gap-4 mb-4">
                    {/* Logistics Cost Field */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-max">
                      <Truck size={14} className="text-indigo-500" />
                      <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Logística</label>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs font-bold">$</span>
                            <input 
                                type="number" 
                                className="w-24 bg-transparent outline-none font-black text-slate-700 text-sm"
                                value={state.logistics_cost || ''}
                                placeholder="0"
                                onChange={e => updateEdit(ev.id, 'logistics_cost', Number(e.target.value) || 0)}
                            />
                          </div>
                      </div>
                    </div>

                    {/* Extras Cost Field */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-amber-200 shadow-sm w-max">
                      <Plus size={14} className="text-amber-500" />
                      <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Extras (Mano de Obra)</label>
                          <div className="flex items-center gap-1">
                            <span className="text-amber-300 text-xs font-bold">$</span>
                            <input 
                                type="number" 
                                className="w-24 bg-transparent outline-none font-black text-slate-700 text-sm"
                                value={state.extras_cost || ''}
                                placeholder="0"
                                onChange={e => updateEdit(ev.id, 'extras_cost', Number(e.target.value) || 0)}
                            />
                          </div>
                      </div>
                    </div>

                    {/* Commissions Cost Field */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-rose-200 shadow-sm w-max">
                      <DollarSign size={14} className="text-rose-500" />
                      <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase text-rose-500 tracking-widest">Comisiones (RV Traslados)</label>
                          <div className="flex items-center gap-1">
                            <span className="text-rose-300 text-xs font-bold">$</span>
                            <input 
                                type="number" 
                                className="w-24 bg-transparent outline-none font-black text-slate-700 text-sm"
                                value={state.commissions_cost || ''}
                                placeholder="0"
                                onChange={e => updateEdit(ev.id, 'commissions_cost', Number(e.target.value) || 0)}
                            />
                          </div>
                      </div>
                    </div>
                  </div>

                  {(state.projections || []).map((proj: ProjectionRow, idx: number) => {
                    const cid = clientIdMap[proj.company_name]
                    const filteredVehicles = vehicles.filter(v => v.client_id === cid)
                    const filteredCoordinators = coordinators.filter(c => c.company === proj.company_name)

                    return (
                      <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex gap-3 items-center p-3">
                          <div className="flex gap-2 flex-1">
                            <select className="flex-1 p-2 border border-slate-200 rounded-lg text-sm outline-none appearance-none font-bold"
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

                        {/* Logistics Sub-form */}
                        {proj.company_name && (
                          <div className="bg-slate-50 border-t border-slate-100 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Truck size={12} /> Logística Planificada (Micros)
                              </label>
                              <button type="button" onClick={() => addEditBus(ev.id, idx)} className="text-indigo-600 text-[10px] font-black flex items-center gap-1 hover:underline">
                                <Plus size={10} /> Agregar Micro
                              </button>
                            </div>
                            
                            {(proj.bus_assignments || []).map((bus: any, bIdx: number) => (
                              <div key={bIdx} className="flex items-center gap-2">
                                <div className="flex-1 flex gap-1">
                                  <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                                    value={bus.vehicle_id} onChange={e => updateEditBus(ev.id, idx, bIdx, 'vehicle_id', e.target.value)}>
                                    <option value="">-- Vehículo --</option>
                                    {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.internal_name} {v.plate ? `(${v.plate})` : ''}</option>)}
                                  </select>
                                  <button type="button" onClick={() => setFleetModal(true)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition">
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <div className="flex-1 flex gap-1">
                                  <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                                    value={bus.coordinator_id} onChange={e => updateEditBus(ev.id, idx, bIdx, 'coordinator_id', e.target.value)}>
                                    <option value="">-- Coordinador --</option>
                                    {filteredCoordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <button type="button" onClick={() => setCoordModal(true)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition">
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <div className="flex flex-col w-12">
                                  <label className="text-[8px] font-black uppercase text-slate-400 text-center">Trip.</label>
                                  <input type="text" inputMode="numeric"
                                    className="w-full p-2 border border-slate-200 rounded-lg text-center font-black text-xs outline-none"
                                    value={bus.crew_count || 0}
                                    onChange={e => updateEditBus(ev.id, idx, bIdx, 'crew_count', parseInt(e.target.value.replace(/\D/g, '')) || 0)} />
                                </div>
                                <button onClick={() => removeEditBus(ev.id, idx, bIdx)} className="p-1 text-slate-300 hover:text-rose-500 transition">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            {(!proj.bus_assignments || proj.bus_assignments.length === 0) && (
                              <p className="text-[10px] text-slate-400 italic">No hay logística planificada.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
      <FleetModal 
        isOpen={fleetModal} 
        onClose={() => setFleetModal(false)} 
        onSuccess={() => {
          supabase.from("vehicles").select("id, internal_name, plate, client_id, vehicle_type").order("internal_name").then(({ data }) => setVehicles(data || []))
        }} 
        clients={Object.entries(clientIdMap).map(([name, id]) => ({ id, name }))} 
      />
      </div>

      {/* FLOATING SAVE ALL BUTTON */}
      {Object.keys(localEdits).length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-4 rounded-[2.5rem] shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 z-[100] border border-slate-700">
           <div className="pl-4 text-left">
              <p className="font-black text-sm tracking-tight text-white">Cambios masivos detectados</p>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{Object.keys(localEdits).length} eventos con modificaciones</p>
           </div>
           <button 
              onClick={handleSaveAll} disabled={saving === "all"}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-[1.5rem] font-black flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50">
              {saving === "all" ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
              Guardar Todo Ahora
           </button>
        </div>
      )}
    </div>
  )
}
