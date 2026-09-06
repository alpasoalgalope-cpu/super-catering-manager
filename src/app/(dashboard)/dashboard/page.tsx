"use client";

import MonthlyScheduleCalendar from "@/components/dashboard/MonthlyScheduleCalendar";
import React, { useEffect, useState } from "react"
import DashboardCard from "@/components/ui/DashboardCard"
import { 
  Users, Calendar, DollarSign, Activity, Loader2, TrendingUp, TrendingDown, 
  History, MapPin, Building2, ChevronRight, Truck, Package, Copy, FileText, 
  CheckCircle2, Sparkles, Camera, ExternalLink, MessageCircle, ShoppingBag, 
  Store, Check, Bus, Send, Share2, User
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import ReceivePOModal from "@/components/inventory/ReceivePOModal"
import WeeklyBriefingModal from "@/components/dashboard/ai/WeeklyBriefingModal"
import RemitoOCRModal from "@/components/dashboard/ai/RemitoOCRModal"
import FinancialDiagnosisModal from "@/components/dashboard/ai/FinancialDiagnosisModal"
import EventProductionPlanModal from "@/components/dashboard/ai/EventProductionPlanModal"
import SupplierShortagesModal from "@/components/dashboard/ai/SupplierShortagesModal"
import {
  generateWeeklyBriefingAction,
  predictSupplierShortagesAction,
  generateFinancialDiagnosisAction,
  generateEventProductionPlanAction
} from "@/app/actions/gemini-copilot"

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
      storeSlug?: string | null
      storeIsActive?: boolean
   }[]
   onlineStores?: {
      id: string
      slug: string
      title: string
      is_active: boolean
   }[]
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  
  // Dashboard Tops
  const [metrics, setMetrics] = useState({
     eventCount: 0,
     activeCompanies: 0,
     estimatedRevenue: 0,
     gastosAEjecutar: 0
  })

  // Kitchen specific production metrics
  const [kitchenMetrics, setKitchenMetrics] = useState({
     monthActiveShows: 0,
     todayViandas: 0,
     thisWeekPax: 0,
     thisWeekViandas: 0,
     thisWeekRevenue: 0
  })

  // Specific Cuts
  const [allEvents, setAllEvents] = useState<EventData[]>([])
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
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null)

  // Gemini Copilot AI States
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingData, setBriefingData] = useState<any>(null)

  const [financialOpen, setFinancialOpen] = useState(false)
  const [financialLoading, setFinancialLoading] = useState(false)
  const [financialData, setFinancialData] = useState<any>(null)

  const [shortagesOpen, setShortagesOpen] = useState(false)
  const [shortagesLoading, setShortagesLoading] = useState(false)
  const [shortagesData, setShortagesData] = useState<any>(null)

  const [ocrOpen, setOcrOpen] = useState(false)

  const [eventPlanOpen, setEventPlanOpen] = useState(false)
  const [eventPlanLoading, setEventPlanLoading] = useState(false)
  const [eventPlanData, setEventPlanData] = useState<any>(null)

  const handleOpenWeeklyBriefing = async () => {
    setBriefingOpen(true)
    setBriefingLoading(true)
    try {
      const res = await generateWeeklyBriefingAction(upcoming10Days)
      if (res.success) setBriefingData(res.data)
      else alert(res.error || "Error al generar briefing")
    } catch (e: any) {
      alert("Error: " + e.message)
    } finally {
      setBriefingLoading(false)
    }
  }

  const handleOpenFinancialDiagnosis = async () => {
    setFinancialOpen(true)
    setFinancialLoading(true)
    try {
      const res = await generateFinancialDiagnosisAction(metrics, upcoming10Days)
      if (res.success) setFinancialData(res.data)
      else alert(res.error || "Error al generar diagnóstico")
    } catch (e: any) {
      alert("Error: " + e.message)
    } finally {
      setFinancialLoading(false)
    }
  }

  const handleOpenShortages = async () => {
    setShortagesOpen(true)
    setShortagesLoading(true)
    try {
      const res = await predictSupplierShortagesAction(upcoming10Days, incomingPOs)
      if (res.success) setShortagesData(res.data)
      else alert(res.error || "Error al verificar faltantes")
    } catch (e: any) {
      alert("Error: " + e.message)
    } finally {
      setShortagesLoading(false)
    }
  }

  const handleOpenEventPlan = async (show: any) => {
    setEventPlanOpen(true)
    setEventPlanLoading(true)
    try {
      const res = await generateEventProductionPlanAction(show)
      if (res.success) setEventPlanData(res.data)
      else alert(res.error || "Error al generar plan de producción")
    } catch (e: any) {
      alert("Error: " + e.message)
    } finally {
      setEventPlanLoading(false)
    }
  }

  const fetchPOs = async () => {
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
             productos (nombre, unidad_medida, gramos_por_unidad)
           )
        `)
        .eq('estado', 'PENDIENTE')
        .order('fecha_esperada', { ascending: true })

     if (poErr) {
        console.error("Dashboard PO fetch error:", poErr)
        return
     }

     const today = new Date()
     const currentDay = today.getDay()
     const endOfThisWeek = new Date(today)
     const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
     endOfThisWeek.setDate(today.getDate() + daysToSunday)
     endOfThisWeek.setHours(23,59,59,999)

     const filteredPOs = poData ? poData.filter((po: any) => {
        if (!po.fecha_esperada) return false
        const poDate = new Date(po.fecha_esperada + 'T12:00:00')
        return poDate <= endOfThisWeek
     }) : []

     setIncomingPOs(filteredPOs)
  }

  const handlePORecievedSuccess = () => {
     setReceivingPoId(null)
     fetchPOs()
  }

  useEffect(() => {
     async function checkRole() {
       const { data: { user } } = await supabase.auth.getUser()
       if (user) {
         if (user.email === 'alpaso.algalope@gmail.com' || user.email === 'cocina@supercatering.com') {
           setRole('cocina')
         } else {
           const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
           if (profile?.role) {
             setRole(profile.role)
           } else {
             const roleFromMeta = user.app_metadata?.role || user.user_metadata?.role || 'admin'
             setRole(roleFromMeta)
           }
         }
       }
     }
     checkRole()
  }, [supabase])

  useEffect(() => {
     fetchPOs()
  }, [refreshTrigger])

  useEffect(() => {
     async function bootstrapDashboard() {
        setLoading(true)
        setFetchError(null)

        const [
           { data: masters, error: mErr },
           { data: clients, error: cErr },
           { data: salesHeaders, error: sErr },
           { data: pendingPOs, error: pErr },
           { data: storesData }
        ] = await Promise.all([
           supabase
              .from("events_master")
              .select(`
                 id,
                 event_date,
                 show_name,
                 status,
                 venues ( name ),
                 event_projections (
                    company_name,
                    projected_pax
                 ),
                 event_bus_assignments (
                    coordinators (
                       name,
                       phone,
                       company
                    )
                 )
              `)
              .order("event_date", { ascending: true }),
           supabase.from("clients").select("id", { count: "exact" }),
           supabase.from("event_sales_headers").select("event_master_id, total_amount, total_sold"),
           supabase.from("purchase_orders").select("costo_total").eq("estado", "PENDIENTE"),
           supabase.from("online_store_events").select("id, event_master_id, slug, title, is_active")
        ])

        if (mErr) {
           console.error("CRITICAL DASHBOARD ERROR:", mErr)
           setFetchError("Error cargando base maestra de eventos: " + mErr.message)
           setLoading(false)
           return
        }

        if (!masters || masters.length === 0) {
           setLoading(false)
           return
        }

        const totalGastosAEjecutar = pendingPOs?.reduce((acc, po) => acc + (Number(po.costo_total) || 0), 0) || 0

        const revenueByMaster: Record<string, number> = {}
        const soldByMaster: Record<string, number> = {}
        const companySalesAggr: Record<string, number> = {}

        salesHeaders?.forEach(sh => {
           if (sh.event_master_id) {
              revenueByMaster[sh.event_master_id] = (revenueByMaster[sh.event_master_id] || 0) + (Number(sh.total_amount) || 0)
              soldByMaster[sh.event_master_id] = (soldByMaster[sh.event_master_id] || 0) + (Number(sh.total_sold) || 0)
           }
        })

        const { data: salesCompanies } = await supabase
           .from("event_sales_companies")
           .select("company_name, quantity_total")

        salesCompanies?.forEach(sc => {
           if (sc.company_name) {
              companySalesAggr[sc.company_name] = (companySalesAggr[sc.company_name] || 0) + (Number(sc.quantity_total) || 0)
           }
        })

        const [{ data: clientsData }, { data: rulesData }] = await Promise.all([
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

        const today = new Date()
        const currentDay = today.getDay()
        const todayDate = new Date(today)
        todayDate.setHours(0,0,0,0)
        
        const venueAggr: Record<string, number> = {}

        const endOfThisWeek = new Date(today)
        const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
        endOfThisWeek.setDate(today.getDate() + daysToSunday)
        endOfThisWeek.setHours(23,59,59,999)

        const startOfNextWeek = new Date(endOfThisWeek)
        startOfNextWeek.setDate(endOfThisWeek.getDate() + 1)
        startOfNextWeek.setHours(0,0,0,0)

        const endOfNextWeek = new Date(startOfNextWeek)
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
        endOfNextWeek.setHours(23,59,59,999)

        const allMapped: EventData[] = masters.map(m => {
           const eRev = revenueByMaster[m.id] || 0
           const eSold = soldByMaster[m.id] || 0
           
           const eventStores = (storesData || []).filter((s: any) => s.event_master_id === m.id)

           let totalAdjustedProj = 0
           let totalProjectedRev = 0
           const projections: {company: string, pax: number, adjusted: number, storeSlug?: string | null, storeIsActive?: boolean}[] = []

           m.event_projections?.forEach((p: any) => {
              const compKey = (p.company_name || "").trim().toLowerCase()
              const factor = conversionMap[compKey] || 1.0
              const rule = rulesMap[compKey]
              
              const basePax = Number(p.projected_pax) || 0
              const adjustedSales = basePax * factor
              totalAdjustedProj += adjustedSales

              // Match store by event_master_id first or by slug pattern
              let matchedStore = eventStores.find((s: any) => {
                 const sTitle = (s.title || "").toLowerCase()
                 const sSlug = (s.slug || "").toLowerCase()
                 const cleanComp = compKey.replace(/[^a-z0-9]/g, "")
                 return sTitle.includes(compKey) || sSlug.includes(cleanComp)
              })

              if (!matchedStore) {
                 matchedStore = (storesData || []).find((s: any) => {
                    const sSlug = (s.slug || "").toLowerCase()
                    const cleanComp = compKey.replace(/[^a-z0-9]/g, "")
                    return sSlug.includes(m.event_date) && sSlug.includes(cleanComp)
                 })
              }

              const autoSlug = `${slugify(m.show_name)}-${slugify(p.company_name)}-${m.event_date}`

              projections.push({
                 company: p.company_name,
                 pax: basePax,
                 adjusted: Math.round(adjustedSales),
                 storeSlug: matchedStore?.slug || autoSlug,
                 storeIsActive: matchedStore?.is_active ?? true
              })
              
              if (rule) {
                 totalProjectedRev += adjustedSales * (Number(rule.price_base) || 0)
              }
           })

           const vName = (m.venues as any)?.name || (m.venues as any)?.[0]?.name || "-"

           if (!venueAggr[vName]) venueAggr[vName] = 0
           venueAggr[vName] += eSold

            const coordinators: {name: string, phone: string, company: string}[] = []
            m.event_bus_assignments?.forEach((ba: any) => {
               if (ba.coordinators) {
                  const cObj = Array.isArray(ba.coordinators) ? ba.coordinators[0] : ba.coordinators
                  if (cObj) {
                     coordinators.push({
                        name: cObj.name || "",
                        phone: cObj.phone || "",
                        company: cObj.company || ""
                     })
                  }
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
               projections,
               onlineStores: eventStores
            }
        })

        const safeLocal = (a: string, b: string) => {
           if (!a) return 1; if (!b) return -1;
           return a.localeCompare(b);
        }

        allMapped.sort((a,b) => safeLocal(a.date, b.date))
        
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

        setAllEvents(allMapped)
        setUpcoming10Days(thisWeekList)
        setUpcomingCharts(nextWeekList)
        setExecutedEvents(allMapped.filter(m => closedStatuses.includes(m.status)).sort((a,b) => safeLocal(b.date, a.date)).slice(0, 15))

        const totalEstimatedRev = futureEvs.reduce((acc, curr) => acc + curr.revenue, 0)
        setMetrics({
           eventCount: futureEvs.length,
           activeCompanies: clients?.length || 0,
           estimatedRevenue: totalEstimatedRev,
           gastosAEjecutar: totalGastosAEjecutar
        })

        // Kitchen specific production metrics
        const currentMonth = today.getMonth()
        const currentYear = today.getFullYear()
        const monthActiveShows = masters.filter((m: any) => {
           if (closedStatuses.includes((m.status || "").toLowerCase())) return false
           if (!m.event_date) return false
           const [y, mon] = m.event_date.split('-').map(Number)
           return y === currentYear && mon === (currentMonth + 1)
        }).length

        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const todayShows = allMapped.filter(m => m.date === todayStr && !closedStatuses.includes(m.status))
        const todayViandas = todayShows.reduce((acc, curr) => acc + (curr.sold > 0 ? curr.sold : curr.projected), 0)

        let thisWeekPax = 0
        thisWeekList.forEach(m => {
           const orig = masters.find(mast => mast.id === m.id)
           orig?.event_projections?.forEach((p: any) => {
              thisWeekPax += (Number(p.projected_pax) || 0)
           })
        })

        const thisWeekViandas = thisWeekList.reduce((acc, curr) => acc + curr.projected, 0)
        const thisWeekRevenue = thisWeekList.reduce((acc, curr) => acc + curr.revenue, 0)

        setKitchenMetrics({
           monthActiveShows,
           todayViandas,
           thisWeekPax,
           thisWeekViandas,
           thisWeekRevenue
        })

        setTopVenues(
           Object.keys(venueAggr)
              .map(name => ({ name, sold: venueAggr[name] }))
              .filter(v => v.name !== "-")
              .sort((a,b) => b.sold - a.sold)
              .slice(0, 5)
        )

        setTopCompanies(
           Object.keys(companySalesAggr)
              .map(name => ({ name, sold: companySalesAggr[name] }))
              .sort((a,b) => b.sold - a.sold)
              .slice(0, 5)
        )

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

        setLoading(false)
     }

      bootstrapDashboard()
   }, [refreshTrigger])

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

  const copyPOText = () => {
     if (incomingPOs.length === 0) return

     const sortedPOs = [...incomingPOs].sort((a, b) => {
        if (!a.fecha_esperada) return 1
        if (!b.fecha_esperada) return -1
        return a.fecha_esperada.localeCompare(b.fecha_esperada)
     })

     let text = `📦 *ENTREGAS PENDIENTES - RECIBIR ESTA SEMANA*\n\n`

     const groupedByDate: Record<string, any[]> = {}
     sortedPOs.forEach(po => {
        const dateStr = po.fecha_esperada || 'Sin Fecha'
        if (!groupedByDate[dateStr]) groupedByDate[dateStr] = []
        groupedByDate[dateStr].push(po)
     })

     Object.keys(groupedByDate).forEach(dateStr => {
        const poDate = new Date(dateStr + 'T12:00:00')
        const dateLabel = poDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' }).toUpperCase()
        
        text += `📅 *${dateLabel}*\n`
        
        groupedByDate[dateStr].forEach(po => {
           const provName = po.proveedores?.nombre || 'Proveedor Desconocido'
           text += `  • *${provName.toUpperCase()}*:\n`
           
           if (po.purchase_order_items && po.purchase_order_items.length > 0) {
              po.purchase_order_items.forEach((item: any) => {
                 const prodName = item.productos?.nombre || 'Producto'
                 const qty = item.cantidad || 0
                 const unit = item.productos?.unidad_medida || 'un'
                 const unitsPerPkg = Number(item.productos?.gramos_por_unidad) || 1
                  
                  let line = `    - ${prodName}: `
                  if (unitsPerPkg > 1) {
                     const bultos = Math.round((qty / unitsPerPkg) * 100) / 100
                     line += `${bultos} bultos x ${unitsPerPkg} = ${qty} ${unit}`
                  } else {
                     line += `${qty} ${unit}`
                  }
                  text += `${line}\n`
              })
           } else {
              text += `    - Sin items detallados\n`
           }
        })
        text += `\n`
     })

     text += `_Generado automáticamente desde Super Catering Manager_`

     navigator.clipboard.writeText(text)
     alert("Lista de entregas copiada al portapapeles con éxito!")
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Tarjetas de Accesos Rápidos / Métricas en Header */}
      {role === 'admin' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {/* Métrica 1: Shows activos del mes */}
          <div className="bg-white hover:bg-indigo-50/20 border border-slate-200 hover:border-indigo-300 rounded-[2.5rem] p-5 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/50 flex items-center gap-3.5">
            <div className="w-12 h-12 bg-slate-50 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-indigo-200 shrink-0 shadow-sm transition-all duration-300">
              <Calendar className="text-slate-500 group-hover:text-indigo-600 transition-colors" size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">Shows Activos Mes</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-indigo-900 transition-colors leading-none">{kitchenMetrics.monthActiveShows}</p>
            </div>
          </div>

          {/* Métrica 2: Viandas Proyectadas hoy */}
          <div className="bg-white hover:bg-amber-50/20 border border-slate-200 hover:border-amber-300 rounded-[2.5rem] p-5 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-100/50 flex items-center gap-3.5">
            <div className="w-12 h-12 bg-slate-50 group-hover:bg-amber-100 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-amber-200 shrink-0 shadow-sm transition-all duration-300">
              <ShoppingBag className="text-slate-500 group-hover:text-amber-600 transition-colors" size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">Viandas Proyectadas Hoy</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-amber-900 transition-colors leading-none">{kitchenMetrics.todayViandas} <span className="text-xs font-bold text-slate-400">U.</span></p>
            </div>
          </div>

          {/* Métrica 3: Pasajeros Estimados esta semana */}
          <div className="bg-white hover:bg-sky-50/20 border border-slate-200 hover:border-sky-300 rounded-[2.5rem] p-5 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-100/50 flex items-center gap-3.5">
            <div className="w-12 h-12 bg-slate-50 group-hover:bg-sky-100 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-sky-200 shrink-0 shadow-sm transition-all duration-300">
              <Users className="text-slate-500 group-hover:text-sky-600 transition-colors" size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">Pasajeros Semana</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-sky-900 transition-colors leading-none">{kitchenMetrics.thisWeekPax} <span className="text-xs font-bold text-slate-400">PAX</span></p>
            </div>
          </div>

          {/* Métrica 4: Ventas Proyectadas esta semana (Unidades) */}
          <div className="bg-white hover:bg-purple-50/20 border border-slate-200 hover:border-purple-300 rounded-[2.5rem] p-5 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100/50 flex items-center gap-3.5">
            <div className="w-12 h-12 bg-slate-50 group-hover:bg-purple-100 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-purple-200 shrink-0 shadow-sm transition-all duration-300">
              <TrendingUp className="text-slate-500 group-hover:text-purple-600 transition-colors" size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">Ventas Proyectadas (U)</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-purple-900 transition-colors leading-none">{kitchenMetrics.thisWeekViandas} <span className="text-xs font-bold text-slate-400">U.</span></p>
            </div>
          </div>

          {/* Métrica 5: Ventas Proyectadas esta semana ($) */}
          <div className="bg-white hover:bg-emerald-50/20 border border-slate-200 hover:border-emerald-300 rounded-[2.5rem] p-5 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-100/50 flex items-center gap-3.5">
            <div className="w-12 h-12 bg-slate-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-emerald-200 shrink-0 shadow-sm transition-all duration-300">
              <DollarSign className="text-slate-500 group-hover:text-emerald-600 transition-colors" size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">Venta Proyectada ($)</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums group-hover:text-emerald-800 transition-colors leading-none">{formatCurrency(kitchenMetrics.thisWeekRevenue)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Métrica 1: Shows activos del mes */}
          <div className="bg-white hover:bg-indigo-50/20 border border-slate-200 hover:border-indigo-300 rounded-[2.5rem] p-6 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/50 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 group-hover:bg-indigo-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-indigo-200 shrink-0 shadow-sm transition-all duration-300">
              <Calendar className="text-slate-500 group-hover:text-indigo-600 transition-colors" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Shows Activos del Mes</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-indigo-900 transition-colors leading-none">{kitchenMetrics.monthActiveShows}</p>
            </div>
          </div>

          {/* Métrica 2: Viandas Proyectadas hoy */}
          <div className="bg-white hover:bg-amber-50/20 border border-slate-200 hover:border-amber-300 rounded-[2.5rem] p-6 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-100/50 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 group-hover:bg-amber-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-amber-200 shrink-0 shadow-sm transition-all duration-300">
              <ShoppingBag className="text-slate-500 group-hover:text-amber-600 transition-colors" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Viandas Proyectadas Hoy</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-amber-900 transition-colors leading-none">{kitchenMetrics.todayViandas} <span className="text-xs font-bold text-slate-400">U.</span></p>
            </div>
          </div>

          {/* Métrica 3: Pasajeros Estimados esta semana */}
          <div className="bg-white hover:bg-emerald-50/20 border border-slate-200 hover:border-emerald-300 rounded-[2.5rem] p-6 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-100/50 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 group-hover:bg-emerald-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-emerald-200 shrink-0 shadow-sm transition-all duration-300">
              <Users className="text-slate-500 group-hover:text-emerald-600 transition-colors" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Pasajeros Estimados Semana</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-emerald-900 transition-colors leading-none">{kitchenMetrics.thisWeekPax} <span className="text-xs font-bold text-slate-400">PAX</span></p>
            </div>
          </div>

          {/* Métrica 4: Ventas Proyectadas esta semana */}
          <div className="bg-white hover:bg-purple-50/20 border border-slate-200 hover:border-purple-300 rounded-[2.5rem] p-6 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100/50 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 group-hover:bg-purple-100 rounded-3xl flex items-center justify-center border border-slate-100 group-hover:border-purple-200 shrink-0 shadow-sm transition-all duration-300">
              <TrendingUp className="text-slate-500 group-hover:text-purple-600 transition-colors" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Ventas Proyectadas Semana</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums group-hover:text-purple-900 transition-colors leading-none">{kitchenMetrics.thisWeekViandas} <span className="text-xs font-bold text-slate-400">U.</span></p>
            </div>
          </div>
        </div>
      )}

      {/* CRONOGRAMA MENSUAL DE PASAJEROS Y DEMANDA (SEGUNDO LUGAR) */}
      <MonthlyScheduleCalendar events={allEvents} role={role} />

      {/* Grid General con Dos Columnas Estables: Shows Próximas Semanas + Recibir esta Semana */}
      <div className="grid lg:grid-cols-3 gap-8 items-start">
         
         {/* COLUMNA 1 y 2: SHOWS PRÓXIMAS SEMANAS */}
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
               onOpenBriefing={handleOpenWeeklyBriefing}
               onOpenPlan={handleOpenEventPlan}
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
               onOpenBriefing={handleOpenWeeklyBriefing}
               onOpenPlan={handleOpenEventPlan}
             />
            </div>
          </div>
          
          {/* COLUMNA 3: MERCADERÍA A RECIBIR */}
          <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-8 shadow-xl shadow-slate-200/50">
            <div className="mb-4">
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] flex items-center gap-1.5">
                     <Truck size={14}/> Recibir esta Semana
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Mercadería a recibir de proveedores.</p>
                </div>
                <button 
                  onClick={copyPOText} 
                  disabled={incomingPOs.length === 0}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title="Copiar lista de entregas para WhatsApp"
                >
                  <Copy size={11} /> WhatsApp
                </button>
              </div>

              {/* Botones de IA para Recepción y Control Predictivo */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setOcrOpen(true)}
                  className="py-2 px-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                  title="Subir o tomar foto de remito papel para escanear con IA"
                >
                  <Camera size={12} /> Escanear Remito IA
                </button>
                <button
                  onClick={handleOpenShortages}
                  className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-teal-300 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer border border-slate-700"
                  title="Verificar si los insumos a recibir alcanzan para los shows de la semana"
                >
                  <Truck size={12} /> Faltantes IA
                </button>
              </div>
            </div>

            <div className="relative">
               <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1 scrollbar-none pb-8">
                  {incomingPOs.length === 0 ? (
                     <div className="py-12 text-center bg-slate-50 border border-slate-100 rounded-3xl p-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin entregas pendientes</p>
                     </div>
                  ) : (
                     incomingPOs.map((po: any) => {
                        const poDate = po.fecha_esperada ? new Date(po.fecha_esperada + 'T12:00:00') : null
                        const weekday = poDate ? poDate.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '') : '-'
                        const dayNum = poDate ? poDate.getDate() : '-'
                        const monthName = poDate ? poDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '') : ''
                        
                        const isOverdue = poDate && poDate < new Date(new Date().setHours(0,0,0,0))
                        const isPoToday = poDate && poDate.toDateString() === new Date().toDateString()

                        return (
                           <div 
                              key={po.id} 
                              className={`border rounded-3xl p-4 transition-all duration-200 relative group ${
                                 isPoToday 
                                    ? 'bg-emerald-50/40 border-emerald-200 shadow-sm' 
                                    : isOverdue 
                                       ? 'bg-rose-50/40 border-rose-200 shadow-sm' 
                                       : 'bg-white hover:bg-slate-50 border-slate-200/80'
                              }`}
                           >
                              <div className="flex items-start justify-between gap-3">
                                 <div className="flex items-center gap-3">
                                    <div className={`flex flex-col items-center justify-center w-10 h-12 rounded-xl border text-center shrink-0 ${
                                       isPoToday 
                                          ? 'bg-emerald-500 border-emerald-600 text-white' 
                                          : isOverdue 
                                             ? 'bg-rose-500 border-rose-600 text-white animate-pulse' 
                                             : 'bg-slate-50 border-slate-100 text-slate-700'
                                    }`}>
                                       <span className="text-[8px] font-black leading-none uppercase">{weekday}</span>
                                       <span className="text-sm font-black leading-none mt-0.5">{dayNum}</span>
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                       <div className="flex items-center gap-1.5 flex-wrap">
                                           {isOverdue && (
                                              <span className="bg-rose-100 text-rose-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                 Atrasado
                                              </span>
                                           )}
                                           {isPoToday && (
                                              <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                                 Hoy
                                              </span>
                                           )}
                                           <span className="text-[9px] font-bold text-slate-400">
                                              {monthName}
                                           </span>
                                       </div>
                                       
                                       <h4 className="font-black text-slate-800 text-sm uppercase mt-0.5 leading-tight truncate" title={po.proveedores?.nombre}>
                                           {po.proveedores?.nombre || 'Proveedor Eliminado'}
                                       </h4>
                                    </div>
                                 </div>
                              </div>
                              
                              <div className="mt-3 pt-2.5 border-t border-slate-100">
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Insumos Solicitados:</p>
                                 <ul className="space-y-1">
                                    {po.purchase_order_items?.map((item: any, idx: number) => {
                                       const qty = item.cantidad || 0
                                       const unit = item.productos?.unidad_medida || 'un'
                                       const unitsPerPkg = Number(item.productos?.gramos_por_unidad) || 1
                                       const bultos = Math.round((qty / unitsPerPkg) * 100) / 100
                                       
                                       return (
                                          <li key={idx} className="text-[11px] font-semibold text-slate-600 flex items-center justify-between gap-1.5">
                                             <span className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                                                <span className="truncate max-w-[130px] md:max-w-[150px]" title={item.productos?.nombre}>{item.productos?.nombre}</span>
                                             </span>
                                             <span className="font-black text-indigo-700 tabular-nums shrink-0">
                                                {unitsPerPkg > 1 ? `${bultos} bult x ${unitsPerPkg} = ` : ''}{qty} {unit}
                                             </span>
                                          </li>
                                       )
                                    })}
                                 </ul>
                              </div>
                              
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                                 {role === 'admin' && (
                                   <div className="flex justify-between items-center text-[10px]">
                                      <span className="font-black text-slate-400 uppercase tracking-widest">Costo Est.</span>
                                      <span className="font-black text-slate-800 tabular-nums">{formatCurrency(po.costo_total)}</span>
                                   </div>
                                 )}
                                 <button
                                    onClick={() => setSelectedPOId(po.id)}
                                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 mt-1 active:scale-95"
                                 >
                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                    Recepcionar
                                 </button>
                              </div>

                              <button
                                onClick={() => setReceivingPoId(po.id)}
                                className="mt-3 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-sm flex items-center justify-center gap-1.5"
                              >
                                <Truck size={14} />
                                Recibir
                              </button>
                           </div>
                        )
                     })
                  )}
               </div>
               <div className="absolute left-0 right-2 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none opacity-90" />
            </div>
          </div>
      </div>

      {receivingPoId && (
        <ReceivePOModal
          orderId={receivingPoId}
          onClose={() => setReceivingPoId(null)}
          onSuccess={handlePORecievedSuccess}
        />
      )}

      {selectedPOId && (
        <ReceivePOModal
          orderId={selectedPOId}
          onClose={() => setSelectedPOId(null)}
          onSuccess={() => {
            setSelectedPOId(null)
            setRefreshTrigger(prev => prev + 1)
          }}
        />
      )}

      {/* MODALES DE INTELIGENCIA ARTIFICIAL GEMINI */}
      <WeeklyBriefingModal
        isOpen={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        briefingData={briefingData}
        loading={briefingLoading}
      />

      <FinancialDiagnosisModal
        isOpen={financialOpen}
        onClose={() => setFinancialOpen(false)}
        data={financialData}
        loading={financialLoading}
      />

      <SupplierShortagesModal
        isOpen={shortagesOpen}
        onClose={() => setShortagesOpen(false)}
        data={shortagesData}
        loading={shortagesLoading}
      />

      <RemitoOCRModal
        isOpen={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onApplyData={(data) => {
          console.log("OCR Data Received:", data)
          alert(`Remito de ${data.proveedor_detectado || 'Proveedor'} (${data.nro_comprobante || 'S/N'}) detectado con ${data.items?.length || 0} ítems.`)
        }}
      />

      <EventProductionPlanModal
        isOpen={eventPlanOpen}
        onClose={() => setEventPlanOpen(false)}
        data={eventPlanData}
        loading={eventPlanLoading}
      />

    </div>
  )
}

// --- Helper Components for the Dashboard Overhaul ---

const formatCurrencyLocal = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

function SectionView({ title, shows, subtitle, total_projected, total_adjusted, total_revenue, accentColor, footerTitle, footerLabel, role, onOpenBriefing, onOpenPlan }: any) {
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
         <div className="flex items-center gap-4">
            {title === "Esta Semana" && onOpenBriefing && (
              <button
                onClick={onOpenBriefing}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
                title="Generar minuta y briefing de producción para WhatsApp con Gemini"
              >
                <Sparkles size={14} className="text-amber-300 animate-pulse" /> Minuta Semanal IA
              </button>
            )}
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
                 
                 <div className={`grid grid-cols-1 ${group.shows.length > 1 ? 'md:grid-cols-2' : ''} gap-6`}>
                    {group.shows.map((show: any, j: number) => (
                      <EffectivenessCard key={j} show={show} role={role} onOpenPlan={onOpenPlan} />
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
               {role === 'admin' && (
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

function EffectivenessCard({ show, role, onOpenPlan }: { show: any, role: string | null, onOpenPlan?: (show: any) => void }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const evDate = new Date(show.date + 'T12:00:00')
  const weekday = evDate.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '')
  const day = evDate.getDate()
  const month = evDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.','')
  const today = new Date().toLocaleDateString('sv-SE')
  const isToday = show.date === today
  
  const statusColors: any = {
    ejecutado: 'bg-indigo-600 text-white border-indigo-700',
    cancelado: 'bg-red-50 text-red-700 border-red-100',
    confirmado: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    pendiente: 'bg-amber-50 text-amber-900 border-amber-200'
  }
  const cls = statusColors[show.status?.toLowerCase()] || 'bg-slate-50 text-slate-600'

  const buildWhatsAppMessage = (coordUrl: string, storeUrl: string, coordinatorName?: string) => {
    const nameFirst = coordinatorName?.trim() ? coordinatorName.trim().split(' ')[0] : ''
    const greeting = nameFirst ? `Hola ${nameFirst}! Como estás?` : `Hola! Como estás?`

    return `${greeting}\nTe dejo para que tengas a mano el link de gestión para el día de hoy. Acá vas a encontrar el detalle de pasajeros que van pidiendo, y podés además declarar la ubicación una vez que estacionan: ${coordUrl}\n\nAdemás, para que puedas copiar y pegar, te dejo la propuesta armada!\n\n*🥪 ¡Cená en el micro a la vuelta del show!*\n\nPara que no pierdas tiempo buscando comida a la salida ni hagas filas eternas, ya podés reservar tu vianda fresca para el regreso. Te subís al micro y ya tenés tu cena lista.\n\n*Elegí tu combo:*\n\n🥖 Tradicional: Ciabatta artesanal con jamón cocido, queso, mix de verdes frescos y tomate + Agua mineral 500ml.\n🥑 Vegetariano: Ciabatta artesanal con huevo, queso, mix de verdes y tomate fresco + Agua mineral 500ml.\n🌾 Sin TACC: Pan árabe de jamón y queso (envasado al vacío certificado) + Agua mineral 500ml.\n\n*💳 Precios:*\nMenú Tradicional / Vegetariano: $12.000\nMenú Sin TACC: $15.000 (Pagás directo con Mercado Pago: tarjetas, débito o dinero en cuenta)\n⚠️ Cupos limitados por viaje. Los pedidos se reciben hasta las 12:30 hs.\n\n👉 Hacé tu reserva online acá: ${storeUrl}`
  }

  const handleCopyMessagePack = (coordUrl: string, storeUrl: string, key: string, coordinatorName?: string) => {
    const text = buildWhatsAppMessage(coordUrl, storeUrl, coordinatorName)
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

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

      {/* Coordinadores */}
      {show.coordinators && show.coordinators.length > 0 && (
        <div className={`mb-6 p-4 rounded-[1.5rem] border space-y-2 ${
           isToday 
             ? 'bg-emerald-50/50 border-emerald-100' 
             : 'bg-slate-50 border-slate-100'
        }`}>
          {show.coordinators.map((c: any, idx: number) => {
            const phoneClean = (c.phone || '').replace(/[^0-9]/g, '')
            return (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Users size={12} className={isToday ? "text-emerald-600 shrink-0" : "text-indigo-500 shrink-0"} />
                  <span className="font-bold text-slate-700 truncate">{c.name} ({c.company}):</span>
                  <span className="text-slate-500 font-medium">{c.phone}</span>
                </div>
                {phoneClean && (
                  <a
                    href={`https://wa.me/${phoneClean}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg transition shrink-0"
                    title="WhatsApp Coordinador"
                  >
                    <MessageCircle size={14} />
                  </a>
                )}
              </div>
            )
          })}
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

        {role === 'admin' && (
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

        {/* ACCESOS RÁPIDOS Y PACK INTEGRAL DE WHATSAPP POR EMPRESA */}
        {show.projections && show.projections.length > 0 && (
          <div className="pt-3.5 border-t border-slate-200/80 space-y-2.5">
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              <Store size={12} /> Pack WhatsApp y Links por Empresa:
            </p>

            <div className="space-y-2.5">
              {show.projections.map((p: any, idx: number) => {
                const origin = typeof window !== 'undefined' ? window.location.origin : ''
                const targetSlug = p.storeSlug || `${slugify(show.show)}-${slugify(p.company)}-${show.date}`
                const storeUrl = `${origin}/tienda/${targetSlug}`
                const coordUrl = `${origin}/tienda/${targetSlug}/coordinador`

                const coordAssigned = show.coordinators?.find((c: any) => {
                  const comp = (c.company || '').toLowerCase().trim()
                  const pComp = (p.company || '').toLowerCase().trim()
                  return comp && pComp && (comp === pComp || comp.includes(pComp) || pComp.includes(comp))
                })
                const coordName = coordAssigned?.name || ''
                const coordPhoneClean = (coordAssigned?.phone || '').replace(/[^0-9]/g, '')
                const isPackCopied = copiedKey === `pack-${p.company}`

                return (
                  <div key={idx} className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <span className="font-black text-slate-800 uppercase truncate" title={p.company}>
                          {p.company}
                        </span>
                        {coordName && (
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0" title={`Coordinador: ${coordName}`}>
                            <User size={8} /> {coordName.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase shrink-0">
                        {p.adjusted} PAX
                      </span>
                    </div>

                    {/* BOTÓN PRINCIPAL: PACK COMPLETO DE WHATSAPP (PERSONALIZADO CON NOMBRE) */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyMessagePack(coordUrl, storeUrl, `pack-${p.company}`, coordName)}
                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95 ${
                          isPackCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white'
                        }`}
                        title={`Copiar propuesta y links para ${coordName || p.company}`}
                      >
                        {isPackCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isPackCopied ? '¡Mensaje Copiado!' : coordName ? `Copiar Pack (${coordName.split(' ')[0]})` : 'Copiar Mensaje Pack'}</span>
                      </button>

                      {coordPhoneClean && (
                        <a
                          href={`https://wa.me/${coordPhoneClean}?text=${encodeURIComponent(buildWhatsAppMessage(coordUrl, storeUrl, coordName))}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                          title={`Enviar Pack a ${coordName || 'Coordinador'} por WhatsApp`}
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                    </div>

                    {/* Mini accesos para abrir directamente en navegador */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px] font-bold text-slate-500">
                      <Link
                        href={`/tienda/${targetSlug}`}
                        target="_blank"
                        className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline truncate max-w-[120px]"
                      >
                        <ShoppingBag size={10} /> <span>Abrir Tienda</span>
                      </Link>

                      <Link
                        href={`/tienda/${targetSlug}/coordinador`}
                        target="_blank"
                        className="text-teal-700 hover:text-teal-900 flex items-center gap-1 hover:underline truncate max-w-[120px]"
                      >
                        <Bus size={10} /> <span>Abrir Panel Coordi</span>
                      </Link>
                    </div>

                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Botones de Acción */}
      <div className="grid grid-cols-4 gap-2 mt-auto">
        <Link href={`/settings/eventos?eventId=${show.id}`} className="w-full text-center text-[9px] font-black bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl uppercase tracking-widest transition-all border border-slate-200 flex items-center justify-center">
          Gestión
        </Link>
        <Link href={`/ventas-evento?eventId=${show.id}`} className="w-full text-center text-[9px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl uppercase tracking-widest transition-all border border-indigo-100 shadow-2xs flex items-center justify-center">
          Ventas
        </Link>
        <Link href={`/logistica-evento?eventId=${show.id}`} className="w-full text-center text-[9px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-2.5 rounded-xl uppercase tracking-widest transition-all border border-emerald-200 shadow-2xs flex items-center justify-center gap-1">
          <Truck size={12} className="text-emerald-700" /> Logística
        </Link>
        {onOpenPlan && (
          <button
            type="button"
            onClick={() => onOpenPlan(show)}
            className="w-full text-center text-[9px] font-black bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 py-2.5 rounded-xl uppercase tracking-widest transition-all border border-purple-200/80 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
            title="Generar plan de producción D-2, D-1, Día D para WhatsApp"
          >
            <Sparkles size={11} className="text-purple-600" /> Plan IA
          </button>
        )}
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