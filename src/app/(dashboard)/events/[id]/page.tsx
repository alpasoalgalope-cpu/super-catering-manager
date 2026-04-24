"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import DashboardCard from '@/components/ui/DashboardCard'
import { Users, Clock, ChefHat, Calendar, Link as LinkIcon, Building2, Truck, Activity, ArrowLeft, Trash2 } from 'lucide-react'
import Link from "next/link"

export default function EventDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [eventData, setEventData] = useState<any>(null)
  const [projections, setProjections] = useState<any[]>([])
  const [buses, setBuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ sold: 0, specials: 0 })

  const fetchRealData = async () => {
    if (!id) return
    setLoading(true)

    // Fetch the master event
    const { data: master, error } = await supabase
      .from("events_master")
      .select(`
        id, event_date, show_name, status,
        venues (name, address, meeting_point),
        coordinators (name, phone)
      `)
      .eq("id", id)
      .single()

    if (error) {
       console.error(error)
       setLoading(false)
       return
    }
    setEventData(master)

    // Projections (Companies)
    const { data: projs } = await supabase
      .from("event_projections")
      .select("company_name, projected_pax")
      .eq("event_id", id)
    setProjections(projs || [])

    // Logistics (event_bus_assignments)
    const { data: assignments } = await supabase
      .from("event_bus_assignments")
      .select(`
         unit_name, observations, coordinator_name,
         clients (name),
         vehicles (internal_name, plate)
      `)
      .eq("event_id", id)
    
    setBuses(assignments || [])

    // Sales Logic
    const { data: headers } = await supabase
      .from("event_sales_headers")
      .select("id")
      .or(`event_id.eq.${id},event_master_id.eq.${id}`)

    if (headers && headers.length > 0) {
      const hids = headers.map(h => h.id)
      const { data: units } = await supabase.from("event_sales_units").select("sold_qty, special_breakdown").in("header_id", hids)
      let sld = 0; let spc = 0;
      units?.forEach(u => {
         sld += (Number(u.sold_qty) || 0)
         if (u.special_breakdown) {
           try {
              const arr = JSON.parse(u.special_breakdown)
              if (Array.isArray(arr)) spc += arr.reduce((acc, a) => acc + (Number(a.qty)||0), 0)
           } catch(e) {}
         }
      })
      setStats({ sold: sld, specials: spc })
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchRealData()
  }, [id])

  // --- Handlers para Edición en Caliente ---
  const handleDeleteCompany = async (companyName: string) => {
    const isSure = window.confirm(`ATENCIÓN DOBLE SEGURO:\n¿Estás absolutamente seguro de eliminar a la empresa ${companyName} de este evento? Se borrarán sus proyecciones y TODAS las asignaciones de ventas y micros que se hayan hecho.`)
    if (!isSure) return

    try {
      // 1. Encontrar la cabecera de ventas si existe y borrar
      const { data: header } = await supabase.from('event_sales_headers')
        .select('id').eq('event_master_id', id).eq('company_name', companyName).maybeSingle()
      
      if (header) {
        await supabase.from('event_sales_units').delete().eq('header_id', header.id)
        await supabase.from('event_sales_headers').delete().eq('id', header.id)
      }

      // 2. Borrar asignaciones de micros
      const { data: clients } = await supabase.from('clients').select('id').ilike('name', companyName).maybeSingle()
      if (clients) {
        await supabase.from('event_bus_assignments').delete()
          .eq('event_id', id).eq('client_id', clients.id)
      }

      // 3. Borrar la proyección (Company del Evento)
      await supabase.from('event_projections').delete()
        .eq('event_id', id).eq('company_name', companyName)

      // Refresh Data
      await fetchRealData()
    } catch (err) {
      console.error("Error borrando empresa", err)
      alert("Error al intentar borrar la empresa.")
    }
  }

  const handleDeleteBus = async (unitName: string, companyName: string) => {
    const isSure = window.confirm(`¿Quitar este micro ("${unitName}") de la logística del evento? Solo elimina la asignación de flota, las viandas pueden quedar en el formulario central.`)
    if (!isSure) return

    try {
      const { data: clients } = await supabase.from('clients').select('id').ilike('name', companyName).maybeSingle()
      if (clients) {
        await supabase.from('event_bus_assignments').delete()
          .eq('event_id', id)
          .eq('client_id', clients.id)
          .eq('unit_name', unitName)
      }
      await fetchRealData()
    } catch (err) {
      console.error("Error desvinculando micro", err)
    }
  }

  if (loading && !eventData) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Cargando inteligencia del evento...</div>
  if (!eventData && !loading) return <div className="p-20 text-center text-red-500 font-bold">Error: Evento no encontrado o eliminado.</div>

  const totalProjected = projections.reduce((acc, p) => acc + (p.projected_pax || 0), 0)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
           <button onClick={() => router.back()} className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition"><ArrowLeft /></button>
           <div>
             <h2 className="text-4xl font-black tracking-tight text-slate-900">{eventData.show_name}</h2>
             <div className="flex items-center gap-4 text-sm font-bold text-slate-500 mt-2">
               <span className="flex items-center gap-1"><Calendar size={16}/> {new Date(eventData.event_date + 'T12:00:00').toLocaleDateString('es-AR')}</span>
               <span className="flex items-center gap-1"><Activity size={16}/> {eventData.venues?.name || "Sin Venue"}</span>
               <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest ${eventData.status === 'cancelado' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{eventData.status}</span>
             </div>
           </div>
        </div>
        <div className="flex gap-2">
          <Link href="/ventas-evento" className="bg-indigo-600 font-bold text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition shadow">Ir al Formulario de Ventas</Link>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <DashboardCard title="Proyección PAX Global" value={totalProjected.toString()} icon={<Users size={20} />} />
        <DashboardCard title="Ventas Confirmadas (Viandas)" value={stats.sold.toString()} icon={<ChefHat size={20} />} />
        <DashboardCard title="Punto de Encuentro" value={eventData.venues?.meeting_point || "A definir"} icon={<Clock size={20} />} />
        <DashboardCard title="Pedidos Especiales Escaneados" value={stats.specials.toString()} subtitle="Dietas restrictivas en el sistema." icon={<LinkIcon size={20} />} />
      </div>

      {/* Grid Content */}
      <div className="grid md:grid-cols-3 gap-6">
         {/* Companies */}
         <div className="bg-white border border-slate-200 rounded-[2rem] p-6">
            <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2 mb-6"><Building2 size={16}/> Empresas Involucradas</h3>
            {projections.length > 0 ? (
               <div className="space-y-4">
                  {projections.map((p, i) => (
                     <div key={i} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl group hover:bg-slate-100 transition">
                        <div>
                           <span className="font-bold text-slate-800 block">{p.company_name}</span>
                           <span className="text-xs font-black text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full inline-block mt-1">{p.projected_pax} PAX</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                           <Link href={`/ventas-evento?eventId=${id}&company=${encodeURIComponent(p.company_name)}`}
                             title="Editar Cargas"
                             className="p-2 bg-white text-indigo-600 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition">
                             <ChefHat size={16} />
                           </Link>
                           <button onClick={() => handleDeleteCompany(p.company_name)} 
                             title="Eliminar Empresa y Cargas"
                             className="p-2 bg-white text-slate-400 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 transition">
                             <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            ) : <p className="text-slate-400 font-medium italic">No hay empresas proyectando para este evento.</p>}
         </div>

         {/* Logistic Fleet */}
         <div className="md:col-span-2 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
            <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2 mb-6"><Truck size={16}/> Asignación de Flota (Micros)</h3>
            
            {buses.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {buses.map((b, i) => (
                     <div key={i} className="bg-slate-50 border border-slate-100 p-5 rounded-[1.5rem] group relative">
                        <button onClick={() => handleDeleteBus(b.unit_name, b.clients?.name)}
                           title="Desvincular micro"
                           className="absolute top-4 right-4 p-2 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition">
                           <Trash2 size={16} />
                        </button>
                        <div className="flex justify-between items-center mb-3 pr-8">
                           <span className="font-black text-slate-900">{b.unit_name}</span>
                           <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-1 rounded">{b.clients?.name || 'Venta Libre'}</span>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 font-medium pr-2">
                           <p>🚚 {b.vehicles?.internal_name || 'Desconocido'} ({b.vehicles?.plate || 'Sin Patente'})</p>
                           <p>👨‍💼 {b.coordinator_name || 'Sin Coordinador'}</p>
                           {b.observations && <p className="bg-white p-3 rounded-xl mt-3 text-xs italic text-slate-500 shadow-sm border border-slate-100">"{b.observations}"</p>}
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <div className="text-center py-10 bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
                  <Truck className="mx-auto text-slate-300 mb-3" size={40}/>
                  <p className="text-slate-500 font-bold">No hay micros cargados a este evento aún.</p>
                  <p className="text-slate-400 text-sm mt-1">Se asignarán automáticamente cuando realices las ventas por evento.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  )
}
