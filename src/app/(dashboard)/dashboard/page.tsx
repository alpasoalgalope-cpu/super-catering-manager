"use client"

import React, { useEffect, useState } from "react"
import DashboardCard from "@/components/ui/DashboardCard"
import { Users, Calendar, DollarSign, Activity, Loader2, TrendingUp, History, MapPin, Building2, ChevronRight } from "lucide-react"
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

        // 2.5 Fetch Clients for Conversion Factors
        const { data: clientsData } = await supabase
           .from("clients")
           .select("name, conversion_factor")

        const conversionMap: Record<string, number> = {}
        clientsData?.forEach(c => {
           conversionMap[c.name] = Number(c.conversion_factor) || 1.0
        })

        // 3. Mathematical Aggregation
        const today = new Date()
        const currentDay = today.getDay() // 0 (Sun) - 6 (Sat)
        const dayOffset = currentDay === 0 ? 6 : currentDay - 1

        const todayDate = new Date(today)
        todayDate.setHours(0,0,0,0)
        
        const venueAggr: Record<string, number> = {}

        // End of this week (Sunday)
        const endOfThisWeek = new Date(today)
        const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
        endOfThisWeek.setDate(today.getDate() + daysToSunday)
        endOfThisWeek.setHours(23,59,59,999)

        // Start of next week (Monday)
        const startOfNextWeek = new Date(endOfThisWeek)
        startOfNextWeek.setDate(endOfThisWeek.getDate() + 1)
        startOfNextWeek.setHours(0,0,0,0)

        // End of next week (Sunday after next)
        const endOfNextWeek = new Date(startOfNextWeek)
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
        endOfNextWeek.setHours(23,59,59,999)

        const allMapped: EventData[] = masters.map(m => {
           const eRev = revenueByMaster[m.id] || 0
           const eSold = soldByMaster[m.id] || 0
           
           // Calculate Adjusted Projection based on conversion factors of included companies
           let totalAdjustedProj = 0
           m.event_projections?.forEach((p: any) => {
              const factor = conversionMap[p.company_name] || 1.0
              totalAdjustedProj += (Number(p.projected_pax) || 0) * factor
           })

           const vName = (m.venues as any)?.name || (m.venues as any)?.[0]?.name || "-"

           if (!venueAggr[vName]) venueAggr[vName] = 0
           venueAggr[vName] += eSold

           return {
              id: m.id,
              date: m.event_date,
              show: m.show_name,
              status: (m.status || "").toLowerCase(),
              venue: vName,
              projected: Math.round(totalAdjustedProj), // Adjusted!
              sold: eSold,
              revenue: eRev
           }
        })

        const safeLocal = (a: string, b: string) => {
           if (!a) return 1; if (!b) return -1;
           return a.localeCompare(b);
        }

        allMapped.sort((a,b) => safeLocal(a.date, b.date))
        
        const pendingStatuses = ["pendiente", "proyectado", "proyectada", "confirmado"]
        const closedStatuses = ["ejecutado", "ejecutada", "cancelado", "cancelada"]

        const futureEvs = allMapped.filter(m => {
           const evDate = new Date(m.date + 'T12:00:00')
           return evDate >= todayDate && !closedStatuses.includes(m.status)
        })

        const thisWeekList = futureEvs.filter(m => {
           const evDate = new Date(m.date + 'T12:00:00')
           return evDate <= endOfThisWeek
        })

        const nextWeekList = futureEvs.filter(m => {
           const evDate = new Date(m.date + 'T12:00:00')
           return evDate >= startOfNextWeek && evDate <= endOfNextWeek
        })

        setUpcoming10Days(thisWeekList)
        setUpcomingCharts(nextWeekList) // Using this state to store next week for the columns
        setExecutedEvents(allMapped.filter(m => closedStatuses.includes(m.status)).sort((a,b) => safeLocal(b.date, a.date)).slice(0, 15))

        let topPendingEventsCount = 0
        const activeUniqueCompanies = new Set<string>()
        let estimatedRev = 0
        let pendingViandas = 0

        futureEvs.forEach(ev => {
           topPendingEventsCount++
           estimatedRev += ev.revenue
           pendingViandas += ev.sold
           const m = masters.find(mast => mast.id === ev.id)
           m?.event_projections?.forEach((p: any) => {
              if (p.company_name) activeUniqueCompanies.add(p.company_name)
           })
        })

        setMetrics({
           eventCount: topPendingEventsCount,
           activeCompanies: activeUniqueCompanies.size,
           estimatedRevenue: estimatedRev,
           pendingViandas: pendingViandas
        })

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
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-10">
        <div>
          <h2 className="text-5xl font-bold tracking-tighter text-slate-900 uppercase italic">
            Monitor de Control <span className="text-indigo-600">360°</span>
          </h2>
          <p className="text-2xl text-slate-500 font-medium mt-2">Visión estratégica de ventas y planificación logística semanal.</p>
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

      <div className="grid gap-8">
         {/* CHART 1: FUTURO (AHORA OCUPA TODO EL ANCHO SI ES NECESARIO O SE AJUSTA) */}
      <div className="bg-white rounded-[3rem] border border-slate-200 p-10 md:p-14 shadow-xl shadow-slate-200/50">
        <div className="mb-12">
          <h3 className="text-4xl font-bold text-slate-900 tracking-tighter flex items-center gap-4">
            <TrendingUp className="text-indigo-600" size={40} /> 
            Efectividad de Próximos Shows
          </h3>
          <p className="text-xl text-slate-500 font-medium mt-2">Seguimiento de ventas real vs. proyección para planificación de compras.</p>
        </div>
        
        <div className="space-y-16">
          <SectionView 
            title="Esta Semana" 
            shows={upcoming10Days} 
            subtitle="Hoy — Domingo" 
            total_projected={upcoming10Days.reduce((acc, curr) => acc + curr.projected, 0)}
            total_adjusted={upcoming10Days.reduce((acc, curr) => acc + curr.projected, 0)} // Note: in dashboard projected is already adjusted
            accentColor="emerald"
            footerTitle="Planificación de Compras"
            footerLabel="PAX AJUSTADOS"
          />
          
          <SectionView 
            title="Próxima Semana" 
            shows={upcomingCharts} 
            subtitle="Lunes — Domingo"
            total_projected={upcomingCharts.reduce((acc, curr) => acc + curr.projected, 0)}
            total_adjusted={upcomingCharts.reduce((acc, curr) => acc + curr.projected, 0)}
            accentColor="indigo"
            footerTitle="Previsión Logística"
            footerLabel="PAX ESTIMADOS"
          />
        </div>
      </div>

         {/* RADAR: PRÓXIMAS FECHAS (GRID DE TARJETAS SOLICITADO) */}
         <div>
            <div className="flex items-center justify-between mb-6 px-2">
               <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-800">Radar: Próximas Fechas</h3>
                  <p className="text-xs text-slate-500 font-medium">Logística de despachos por venir (Tarjetas dinámicas)</p>
               </div>
               <Link href="/settings/eventos" className="text-indigo-600 text-xs font-black uppercase tracking-widest hover:text-indigo-500 transition">
                  Ver Gestión Maestra →
               </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {upcoming10Days.length === 0 && (
                  <p className="col-span-full text-slate-400 text-center text-sm py-12 italic font-medium bg-white rounded-[2rem] border border-dashed border-slate-300">Sin elementos activos.</p>
               )}
               {upcoming10Days.map((ev, i) => (
                  <Link key={i} href={`/events/${ev.id}`} className="group relative flex gap-4 items-center bg-white p-5 rounded-[2rem] border border-slate-200 hover:border-indigo-400 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1">
                     <div className="bg-slate-900 px-4 py-3 rounded-2xl text-center border border-slate-800 group-hover:bg-indigo-600 transition-colors shrink-0">
                        <p className="text-[10px] font-black uppercase text-indigo-400 group-hover:text-indigo-100 transition-colors">{new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}</p>
                        <p className="text-xl font-black tabular-nums text-white">{new Date(ev.date + 'T12:00:00').getDate()}</p>
                     </div>
                     <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-800 text-sm tracking-tight line-clamp-1 group-hover:text-indigo-600 transition-colors uppercase italic">{ev.show}</h4>
                        <p className="text-[10px] uppercase text-slate-400 font-bold truncate flex items-center gap-1 mt-1">
                           <MapPin size={10} className="text-indigo-400"/> {ev.venue}
                        </p>
                     </div>
                     <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                        <ChevronRight size={16} />
                     </div>
                  </Link>
               ))}
            </div>
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

// --- Helper Components for the Dashboard Overhaul ---

function SectionView({ title, shows, subtitle, total_projected, total_adjusted, accentColor, footerTitle, footerLabel }: any) {
  if (shows.length === 0) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b-4 border-slate-100 pb-4">
         <h4 className="text-2xl font-bold text-slate-400 uppercase tracking-widest italic">{title}</h4>
         <span className="text-xs font-bold text-slate-300 bg-slate-50 px-4 py-1.5 rounded-full uppercase tracking-[0.2em]">{subtitle}</span>
      </div>
      <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
         <p className="text-slate-400 font-bold uppercase tracking-widest italic">Sin eventos programados</p>
      </div>
    </div>
  )

  const colorMap: any = {
    emerald: { border: 'border-emerald-100', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    indigo: { border: 'border-indigo-100', text: 'text-indigo-700', bg: 'bg-indigo-50' }
  }
  const colors = colorMap[accentColor] || colorMap.indigo

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-slate-100 pb-4 gap-4">
         <div className="flex items-center gap-4">
            <h4 className={`text-2xl font-black ${colors.text} uppercase tracking-tight italic`}>{title}</h4>
            <span className={`text-[10px] font-black ${colors.bg} ${colors.text} px-3 py-1 rounded-full uppercase tracking-widest`}>{subtitle}</span>
         </div>
         <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previsión de Compra</p>
              <p className={`text-xl font-black ${colors.text} tabular-nums`}>{total_adjusted} PAX</p>
            </div>
         </div>
      </div>
      
      <div className="space-y-6">
        {shows.map((show: any, i: number) => (
          <EffectivenessCard key={i} show={show} />
        ))}
      </div>

      <div className="pt-4">
         <div className={`${accentColor === 'emerald' ? 'bg-slate-900' : 'bg-indigo-600'} p-8 rounded-[2.5rem] text-center shadow-xl relative overflow-hidden group`}>
            <div className="absolute top-4 right-6 opacity-20 group-hover:opacity-40 transition-opacity">
              <TrendingUp className="text-white" size={32} />
            </div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mb-2">{footerTitle}</p>
            <p className="text-white text-4xl font-black tabular-nums">
              {total_adjusted} <span className="text-white/40 text-lg uppercase tracking-widest ml-2">{footerLabel}</span>
            </p>
            <p className="text-[10px] text-white/40 font-medium italic mt-2 uppercase tracking-widest">
              * Ajustado por factor de conversión por cliente
            </p>
         </div>
      </div>
    </div>
  )
}

function EffectivenessCard({ show }: { show: any }) {
  const evDate = new Date(show.date + 'T12:00:00')
  const day = evDate.getDate()
  const month = evDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.','')
  const today = new Date().toISOString().split('T')[0]
  
  const statusColors: any = {
    ejecutado: 'bg-indigo-600 text-white border-indigo-700',
    cancelado: 'bg-red-50 text-red-700 border-red-100',
    confirmado: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    pendiente: 'bg-amber-50 text-amber-900 border-amber-200'
  }
  const cls = statusColors[show.status?.toLowerCase()] || 'bg-slate-50 text-slate-600'

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all relative">
      <div className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
        
        {/* 1. Date Block */}
        <div className="flex flex-row md:flex-col items-center justify-center bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shrink-0 min-w-[80px]">
          <span className="text-2xl font-black text-slate-900 tabular-nums leading-none">{day}</span>
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest md:mt-1">{month}</span>
        </div>

        {/* 2. Show & Venue */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter truncate leading-tight group-hover:text-indigo-600 transition-colors">
            {show.show}
          </h3>
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{show.venue}</span>
          </div>
        </div>

        {/* 3. Metrics */}
        <div className="flex items-center gap-8 px-6 py-3 bg-slate-50/50 rounded-2xl border border-slate-100/50 shrink-0">
          {show.sold > 0 && (
             <>
             <div className="text-center">
               <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Ventas</p>
               <p className="text-lg font-black text-emerald-600 tabular-nums">{show.sold}</p>
             </div>
             <div className="h-6 w-px bg-slate-200" />
             </>
          )}
          <div className="text-center">
            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Ajustado</p>
            <p className="text-lg font-black text-indigo-600 tabular-nums">{show.projected}</p>
          </div>
        </div>

        {/* 4. Status */}
        <div className="shrink-0 md:min-w-[120px] text-center">
          <span className={`inline-block w-full text-[9px] font-black px-4 py-2.5 rounded-xl border uppercase tracking-[0.2em] ${cls}`}>
            {show.status}
          </span>
        </div>

        {/* 5. Today Badge */}
        {show.date === today && (
           <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
             ¡HOY!
           </div>
        )}
      </div>
    </div>
  )
}