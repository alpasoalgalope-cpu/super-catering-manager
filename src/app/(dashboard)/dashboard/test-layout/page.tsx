"use client"

import React, { useEffect, useState } from "react"
import DashboardCard from "@/components/ui/DashboardCard"
import { Users, Calendar, DollarSign, Activity, Loader2, TrendingUp, History, MapPin, Building2, ChevronRight, Truck, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
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

export default function DashboardTestPage() {
  const supabase = createClient()
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
  const [incomingPOs, setIncomingPOs] = useState<any[]>([])

  useEffect(() => {
     const bootstrapDashboard = async () => {
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
           if (user.email === 'fschottenfeld@gmail.com') setRole('admin')
           else if (user.email === 'cocina@supercatering.com' || user.email === 'alpaso.algalope@gmail.com') setRole('cocina')
           else setRole(user.app_metadata?.role || user.user_metadata?.role || 'cocina')
         }

         // Fetch Pending Purchase Orders
         const { data: poData, error: poErr } = await supabase
            .from('purchase_orders')
            .select(`
               id,
               fecha_esperada,
               costo_total,
               estado,
               proveedores (nombre),
               purchase_order_items (
                 cantidad,
                 productos (nombre, unidad_medida)
               )
            `)
            .eq('estado', 'PENDIENTE')
            .order('fecha_esperada', { ascending: true })

         if (poErr) {
            console.error("Dashboard PO fetch error:", poErr)
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
        setFutureByCompany(Object.keys(futCompanyAggr).map(name => ({name, projected: futCompanyAggr[name]})))

         // Filter pending POs for this week and overdue
         const filteredPOs = poData ? poData.filter((po: any) => {
            if (!po.fecha_esperada) return false
            const poDate = new Date(po.fecha_esperada + 'T12:00:00')
            // Show if it is overdue (before today) OR if it is within this week
            return poDate <= endOfThisWeek
         }) : []
         
         setIncomingPOs(filteredPOs)

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

  const today = new Date()
  const todayDate = new Date(today)
  todayDate.setHours(0,0,0,0)

  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Estilos locales para inyectar CSS que oculte barras de scroll nativas en paneles verticales */}
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>

      {/* Header Superior con Jerarquía Tipográfica y Botón de Retorno */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 mb-8">
        <div>
          <h2 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 uppercase leading-none">
            {role === 'cocina' ? 'Planificación de' : 'Monitor de Control'} <span className="text-indigo-600 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 font-extrabold italic">{role === 'cocina' ? 'Producción' : '360°'}</span>
          </h2>
          <p className="text-xl md:text-2xl text-slate-500 font-medium mt-3">
            {role === 'cocina' 
              ? 'Seguimiento de PAX y necesidades de cocina para las próximas semanas.' 
              : 'Visión estratégica de ventas y planificación logística semanal.'}
          </p>
        </div>
        <Link href="/dashboard" className="self-start xl:self-center bg-slate-900 hover:bg-indigo-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all duration-300 shadow-md shadow-slate-200">
          Volver a Producción
        </Link>
      </div>

      {/* Tarjetas de Accesos Rápidos / Métricas en Header con Micro-interacciones */}
      <div className={`grid grid-cols-2 ${role === 'cocina' ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-6 mb-10`}>
        {/* Métrica 1: Shows Activos */}
        <div className="bg-white hover:bg-indigo-50/20 border border-slate-200 hover:border-indigo-300 rounded-[2.5rem] p-6 transition-all duration-300 group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/50 flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 group-hover:bg-indigo-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-indigo-200 shrink-0 shadow-sm transition-all duration-300">
            <Calendar className="text-slate-500 group-hover:text-indigo-600 transition-colors" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Shows Activos</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-indigo-900 transition-colors leading-none">{metrics.eventCount}</p>
          </div>
        </div>

        {/* Métrica 2: Empresas Activas */}
        <div className="bg-white hover:bg-emerald-50/20 border border-slate-200 hover:border-emerald-300 rounded-[2.5rem] p-6 transition-all duration-300 group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-100/50 flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 group-hover:bg-emerald-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-emerald-200 shrink-0 shadow-sm transition-all duration-300">
            <Building2 className="text-slate-500 group-hover:text-emerald-600 transition-colors" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Clientes Activos</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-emerald-900 transition-colors leading-none">{metrics.activeCompanies}</p>
          </div>
        </div>

        {/* Métrica 3: Previsión Financiera */}
        {role !== 'cocina' && (
          <div className="bg-white hover:bg-amber-50/20 border border-slate-200 hover:border-amber-300 rounded-[2.5rem] p-6 transition-all duration-300 group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-100/50 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 group-hover:bg-amber-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-amber-200 shrink-0 shadow-sm transition-all duration-300">
              <DollarSign className="text-slate-500 group-hover:text-amber-600 transition-colors" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Previsión Ventas</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-amber-900 transition-colors leading-none">{formatCurrency(metrics.estimatedRevenue)}</p>
            </div>
          </div>
        )}

        {/* Métrica 4: Viandas Pendientes */}
        <div className="bg-white hover:bg-purple-50/20 border border-slate-200 hover:border-purple-300 rounded-[2.5rem] p-6 transition-all duration-300 group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100/50 flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 group-hover:bg-purple-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-purple-200 shrink-0 shadow-sm transition-all duration-300">
            <Activity className="text-slate-500 group-hover:text-purple-600 transition-colors" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Viandas Pendientes</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-purple-900 transition-colors leading-none">{metrics.pendingViandas}</p>
          </div>
        </div>
      </div>

      {/* Grid General con Dos Columnas Estables (Sin Scroll Horizontal en ningún caso) */}
      <div className="grid lg:grid-cols-3 gap-8 items-start">
         
         {/* COLUMNA 1 y 2: SHOWS PRÓXIMAS SEMANAS (2/3 de ancho) */}
         <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-200 p-10 md:p-14 shadow-xl shadow-slate-200/50">
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
               total_adjusted={upcoming10Days.reduce((acc, curr) => acc + curr.projected, 0)}
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

         {/* COLUMNA 3: MERCADERÍA A RECIBIR (1/3 de ancho) */}
         <div className="lg:col-span-1 bg-white rounded-[3rem] border border-slate-200 p-10 md:p-14 shadow-xl shadow-slate-200/50">
           <div className="mb-8">
             <h3 className="text-3xl font-bold text-slate-900 tracking-tighter flex items-center gap-3">
               <Truck className="text-indigo-600 animate-pulse" size={32} /> 
               Recibir esta Semana
             </h3>
             <p className="text-sm text-slate-500 font-medium mt-2">Calendario de mercadería a recibir de proveedores.</p>
           </div>
           
           {/* Contenedor con scroll vertical limpio para entregas de mercadería */}
           <div className="relative group/scroll-po">
              <div className="space-y-6 max-h-[780px] overflow-y-auto pr-2 scrollbar-none scroll-smooth pb-10">
                 {incomingPOs.length === 0 ? (
                    <div className="py-20 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                       <Package className="mx-auto text-slate-300 mb-4" size={40} />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sin entregas pendientes</p>
                    </div>
                 ) : (
                    incomingPOs.map((po, index) => {
                       const poDate = new Date(po.fecha_esperada + 'T12:00:00')
                       const isOverdue = poDate < todayDate
                       const isPoToday = po.fecha_esperada === today.toISOString().split('T')[0]
                       
                       const weekday = poDate.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '')
                       const dayNum = poDate.getDate()
                       const monthName = poDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '')
                       
                       return (
                          <div 
                             key={po.id} 
                             className={`p-6 rounded-[2rem] border transition-all duration-300 relative hover:shadow-md ${
                                isPoToday 
                                   ? 'border-emerald-400 bg-emerald-50/10 ring-2 ring-emerald-50' 
                                   : isOverdue 
                                      ? 'border-rose-300 bg-rose-50/10' 
                                      : 'border-slate-200 hover:border-indigo-300 bg-white shadow-sm'
                             }`}
                          >
                             <div className="flex justify-between items-start gap-3">
                                <div className="flex gap-4">
                                   <div className={`flex flex-col items-center justify-center w-12 h-14 rounded-2xl border text-center shrink-0 ${
                                      isPoToday 
                                         ? 'bg-emerald-500 border-emerald-600 text-white' 
                                         : isOverdue 
                                            ? 'bg-rose-500 border-rose-600 text-white' 
                                            : 'bg-slate-50 border-slate-100 text-slate-700'
                                   }`}>
                                      <span className="text-[10px] font-black leading-none">{weekday}</span>
                                      <span className="text-base font-black leading-none mt-1">{dayNum}</span>
                                   </div>
                                   
                                   <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                         {isOverdue && (
                                            <span className="bg-rose-100 text-rose-800 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                               Atrasado
                                            </span>
                                         )}
                                         {isPoToday && (
                                            <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                               Hoy
                                            </span>
                                         )}
                                         <span className="text-[9px] font-bold text-slate-400">
                                            {monthName}
                                         </span>
                                      </div>
                                      
                                      <h4 className="font-black text-slate-800 text-base uppercase mt-1 leading-tight">
                                         {po.proveedores?.nombre || 'Proveedor Eliminado'}
                                      </h4>
                                   </div>
                                </div>
                             </div>
                             
                             <div className="mt-4 pt-3 border-t border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Insumos Solicitados:</p>
                                <ul className="space-y-1">
                                   {po.purchase_order_items?.map((item: any, idx: number) => (
                                      <li key={idx} className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                         <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                         <span className="font-black text-indigo-700 tabular-nums">{item.cantidad} {item.productos?.unidad_medida || 'un'}</span>
                                         <span className="truncate max-w-[150px]">{item.productos?.nombre}</span>
                                      </li>
                                   ))}
                                </ul>
                             </div>
                             
                             <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Costo Est.</span>
                                <span className="text-xs font-black text-slate-800 tabular-nums">{formatCurrency(po.costo_total)}</span>
                             </div>
                          </div>
                       )
                    })
                 )}
              </div>
              {/* Gradiente sutil indicador al final de la columna scrollable */}
              <div className="absolute left-0 right-2 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none opacity-90" />
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
      <h3 className="text-xl font-black mt-16 mb-4 px-2 text-indigo-800 flex items-center gap-2"><TrendingUp size={20}/> Proyecciones Futuras (Estadío / Empresa / Mes)</h3>
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
      
      {/* Listado Vertical en base a una cuadrícula pura (Zero Scroll Horizontal) */}
      <div className="space-y-12">
        {Object.values(shows.reduce((acc: any, s: any) => {
           if (!acc[s.date]) acc[s.date] = { date: s.date, shows: [], totalPax: 0, totalAdjusted: 0 }
           acc[s.date].shows.push(s)
           acc[s.date].totalAdjusted += s.projected
           s.projections?.forEach((p: any) => acc[s.date].totalPax += p.pax)
           return acc
        }, {})).map((group: any, i: number) => {
           const evDate = new Date(group.date + 'T12:00:00')
           const dateStr = evDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
           return (
              <div key={i} className="space-y-6">
                 {/* Cabecera de la Jornada */}
                 <div className="flex items-center gap-4 px-2">
                    <div className="h-px bg-indigo-100 flex-1"></div>
                    <div className="flex flex-col items-center">
                       <span className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em]">{dateStr}</span>
                       <span className="text-[11px] font-black uppercase text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full mt-1 border border-indigo-100 shadow-sm">
                          {group.shows.length > 1 ? 'TOTAL DE LA JORNADA' : 'DETALLE DE LA JORNADA'}: {group.totalPax} PAX Estimados | {group.totalAdjusted} PAX Ajustados
                       </span>
                    </div>
                    <div className="h-px bg-indigo-100 flex-1"></div>
                 </div>
                 
                 {/* Cuadrícula Adaptativa Dinámica: 1 columna si hay un solo show, 2 columnas en pantallas medianas si hay más */}
                 <div className={`grid grid-cols-1 ${group.shows.length > 1 ? 'md:grid-cols-2' : ''} gap-6`}>
                    {group.shows.map((show: any, j: number) => (
                      <EffectivenessCard key={j} show={show} role={role} />
                    ))}
                 </div>
              </div>
           )
        })}
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
  const weekday = evDate.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '')
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
    <div className={`block bg-white rounded-[2.5rem] border shadow-sm hover:shadow-lg transition-all duration-300 relative flex flex-col justify-between h-full p-6
      ${isToday ? 'border-emerald-400 ring-4 ring-emerald-50 scale-[1.01] z-20 shadow-xl' : 'border-slate-200 hover:border-indigo-400'}
    `}>
      {/* Fila Superior: Badge del Día y Estado */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border text-center shrink-0 ${
             isToday ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
          }`}>
             <span className="text-[9px] font-black leading-none uppercase">{weekday}</span>
             <span className="text-base font-black leading-none mt-0.5">{day}</span>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{month}</span>
        </div>
        
        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest shadow-sm ${cls}`}>
          {show.status}
        </span>
      </div>

      {/* Título & Sede */}
      <div className="space-y-2 mb-6">
        <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 truncate leading-tight group-hover:text-indigo-600 transition-colors">
          {show.show}
        </h3>
        <div className="flex items-center gap-1.5 text-slate-500">
          <MapPin size={12} className={isToday ? "text-emerald-500" : "text-slate-400"} />
          <span className="text-[10px] font-black uppercase tracking-wider">{show.venue}</span>
        </div>
      </div>

      {/* Coordinadores (Hoy Solamente) */}
      {isToday && show.coordinators && show.coordinators.length > 0 && (
        <div className="mb-6 p-4 bg-emerald-50/50 rounded-[1.5rem] border border-emerald-100 space-y-2">
          {show.coordinators.map((c: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <Users size={12} className="text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-700">{c.name} ({c.company}):</span>
              <span className="text-slate-500 font-medium">{c.phone}</span>
            </div>
          ))}
        </div>
      )}

      {/* Micro-Dashboard Interno de PAX y Costos */}
      <div className="bg-slate-50/60 border border-slate-100 rounded-3xl p-5 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {show.sold > 0 && (
            <div>
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Ventas</p>
              <p className="text-xl font-black text-emerald-600 tabular-nums">{show.sold}</p>
            </div>
          )}
          <div>
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Ajustado</p>
            <p className="text-xl font-black text-indigo-600 tabular-nums">{show.projected}</p>
          </div>
        </div>

        {role && role !== 'cocina' && (
          <div className="pt-3 border-t border-slate-200/60">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Facturación Est.</p>
            <p className="text-lg font-black text-slate-700 tabular-nums">{formatCurrencyLocal(show.revenue)}</p>
          </div>
        )}

        {/* Desglose de Proyecciones de Clientes */}
        {show.projections && show.projections.length > 0 && (
          <div className="pt-3 border-t border-slate-200/60 space-y-1.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresas (PAX → Venta)</p>
            <div className="flex flex-wrap gap-2">
              {show.projections.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1 bg-white border border-slate-200/60 px-3 py-1 rounded-xl shadow-xs text-[10px] font-bold">
                  <span className="text-slate-500 font-medium truncate max-w-[100px]">{p.company}:</span>
                  <span className="text-slate-800 font-black">{p.pax}→{p.adjusted}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botones de Acción */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <Link href={`/settings/eventos?eventId=${show.id}`} className="w-full text-center text-[9px] font-black bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl uppercase tracking-widest transition-all border border-slate-200">
          Gestión
        </Link>
        <Link href={`/ventas-evento?eventId=${show.id}`} className="w-full text-center text-[9px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-3 rounded-xl uppercase tracking-widest transition-all border border-indigo-100 shadow-sm">
          Ventas
        </Link>
      </div>

      {/* Etiqueta de Hoy */}
      {isToday && (
        <div className="absolute -top-2 right-6 bg-emerald-500 text-white text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-[0.2em] shadow-md animate-pulse">
          ¡HOY!
        </div>
      )}
    </div>
  )
}
