"use client"

import React, { useEffect, useState } from "react"
import DashboardCard from "@/components/ui/DashboardCard"
import { Users, Calendar, DollarSign, Activity, Loader2, TrendingUp, History, MapPin, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

interface EventData {
   id: string
   date: string
   show: string
   venue: string
   status: string
   projected: number
   sold: number
   revenue: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  
  // Dashboard Tops
  const [metrics, setMetrics] = useState({
     eventCount: 0,
     activeCompanies: 0,
     estimatedRevenue: 0,
     pendingViandas: 0
  })

  // Specific Cuts
  const [upcoming10Days, setUpcoming10Days] = useState<EventData[]>([])
  const [upcomingCharts, setUpcomingCharts] = useState<EventData[]>([])
  const [executedEvents, setExecutedEvents] = useState<EventData[]>([])
  const [topVenues, setTopVenues] = useState<{name: string, sold: number}[]>([])
  const [topCompanies, setTopCompanies] = useState<{name: string, sold: number}[]>([])

  useEffect(() => {
     const bootstrapDashboard = async () => {
        setLoading(true)

        // 1. Fetch ALL Events Master (To capture History and Future)
        const { data: masters, error } = await supabase
           .from("events_master")
           .select(`
              id, event_date, show_name, status,
              venues (name),
              event_projections (id, company_name, projected_pax)
           `)

        if (error) {
           console.error("Dashboard master fetch error:", error)
           setFetchError(JSON.stringify(error))
           setLoading(false)
           return
        }

        if (!masters || masters.length === 0) {
           setLoading(false)
           return
        }

        const masterIds = masters.map(m => m.id)

        // 2. Fetch financial & logistic totals natively
        const { data: headers, error: headErr } = await supabase
           .from("event_sales_headers")
           .select("id, event_master_id, total_amount, company_name") // adding company_name from headers too

        if (headErr) {
            console.error("Headers fetch error:", headErr);
            setFetchError(JSON.stringify(headErr))
            setLoading(false)
            return
        }

        const soldByMaster: Record<string, number> = {}
        const revenueByMaster: Record<string, number> = {}
        const soldByCompany: Record<string, number> = {}

        if (headers && headers.length > 0) {
           const headerIds = headers.map(h => h.id)
           
           const { data: units } = await supabase
              .from("event_sales_units")
              .select("header_id, sold_qty")
              .in("header_id", headerIds)

           const unitsByHeader: Record<string, number> = {}
           units?.forEach(u => {
              unitsByHeader[u.header_id] = (unitsByHeader[u.header_id] || 0) + (Number(u.sold_qty) || 0)
           })

           headers.forEach(h => {
              const amount = Number(h.total_amount) || 0
              const sold = unitsByHeader[h.id] || 0
              
              const mId = h.event_master_id
              if (!soldByMaster[mId]) soldByMaster[mId] = 0
              if (!revenueByMaster[mId]) revenueByMaster[mId] = 0

              soldByMaster[mId] += sold
              revenueByMaster[mId] += amount

              // For accurate company aggregation based on actual sales headers
              const cName = h.company_name || 'Desconocido'
              if (!soldByCompany[cName]) soldByCompany[cName] = 0
              soldByCompany[cName] += sold
           })
        }

        // 3. Mathematical Aggregation
        const todayStr = new Date().toISOString().split('T')[0]

        let topPendingEventsCount = 0
        const activeUniqueCompanies = new Set<string>()
        let estimatedRev = 0
        let pendingViandas = 0
        
        const venueAggr: Record<string, number> = {}

        const allMapped: EventData[] = masters.map(m => {
           let eProj = 0
           m.event_projections?.forEach((p: any) => {
              eProj += (p.projected_pax || 0)
           })

           const eSold = soldByMaster[m.id] || 0
           const eRev = revenueByMaster[m.id] || 0
           const vName = (m.venues as any)?.name || (m.venues as any)?.[0]?.name || "-"

           // Venue aggregations (All time)
           if (!venueAggr[vName]) venueAggr[vName] = 0
           venueAggr[vName] += eSold

           return {
              id: m.id,
              date: m.event_date,
              show: m.show_name,
              status: (m.status || "").toLowerCase(),
              venue: vName,
              projected: eProj,
              sold: eSold,
              revenue: eRev
           }
        })

        // SORTING Helpers
        const safeLocal = (a: string, b: string) => {
           if (!a) return 1; if (!b) return -1;
           return a.localeCompare(b);
        }

        allMapped.sort((a,b) => safeLocal(a.date, b.date))
        
        const pendingStatuses = ["pendiente", "proyectado", "proyectada", "confirmado"]
        const closedStatuses = ["ejecutado", "ejecutada", "cancelado", "cancelada"]

        // The user visually sees ANY pending status as active in events page, so we mirror that
        const futureEvs = allMapped.filter(m => pendingStatuses.includes(m.status) || (m.date >= todayStr && !closedStatuses.includes(m.status)))
        
        const next10DaysList = futureEvs.slice(0, 10)
        
        const pastEvs = allMapped.filter(m => closedStatuses.includes(m.status) || (!pendingStatuses.includes(m.status) && m.date < todayStr)).sort((a,b) => safeLocal(b.date, a.date))

        // Analytics iteration
        masters.forEach(m => {
           const st = (m.status || "").toLowerCase()
           const isActive = st === 'pendiente' || st === 'proyectado' || st === 'confirmado' || m.event_date >= todayStr
           
           if (isActive) {
              topPendingEventsCount++
              estimatedRev += (revenueByMaster[m.id] || 0)
              pendingViandas += (soldByMaster[m.id] || 0)
              m.event_projections?.forEach((p: any) => {
                 if (p.company_name) activeUniqueCompanies.add(p.company_name)
              })
           }
        })

        setMetrics({
           eventCount: topPendingEventsCount,
           activeCompanies: activeUniqueCompanies.size,
           estimatedRevenue: estimatedRev,
           pendingViandas: pendingViandas
        })

        setUpcoming10Days(next10DaysList)
        setUpcomingCharts(futureEvs.slice(0, 10))
        setExecutedEvents(pastEvs.slice(0, 15))

        // Venues Rank
        const vRank = Object.keys(venueAggr).map(name => ({name, sold: venueAggr[name]})).filter(c => c.sold > 0).sort((a,b) => b.sold - a.sold).slice(0, 5)
        // Companies Rank
        const cRank = Object.keys(soldByCompany).map(name => ({name, sold: soldByCompany[name]})).filter(c => c.sold > 0).sort((a,b) => b.sold - a.sold).slice(0, 5)

        setTopVenues(vRank)
        setTopCompanies(cRank)

        setLoading(false)
     }

     bootstrapDashboard()
  }, [])

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
           <Loader2 className="animate-spin text-indigo-500" size={48} />
           <p className="text-slate-400 font-medium animate-pulse">Destilando historia contable y proyecciones futuras...</p>
        </div>
     )
  }

  if (fetchError) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
              <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-xl text-center shadow-sm">
                  <h3 className="font-black text-xl mb-2">Error de Base de Datos</h3>
                  <p className="text-sm font-medium opacity-80 mb-4">No se pudieron cargar los datos maestros. Esto detuvo el cálculo.</p>
                  <code className="text-xs bg-red-100 p-3 rounded block text-left break-words">{fetchError}</code>
                  <button onClick={() => window.location.reload()} className="mt-4 bg-red-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm hover:bg-red-700">Reintentar</button>
              </div>
          </div>
      )
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800">
            Panel Operativo Central
          </h2>
          <p className="text-slate-500 font-medium">Radiografía directa con trazabilidad de caja histórica.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Próximos Shows"
          value={metrics.eventCount}
          subtitle="En calendario activo"
          icon={<Calendar size={24} />}
          color="purple"
          href="/events"
        />
        <DashboardCard
          title="Empresas de Turismo"
          value={metrics.activeCompanies}
          subtitle="Proyectando en activos"
          icon={<Users size={24} />}
          color="emerald"
          href="/events"
        />
        <DashboardCard
          title="Ingresos a Facturar"
          value={formatCurrency(metrics.estimatedRevenue)}
          subtitle="Proyección financiera bruta"
          icon={<DollarSign size={24} />}
          color="emerald"
          href="/ventas-evento"
        />
        <DashboardCard
          title="Viandas en Preparación"
          value={metrics.pendingViandas}
          subtitle="Ventas y liberados confirmados"
          icon={<Activity size={24} />}
          color="purple"
          href="/produccion"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
         {/* CHART 1: FUTURO */}
         <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 mb-2 flex items-center gap-2"><TrendingUp className="text-indigo-500"/> Efectividad de Próximos Shows</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">Progreso de Ventas (Verde) frente al PAX Proyectado oficial Declarado (Gris).</p>
            
            <div className="space-y-6 max-h-[350px] overflow-y-auto pr-2">
               {upcomingCharts.length === 0 && (
                  <p className="text-center italic text-slate-400 py-10">No hay eventos pendientes programados.</p>
               )}

               {upcomingCharts.map((ev, i) => {
                  const pct = ev.projected > 0 ? Math.min((ev.sold / ev.projected) * 100, 100) : 0
                  const overSale = ev.sold > ev.projected

                  return (
                     <div key={i} className="group cursor-pointer">
                        <div className="flex justify-between items-baseline mb-2">
                           <p className="font-bold text-slate-800 text-sm">{new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR').slice(0, 5)} - {ev.show}</p>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <span className="text-indigo-600">{ev.sold} v</span> / {ev.projected} p
                           </p>
                        </div>
                        
                        <div className="h-5 w-full bg-slate-100/80 rounded-full overflow-hidden relative border border-slate-200">
                           <div 
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${overSale ? 'bg-amber-400' : 'bg-emerald-500'}`}
                              style={{ width: `${pct > 0 ? pct : 0}%` }}
                           />
                           
                           {pct > 15 && (
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black tracking-wider text-white drop-shadow-sm">
                                 {pct.toFixed(0)}%
                              </span>
                           )}
                           
                           {overSale && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-900 tracking-wider">
                                 ¡SOBREVENTA! 
                              </div>
                           )}
                        </div>
                     </div>
                  )
               })}
            </div>
         </div>

         {/* LIST: 10 SHOWS */}
         <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl text-white flex flex-col">
            <h3 className="text-lg font-black tracking-tight text-white mb-2">Radar: Próximas Fechas</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Radar logístico de despachos por venir en base al estado de gestión y fecha natural.</p>
            
            <div className="flex-1 space-y-3 overflow-y-auto pr-2 max-h-[350px]">
               {upcoming10Days.length === 0 && (
                  <p className="text-slate-500 text-center text-sm py-8 italic font-bold">Sin elementos activos.</p>
               )}
               {upcoming10Days.map((ev, i) => (
                  <div key={i} className="flex gap-4 items-center bg-slate-800/50 p-4 rounded-[1.25rem] border border-slate-700 hover:bg-slate-700 transition cursor-pointer">
                     <div className="bg-slate-950 px-3 py-2 rounded-xl text-center border border-slate-800 min-w-[3.5rem]">
                        <p className="text-[10px] font-black uppercase text-indigo-400">{new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}</p>
                        <p className="text-lg font-black tabular-nums">{new Date(ev.date + 'T12:00:00').getDate()}</p>
                     </div>
                     <div className="flex-1 min-w-0">
                        <Link href={`/events/${ev.id}`} className="font-bold text-sm tracking-tight hover:text-indigo-300 transition line-clamp-1 truncate block">{ev.show}</Link>
                        <p className="text-[10px] uppercase text-slate-400 font-bold truncate block mt-1">{ev.venue}</p>
                     </div>
                  </div>
               ))}
            </div>

            <Link href="/events" className="mt-6 w-full text-center bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition tracking-wide text-sm">
               Administrar Calendario Maestro
            </Link>
         </div>
      </div>

      {/* HISTORICAL CHARTS SECTION */}
      <h3 className="text-xl font-black mt-10 mb-4 px-2 text-slate-800 flex items-center gap-2"><History size={20}/> Análisis Histórico Contable (Completos/Ejecutados)</h3>
      <div className="grid gap-8 lg:grid-cols-3 items-start">
         
         {/* EXECUTED EVENTS CHART */}
         <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem]">
            <h4 className="font-black text-sm text-slate-500 uppercase tracking-widest mb-6">Últimos Eventos Ejecutados</h4>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
               {executedEvents.length === 0 && <p className="text-xs font-bold text-slate-400 text-center py-10">Sin eventos concluidos.</p>}
               {executedEvents.map(ev => {
                  // Normalize bar width based on max sold vs others? Just use pct of its own projection.
                  const pct = ev.projected > 0 ? (ev.sold / ev.projected) : 1
                  return (
                  <div key={ev.id} className="relative group">
                     <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[150px]">{ev.show}</span>
                        <span className="text-[10px] font-black text-emerald-600">{formatCurrency(ev.revenue)}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                           <div className="h-full bg-slate-800 rounded-full" style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-slate-500 min-w-[2.5rem] text-right">{ev.sold} v</span>
                     </div>
                  </div>
               )})}
            </div>
         </div>

         {/* TOP VENUES CHART */}
         <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem]">
            <h4 className="font-black text-sm text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={16}/> Top Venues</h4>
            <div className="space-y-5">
               {topVenues.length === 0 && <p className="text-xs font-bold text-slate-400 text-center py-10">Sin datos de recintos.</p>}
               {topVenues.map((v, i) => {
                  const maxSold = topVenues[0]?.sold || 1
                  const pct = (v.sold / maxSold) * 100
                  return (
                  <div key={i} className="relative">
                     <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-slate-800 text-xs truncate">{v.name}</span>
                     </div>
                     <div className="h-6 w-full bg-indigo-50/50 rounded-lg overflow-hidden relative">
                        <div className="h-full bg-indigo-200 rounded-lg" style={{ width: `${pct}%` }} />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-900">{v.sold} vendidas totales</span>
                     </div>
                  </div>
               )})}
            </div>
         </div>

         {/* TOP COMPANIES CHART */}
         <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem]">
            <h4 className="font-black text-sm text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Building2 size={16}/> Ranking Clientes</h4>
            <div className="space-y-5">
               {topCompanies.length === 0 && <p className="text-xs font-bold text-slate-400 text-center py-10">Sin ventas a empresas.</p>}
               {topCompanies.map((c, i) => {
                  // Percentage relative to the highest selling company in the chart
                  const maxSold = topCompanies[0]?.sold || 1
                  const pct = (c.sold / maxSold) * 100
                  return (
                  <div key={i} className="relative">
                     <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]">{c.name}</span>
                     </div>
                     <div className="h-6 w-full bg-emerald-50/50 rounded-lg overflow-hidden relative border border-emerald-100">
                        <div className="h-full bg-emerald-400/80 rounded-lg" style={{ width: `${pct}%` }} />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-900 drop-shadow-sm">{c.sold} viandas acumuladas</span>
                     </div>
                  </div>
               )})}
            </div>
         </div>

      </div>
    </div>
  )
}