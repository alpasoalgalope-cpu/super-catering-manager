"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Trash2, Save, Plus, Loader2, MapPin, Building2, Ticket, CheckSquare, X } from "lucide-react"

interface FormatRow {
  projection_id: string
  master_id: string
  event_date: string
  show_name: string
  venue_name: string
  status: string
  company_name: string
  projected_pax: number
  sold_units: number
  sales_amount: number
}

function normalizeStatus(s: string) {
  return (s || "").trim().toLowerCase()
}

export default function EventsPage() {
  const [view, setView] = useState<"pending" | "closed">("pending")
  const [rows, setRows] = useState<FormatRow[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [companyFilter, setCompanyFilter] = useState("")
  const [venueFilter, setVenueFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Edits
  const [editedPax, setEditedPax] = useState<Record<string, number>>({})
  const [editedStatus, setEditedStatus] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Creation State
  const [isCreating, setIsCreating] = useState(false)
  const [venues, setVenues] = useState<any[]>([])
  const [newEq, setNewEq] = useState({ date: "", show: "", venueId: "", company: "", pax: 0, status: "pendiente" })

  const fetchEvents = async () => {
    setLoading(true)
    const { data: masters, error: mErr } = await supabase
      .from("events_master")
      .select(`
        id, event_date, show_name, status,
        venues (name),
        event_projections (id, company_name, projected_pax)
      `)

    if (mErr) { console.error(mErr); setLoading(false); return }

    const { data: headers } = await supabase.from("event_sales_headers").select("event_master_id, company_name, total_amount, id")
    const { data: unitsData } = await supabase.from("event_sales_units").select("header_id, sold_qty")

    const unitSalesMap: Record<string, number> = {}
    if (unitsData) {
      unitsData.forEach(u => {
         unitSalesMap[u.header_id] = (unitSalesMap[u.header_id] || 0) + (Number(u.sold_qty) || 0)
      })
    }

    const salesMap: Record<string, {sold: number, amount: number}> = {} 
    if (headers) {
      headers.forEach(h => {
        const k = `${h.event_master_id}_${h.company_name}`
        const sold = unitSalesMap[h.id] || 0
        if (!salesMap[k]) salesMap[k] = { sold: 0, amount: 0 }
        salesMap[k].sold += sold
        salesMap[k].amount += (Number(h.total_amount) || 0)
      })
    }

    const mapped: FormatRow[] = []
    masters?.forEach(m => {
       if (!m.event_projections || m.event_projections.length === 0) {
          mapped.push({
             projection_id: `empty-${m.id}`,
             master_id: m.id,
             event_date: m.event_date,
             show_name: m.show_name,
             venue_name: (m.venues as any)?.name || (m.venues as any)?.[0]?.name || "-",
             status: m.status,
             company_name: "-",
             projected_pax: 0,
             sold_units: 0,
             sales_amount: 0
          })
       } else {
          m.event_projections.forEach((p: any) => {
             const k = `${m.id}_${p.company_name}`
             const sales = salesMap[k] || { sold: 0, amount: 0 }
             mapped.push({
               projection_id: p.id,
               master_id: m.id,
               event_date: m.event_date,
               show_name: m.show_name,
               venue_name: (m.venues as any)?.name || (m.venues as any)?.[0]?.name || "-",
               status: m.status,
               company_name: p.company_name,
               projected_pax: p.projected_pax,
               sold_units: sales.sold,
               sales_amount: sales.amount
             })
          })
       }
    })

    // sort naturally by date ascending
    mapped.sort((a,b) => a.event_date.localeCompare(b.event_date))

    setRows(mapped)
    setEditedPax({})
    setEditedStatus({})
    setLoading(false)
  }

  const fetchVenues = async () => {
    const { data } = await supabase.from("venues").select("id, name").order("name")
    if (data) setVenues(data)
  }

  useEffect(() => {
    fetchEvents()
    fetchVenues()
  }, [])

  const handleSaveBatch = async () => {
    setIsSaving(true)
    const paxProms = Object.keys(editedPax).map(projId => {
       if(projId.startsWith("empty")) return Promise.resolve()
       return supabase.from("event_projections").update({ projected_pax: editedPax[projId] }).eq("id", projId)
    })
    const statusProms = Object.keys(editedStatus).map(mastId => {
       return supabase.from("events_master").update({ status: editedStatus[mastId] }).eq("id", mastId)
    })
    
    await Promise.all([...paxProms, ...statusProms])
    await fetchEvents()
    setIsSaving(false)
  }

  const handleCreateNew = async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSaving(true)
      
      const { data: master, error: merr } = await supabase.from("events_master")
         .insert([{ event_date: newEq.date, show_name: newEq.show, venue_id: newEq.venueId, status: newEq.status }])
         .select().single()
         
      let usedMasterId = master?.id
      if (merr && merr.code === "23505") { // unique viol -- event already exists
          const { data: exMast } = await supabase.from("events_master")
             .select("id")
             .eq("event_date", newEq.date)
             .eq("show_name", newEq.show)
             .eq("venue_id", newEq.venueId)
             .single()
          usedMasterId = exMast?.id
      } else if (merr) {
          console.error(merr)
          alert("Error creando el evento.")
          setIsSaving(false)
          return
      }
      
      if (usedMasterId && newEq.company) {
         await supabase.from("event_projections").insert([{
            event_id: usedMasterId,
            company_name: newEq.company,
            projected_pax: newEq.pax
         }])
      }
      
      setIsCreating(false)
      setNewEq({ date: "", show: "", venueId: "", company: "", pax: 0, status: "pendiente" })
      await fetchEvents()
      setIsSaving(false)
  }

  const handleDeleteRecord = async (projId: string, masterId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este registro? Si es la única empresa del evento, también podrías querer borrar el evento entero desde su vista de detalle.")) return
    
    if (projId.startsWith("empty")) {
        // Just delete the master event it's completely empty
        await supabase.from("events_master").delete().eq("id", masterId)
    } else {
        await supabase.from("event_projections").delete().eq("id", projId)
    }
    fetchEvents()
  }

  // Derived Filter Options
  const companies = Array.from(new Set(rows.map(r => r.company_name).filter(c => c !== "-"))).sort()
  const venuesList = Array.from(new Set(rows.map(r => r.venue_name))).sort()
  const statuses = Array.from(new Set(rows.map(r => r.status))).sort()

  const pendingStatuses = ["pendiente", "proyectado", "proyectada", "confirmado"]
  const closedStatuses = ["ejecutado", "ejecutada", "cancelado", "cancelada"]

  let filtered = rows.filter(r => {
     const st = normalizeStatus(r.status)
     if (view === "pending" && !pendingStatuses.includes(st)) return false
     if (view === "closed" && !closedStatuses.includes(st)) return false
     
     if (companyFilter && r.company_name !== companyFilter) return false
     if (venueFilter && r.venue_name !== venueFilter) return false
     if (statusFilter && r.status !== statusFilter) return false
     
     return true
  })

  // Format Helpers
  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)
  const formatPercent = (sold: number, pax: number) => {
     if (!pax) return "-"
     return `${((sold / Math.max(pax, 1)) * 100).toFixed(1)}%`
  }

  const hasEdits = Object.keys(editedPax).length > 0 || Object.keys(editedStatus).length > 0
  const isEditingEnabled = view === "pending"

  return (
    <div className="space-y-6 pb-24 relative min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestión Maestra de Eventos</h1>
          <p className="text-slate-500 font-medium">Paradigma consolidado: Eventos y Mapeo de Proyecciones operativas</p>
        </div>
        <button 
           onClick={() => setIsCreating(!isCreating)}
           className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md transition">
           <Plus size={20}/> Nuevo Evento / Proyección
        </button>
      </div>

      {isCreating && (
         <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] p-6 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2"><CheckSquare /> Alta de Asignación de Evento</h3>
            <form onSubmit={handleCreateNew} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
               <div className="col-span-1 lg:col-span-1">
                  <label className="block text-xs font-bold text-indigo-900/60 uppercase mb-1">Fecha</label>
                  <input required type="date" value={newEq.date} onChange={e=>setNewEq({...newEq, date: e.target.value})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold"/>
               </div>
               <div className="col-span-1 lg:col-span-2">
                  <label className="block text-xs font-bold text-indigo-900/60 uppercase mb-1">Show / Artista</label>
                  <input required type="text" placeholder="Ej: Los Piojos" value={newEq.show} onChange={e=>setNewEq({...newEq, show: e.target.value})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold"/>
               </div>
               <div className="col-span-1 lg:col-span-1">
                  <label className="block text-xs font-bold text-indigo-900/60 uppercase mb-1">Venue</label>
                  <select required value={newEq.venueId} onChange={e=>setNewEq({...newEq, venueId: e.target.value})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold">
                     <option value="">Seleccionar</option>
                     {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
               </div>
               <div className="col-span-1 lg:col-span-1">
                  <label className="block text-xs font-bold text-indigo-900/60 uppercase mb-1">Empresa</label>
                  <input type="text" placeholder="Ej: Viajes Rock" value={newEq.company} onChange={e=>setNewEq({...newEq, company: e.target.value})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold"/>
               </div>
               <div className="col-span-1 lg:col-span-1 flex gap-2">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-indigo-900/60 uppercase mb-1">PAX</label>
                     <input type="number" min={0} value={newEq.pax} onChange={e=>setNewEq({...newEq, pax: Number(e.target.value)})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold"/>
                  </div>
                  <button type="submit" disabled={isSaving} className="w-12 mt-6 h-12 bg-indigo-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 disabled:opacity-50">
                     {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
                  </button>
               </div>
            </form>
         </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 p-2 rounded-2xl w-max">
         <button onClick={() => setView("pending")} className={`px-6 py-2.5 rounded-xl font-bold transition ${view === "pending" ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Activos / Pendientes</button>
         <button onClick={() => setView("closed")} className={`px-6 py-2.5 rounded-xl font-bold transition ${view === "closed" ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Conclusivos</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 lg:p-6 rounded-[2rem] border border-slate-200 shadow-sm">
         <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><Building2 size={12}/> Empresa</label>
            <select value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none font-bold">
               <option value="">Todas las Empresas</option>
               {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
         </div>
         <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><MapPin size={12}/> Venue</label>
            <select value={venueFilter} onChange={e=>setVenueFilter(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none font-bold">
               <option value="">Todos los Venues</option>
               {venuesList.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
         </div>
         <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><Ticket size={12}/> Estado Maestro</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none font-bold">
               <option value="">Cualquier Estado</option>
               {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="p-4 font-black">Fecha</th>
                      <th className="p-4 font-black">Show & Venue</th>
                      <th className="p-4 font-black">Empresa</th>
                      <th className="p-4 font-black">Estado T. Maestro</th>
                      {view === "pending" ? (
                         <>
                         <th className="p-4 font-black text-right w-32">PAX Proyectado</th>
                         <th className="p-4 font-black text-right">Rendimiento (Conv)</th>
                         </>
                      ) : (
                         <>
                         <th className="p-4 font-black text-right">Vendidos</th>
                         <th className="p-4 font-black text-right">Conversión</th>
                         <th className="p-4 font-black text-right">Facturación</th>
                         </>
                      )}
                      <th className="p-4 font-black text-center">Acciones</th>
                   </tr>
                </thead>
                <tbody className="text-sm font-semibold text-slate-700 divide-y divide-slate-50">
                   {filtered.map(row => {
                      const displayStatus = editedStatus[row.master_id] !== undefined ? editedStatus[row.master_id] : row.status
                      const displayPax = editedPax[row.projection_id] !== undefined ? editedPax[row.projection_id] : row.projected_pax

                      return (
                         <tr key={`${row.master_id}_${row.projection_id}`} className="hover:bg-slate-50/50 transition">
                            <td className="p-4 tabular-nums text-slate-500 font-bold">{new Date(row.event_date + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                            <td className="p-4">
                               <div className="text-slate-900 font-extrabold">{row.show_name}</div>
                               <div className="text-xs text-slate-400 font-medium">{row.venue_name}</div>
                            </td>
                            <td className="p-4">
                               <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black">{row.company_name || 'Sin Empresa'}</span>
                            </td>
                            <td className="p-4">
                               {isEditingEnabled ? (
                                  <select 
                                    className="bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100"
                                    value={displayStatus}
                                    onChange={e => setEditedStatus({...editedStatus, [row.master_id]: e.target.value})}>
                                     <option value="pendiente">Pendiente</option>
                                     <option value="proyectado">Proyectado</option>
                                     <option value="confirmado">Confirmado</option>
                                     <option value="ejecutado">Ejecutado</option>
                                     <option value="cancelado">Cancelado</option>
                                  </select>
                               ) : (
                                  <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${row.status === 'cancelado' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                     {row.status}
                                  </span>
                               )}
                            </td>
                            
                            {view === "pending" ? (
                               <>
                                <td className="p-4 text-right">
                                   <input 
                                     type="number"
                                     className="w-24 text-right bg-white border border-slate-200 rounded-lg p-2 font-bold tabular-nums"
                                     value={displayPax}
                                     onChange={e => setEditedPax({...editedPax, [row.projection_id]: Number(e.target.value)})}
                                   />
                                </td>
                                <td className="p-4 text-right tabular-nums text-indigo-600 font-bold bg-indigo-50/30">
                                   {formatPercent(row.sold_units, displayPax)}
                                </td>
                               </>
                            ) : (
                               <>
                                <td className="p-4 text-right tabular-nums text-slate-900 font-black">{row.sold_units}</td>
                                <td className="p-4 text-right tabular-nums text-emerald-600 font-bold bg-emerald-50/30">{formatPercent(row.sold_units, displayPax)}</td>
                                <td className="p-4 text-right tabular-nums text-slate-900 font-black">{formatCurrency(row.sales_amount)}</td>
                               </>
                            )}

                            <td className="p-4">
                               <div className="flex justify-center items-center gap-3">
                                  <Link href={`/events/${row.master_id}`} className="bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                                     Ver / Detalle
                                  </Link>
                                  <button onClick={() => handleDeleteRecord(row.projection_id, row.master_id)} title="Eliminar este vínculo de empresa (o el evento si está huérfano)" className="text-slate-300 hover:text-red-500 transition">
                                     <Trash2 size={16}/>
                                  </button>
                               </div>
                            </td>
                         </tr>
                      )
                   })}
                   {filtered.length === 0 && (
                      <tr><td colSpan={8} className="p-10 text-center text-slate-400 font-medium">No se encontraron registros de este tipo.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {/* Floating Save Button */}
      {isEditingEnabled && hasEdits && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-4 rounded-[2rem] shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10">
            <div className="pl-2">
               <p className="font-bold text-sm">Cambios masivos detectados</p>
               <p className="text-xs text-indigo-300">{Object.keys(editedPax).length} PAX / {Object.keys(editedStatus).length} Estados listos para grabar</p>
            </div>
            <button 
               onClick={handleSaveBatch} disabled={isSaving}
               className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50">
               {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
               Guardar y Sincronizar
            </button>
         </div>
      )}
    </div>
  )
}