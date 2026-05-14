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
   coordinators?: {
      name: string
      phone: string
      company: string
   }[]
   projections?: {
      company: string
      pax: number
      adjusted: number
   }[]
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  
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

  // Future Analysis (Projections)
  const [futureByMonth, setFutureByMonth] = useState<{name: string, projected: number}[]>([])
  const [futureByVenue, setFutureByVenue] = useState<{name: string, projected: number}[]>([])
  const [futureByCompany, setFutureByCompany] = useState<{name: string, projected: number}[]>([])

  useEffect(() => {
     const bootstrapDashboard = async () => {
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
           if (user.email === 'fschottenfeld@gmail.com') setRole('admin')
           else if (user.email === 'cocina@supercatering.com' || user.email === 'alpaso.algalope@gmail.com') setRole('cocina')
           else setRole(user.app_metadata?.role || user.user_metadata?.role || 'cocina')
        }

        // 1. Fetch ALL Events Master (To capture History and Future)
        const { data: masters, error } = await supabase
           .from("events_master")
            .select(`
               id, event_date, show_name, status,
               venues (name),
               event_projections (
                  id, 
                  company_name, 
                  projected_pax
               ),
               event_bus_assignments (
                 id,
                 coordinators (id, name, phone, company)
               )
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

        // 2.5 Fetch Clients for Conversion Factors & Rules
        const [ { data: clientsData }, { data: rulesData } ] = await Promise.all([
           supabase.from("clients").select("name, conversion_factor"),
           supabase.from("commercial_rules").select("*")
        ])

        const conversionMap: Record<string, number> = {}
        clientsData?.forEach(c => {
           const key = c.name?.trim().toLowerCase()
           if (key) conversionMap[key] = Number(c.conversion_factor) || 1.0
        })

        const rulesMap: Record<string, any> = {}
        rulesData?.forEach(r => {
           const key = r.company_name?.trim().toLowerCase()
           if (key) rulesMap[key] = r
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
           
           // Calculate Adjusted Projection and Projected Revenue
           let totalAdjustedProj = 0
           let totalProjectedRev = 0
           const projections: {company: string, pax: number, adjusted: number}[] = []

           m.event_projections?.forEach((p: any) => {
              const compKey = p.company_name?.trim().toLowerCase()
              const factor = conversionMap[compKey] || 1.0
              const rule = rulesMap[compKey]
              
              const basePax = Number(p.projected_pax) || 0
              const adjustedSales = basePax * factor
              totalAdjustedProj += adjustedSales

              projections.push({
                 company: p.company_name,
                 pax: basePax,
                 adjusted: Math.round(adjustedSales)
              })
              
              if (rule) {
                 // Formula solicitada: PAX Ajustado * Precio Base (Sin restar liberados, costeando el 100%)
                 totalProjectedRev += adjustedSales * (Number(rule.price_base) || 0)
              }
           })

           const vName = (m.venues as any)?.name || (m.venues as any)?.[0]?.name || "-"

           if (!venueAggr[vName]) venueAggr[vName] = 0
           venueAggr[vName] += eSold

            const coordinators: {name: string, phone: string, company: string}[] = []
            m.event_bus_assignments?.forEach((ba: any) => {
               if (ba.coordinators) {
                  coordinators.push({
                     name: ba.coordinators.name,
                     phone: ba.coordinators.phone,
                     company: ba.coordinators.company
                  })
               }
            })

            return {
               id: m.id,
               date: m.event_date,
               show: m.show_name,
               status: (m.status || "").toLowerCase(),
               venue: vName,
               projected: Math.round(totalAdjustedProj),
               sold: eSold,
               revenue: eRev > 0 ? eRev : totalProjectedRev,
               coordinators,
               projections
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

        // FUTURE ANALYSIS CALCULATIONS
        const monthAggr: Record<string, number> = {}
        const futVenueAggr: Record<string, number> = {}
        const futCompanyAggr: Record<string, number> = {}

        futureEvs.forEach(ev => {
           const d = new Date(ev.date + 'T12:00:00')
           const mName = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase()
           monthAggr[mName] = (monthAggr[mName] || 0) + ev.projected
           
           futVenueAggr[ev.venue] = (futVenueAggr[ev.venue] || 0) + ev.projected

           const m = masters.find(mast => mast.id === ev.id)
           m?.event_projections?.forEach((p: any) => {
              const compKey = p.company_name?.trim().toLowerCase()
              const factor = conversionMap[compKey] || 1.0
              const adjusted = (Number(p.projected_pax) || 0) * factor
              futCompanyAggr[p.company_name] = (futCompanyAggr[p.company_name] || 0) + Math.round(adjusted)
           })
        })

        setFutureByMonth(Object.keys(monthAggr).map(name => ({name, projected: monthAggr[name]})))
        setFutureByVenue(Object.keys(futVenueAggr).map(name => ({name, projected: futVenueAggr[name]})).sort((a,b) => b.projected - a.projected))
        setFutureByCompany(Object.keys(futCompanyAggr).map(name => ({name, projected: futCompanyAggr[name]})).sort((a,b) => b.projected - a.projected))

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

      <div className="grid gap-8">
         {/* CHART 1: FUTURO (AHORA OCUPA TODO EL ANCHO SI ES NECESARIO O SE AJUSTA) */}
      <div className="bg-white rounded-[3rem] border border-slate-200 p-10 md:p-14 shadow-xl shadow-slate-200/50">
        <div className="mb-12">
          <h3 className="text-4xl font-bold text-slate-900 tracking-tighter flex items-center gap-4">
            <TrendingUp className="text-indigo-600" size={40} /> 
            Shows Próximas Semanas
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
            total_revenue={upcoming10Days.reduce((acc, curr) => acc + curr.revenue, 0)}
            accentColor="emerald"
            footerTitle="Planificación de Compras"
            footerLabel="PAX AJUSTADOS"
            role={role}
          />
          
          <SectionView 
            title="Próxima Semana" 
            shows={upcomingCharts} 
            subtitle="Lunes — Domingo"
            total_projected={upcomingCharts.reduce((acc, curr) => acc + curr.projected, 0)}
            total_adjusted={upcomingCharts.reduce((acc, curr) => acc + curr.projected, 0)}
            total_revenue={upcomingCharts.reduce((acc, curr) => acc + curr.revenue, 0)}
            accentColor="indigo"
            footerTitle="Previsión Logística"
            footerLabel="PAX ESTIMADOS"
            role={role}
          />
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
                        {role !== 'cocina' && (
                           <span className="text-[10px] font-black text-emerald-600">{formatCurrency(ev.revenue)}</span>
                        )}
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

      {/* FUTURE ANALYSIS SECTION */}
      <h3 className="text-xl font-black mt-16 mb-4 px-2 text-indigo-800 flex items-center gap-2"><TrendingUp size={20}/> Análisis de Proyecciones Futuras (Estadío / Empresa / Mes)</h3>
      <div className="grid gap-8 lg:grid-cols-3 items-start pb-10">
         
         {/* FUTURE BY MONTH */}
         <div className="bg-indigo-50/30 border border-indigo-100 p-6 rounded-[2rem]">
            <h4 className="font-black text-[10px] text-indigo-400 uppercase tracking-widest mb-6">Proyección por Mes</h4>
            <div className="space-y-4">
               {futureByMonth.length === 0 && <p className="text-xs font-bold text-slate-400 text-center py-10">Sin proyecciones futuras.</p>}
               {futureByMonth.map((m, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm">
                     <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{m.name}</p>
                     <p className="text-2xl font-black text-indigo-900 tabular-nums">{m.projected} <span className="text-[10px] text-indigo-400 uppercase tracking-widest ml-1">PAX Total</span></p>
                  </div>
               ))}
            </div>
         </div>

         {/* FUTURE BY VENUE */}
         <div className="bg-white border border-slate-200 p-6 rounded-[2rem]">
            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-6">Top Sedes (Proyectado)</h4>
            <div className="space-y-4">
               {futureByVenue.slice(0, 8).map((v, i) => {
                  const maxVal = futureByVenue[0]?.projected || 1
                  const pct = (v.projected / maxVal) * 100
                  return (
                     <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="text-slate-600 truncate max-w-[150px]">{v.name}</span>
                           <span className="text-indigo-600">{v.projected} PAX</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                     </div>
                  )
               })}
            </div>
         </div>

         {/* FUTURE BY COMPANY */}
         <div className="bg-white border border-slate-200 p-6 rounded-[2rem]">
            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-6">Top Empresas (Proyectado)</h4>
            <div className="space-y-4">
               {futureByCompany.slice(0, 8).map((c, i) => {
                  const maxVal = futureByCompany[0]?.projected || 1
                  const pct = (c.projected / maxVal) * 100
                  return (
                     <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="text-slate-600 truncate max-w-[150px]">{c.name}</span>
                           <span className="text-indigo-600">{c.projected} PAX</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                     </div>
                  )
               })}
            </div>
         </div>

      </div>
    </div>
  )
}

// --- Helper Components for the Dashboard Overhaul ---

const formatCurrencyLocal = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

function SectionView({ title, shows, subtitle, total_projected, total_adjusted, total_revenue, accentColor, footerTitle, footerLabel, role }: any) {
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
          <EffectivenessCard key={i} show={show} role={role} />
        ))}
      </div>

      <div className="pt-4">
         <div className={`${accentColor === 'emerald' ? 'bg-slate-900' : 'bg-indigo-600'} p-8 rounded-[2.5rem] text-center shadow-xl relative overflow-hidden group`}>
            <div className="absolute top-4 right-6 opacity-20 group-hover:opacity-40 transition-opacity">
              <TrendingUp className="text-white" size={32} />
            </div>
            <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
               <div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mb-2">{footerTitle}</p>
                  <p className="text-white text-4xl font-black tabular-nums">
                    {total_adjusted} <span className="text-white/40 text-lg uppercase tracking-widest ml-1">{footerLabel}</span>
                  </p>
               </div>
               {role !== 'cocina' && (
                 <>
                   <div className="hidden md:block w-px h-16 bg-white/20"></div>
                   <div className="w-full md:hidden h-px bg-white/20"></div>
                   <div>
                      <p className="text-emerald-400/80 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Total a Facturar</p>
                      <p className="text-emerald-400 text-4xl font-black tabular-nums">
                        {formatCurrencyLocal(total_revenue)}
                      </p>
                   </div>
                 </>
               )}
            </div>
            <p className="text-[10px] text-white/40 font-medium italic mt-6 uppercase tracking-widest">
              * PAX Ajustado por factor de conversión por cliente
            </p>
         </div>
      </div>
    </div>
  )
}

function EffectivenessCard({ show, role }: { show: any, role: string | null }) {
  const evDate = new Date(show.date + 'T12:00:00')
  const day = evDate.getDate()
  const month = evDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.','')
  const today = new Date().toISOString().split('T')[0]
  const isToday = show.date === today
  
  const statusColors: any = {
    ejecutado: 'bg-indigo-600 text-white border-indigo-700',
    cancelado: 'bg-red-50 text-red-700 border-red-100',
    confirmado: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    pendiente: 'bg-amber-50 text-amber-900 border-amber-200'
  }
  const cls = statusColors[show.status?.toLowerCase()] || 'bg-slate-50 text-slate-600'

  return (
    <Link href={`/ventas-evento?eventId=${show.id}`} className={`block bg-white rounded-[2.5rem] border shadow-sm overflow-hidden group transition-all relative cursor-pointer
      ${isToday ? 'border-emerald-400 ring-4 ring-emerald-50 scale-[1.02] shadow-xl z-20' : 'border-slate-200 hover:shadow-md hover:border-indigo-400'}
    `}>
      <div className={`p-6 flex flex-col gap-6 ${isToday ? '' : 'md:flex-row md:items-center'}`}>
        
        <div className="flex items-center gap-6 flex-1">
          {/* 1. Date Block */}
          <div className={`flex flex-col items-center justify-center px-6 py-4 rounded-3xl border shrink-0 min-w-[90px]
            ${isToday ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}
          `}>
            <span className="text-3xl font-black tabular-nums leading-none">{day}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isToday ? 'text-white/80' : 'text-indigo-500'}`}>{month}</span>
          </div>

          {/* 2. Show & Venue */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <h3 className={`text-2xl font-black uppercase italic tracking-tighter truncate leading-tight group-hover:text-indigo-600 transition-colors ${isToday ? 'text-slate-900' : 'text-slate-900'}`}>
              {show.show}
            </h3>
            <div className="flex items-center gap-2">
              <MapPin size={14} className={isToday ? "text-emerald-500" : "text-slate-400"} />
              <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-emerald-700' : 'text-slate-500'}`}>{show.venue}</span>
            </div>
          </div>
        </div>

        {/* 3. Logistics Info (Today Only) */}
        {isToday && show.coordinators && show.coordinators.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-emerald-50/50 rounded-[1.5rem] border border-emerald-100">
            {show.coordinators.map((c: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Coordinador — {c.company}</p>
                  <p className="text-sm font-bold text-slate-800">{c.name}</p>
                  <p className="text-xs font-medium text-slate-500">{c.phone}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-6 mt-auto md:mt-0">
          {/* 4. Metrics */}
          <div className="flex items-center gap-8 px-8 py-4 bg-slate-50/50 rounded-3xl border border-slate-100/50 shrink-0 group-hover:bg-indigo-50/50 transition-colors">
            {show.sold > 0 && (
              <>
              <div className="text-center">
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Ventas</p>
                <p className="text-xl font-black text-emerald-600 tabular-nums">{show.sold}</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              </>
            )}
            <div className="text-center">
              <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Ajustado</p>
              <p className="text-xl font-black text-indigo-600 tabular-nums">{show.projected}</p>
            </div>
            {role !== 'cocina' && (
              <>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Facturación Est.</p>
                  <p className="text-xl font-black text-slate-700 tabular-nums">{formatCurrencyLocal(show.revenue)}</p>
                </div>
              </>
            )}
          </div>

          {/* 4b. Company Breakdown (Cocina Only) */}
          {role === 'cocina' && show.projections && show.projections.length > 0 && (
            <div className="flex flex-wrap gap-2 max-w-md">
              {show.projections.map((p: any, idx: number) => (
                <div key={idx} className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl flex flex-col items-center">
                  <p className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter leading-none mb-1">{p.company}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-slate-400">{p.pax}</span>
                    <span className="text-[10px] font-black text-indigo-600">→ {p.adjusted}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 5. Status */}
          <div className="shrink-0 min-w-[140px] text-center">
            <span className={`inline-block w-full text-xs font-black px-6 py-3 rounded-2xl border uppercase tracking-[0.2em] shadow-sm ${cls}`}>
              {show.status}
            </span>
          </div>
        </div>

        {/* Today Badge */}
        {isToday && (
          <div className="absolute top-4 right-6 bg-emerald-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-[0.2em] shadow-lg animate-pulse">
            ¡HOY!
          </div>
        )}
      </div>
    </Link>
  )
}