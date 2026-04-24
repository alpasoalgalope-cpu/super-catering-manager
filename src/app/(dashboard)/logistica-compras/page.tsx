"use client"

import React, { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { 
  TrendingUp, Calendar, Users, MapPin, 
  Loader2, ChevronRight, Package, Info, 
  CheckCircle2, AlertCircle, ShoppingCart
} from "lucide-react"

// --- Types ---
interface EffectivenessShow {
  id: string
  date: string
  show: string
  venue: string
  status: string
  projected_pax: number
  adjusted_pax: number
  efficiency: number
}

interface GroupedMetrics {
  total_projected: number
  total_adjusted: number
  shows: EffectivenessShow[]
}

// --- Component ---
export default function LogisticaComprasPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    thisWeek: GroupedMetrics
    nextWeek: GroupedMetrics
  }>({
    thisWeek: { total_projected: 0, total_adjusted: 0, shows: [] },
    nextWeek: { total_projected: 0, total_adjusted: 0, shows: [] }
  })

  useEffect(() => {
    async function fetchEffectivenessData() {
      setLoading(true)
      
      const today = new Date()
      today.setHours(0,0,0,0)
      const fourteenDaysLater = new Date(today)
      fourteenDaysLater.setDate(today.getDate() + 14)

      // 1. Fetch Masters + Projections
      const { data: masters, error: mErr } = await supabase
        .from("events_master")
        .select(`
          id, event_date, show_name, status,
          venues (name),
          event_projections (company_name, projected_pax)
        `)
        .gte("event_date", today.toISOString().split('T')[0])
        .lte("event_date", fourteenDaysLater.toISOString().split('T')[0])
        .order("event_date", { ascending: true })

      if (mErr) {
        console.error("Error fetching effectiveness masters:", mErr)
        setLoading(false)
        return
      }

      // 2. Fetch Clients for Conversion Factor
      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("name, conversion_factor")

      if (cErr) {
        console.error("Error fetching clients for metrics:", cErr)
        setLoading(false)
        return
      }

      // 3. Create Conversion Map
      const conversionMap: Record<string, number> = {}
      clients?.forEach(c => {
        conversionMap[c.name] = Number(c.conversion_factor) || 1.0
      })

      // 4. Process and Group Data
      const processed = processMetrics(masters || [], conversionMap)
      setData(processed)
      setLoading(false)
    }

    fetchEffectivenessData()
  }, [])

  // --- Logic Function (Requested by User) ---
  function processMetrics(masters: any[], conversionMap: Record<string, number>) {
    const today = new Date()
    today.setHours(0,0,0,0)

    // Calculate Week Ranges
    const currentDay = today.getDay() 
    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
    const endOfThisWeek = new Date(today)
    endOfThisWeek.setDate(today.getDate() + daysToSunday)
    endOfThisWeek.setHours(23,59,59,999)

    const startOfNextWeek = new Date(endOfThisWeek)
    startOfNextWeek.setDate(endOfThisWeek.getDate() + 1)
    startOfNextWeek.setHours(0,0,0,0)

    const endOfNextWeek = new Date(startOfNextWeek)
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
    endOfNextWeek.setHours(23,59,59,999)

    const thisWeek: GroupedMetrics = { total_projected: 0, total_adjusted: 0, shows: [] }
    const nextWeek: GroupedMetrics = { total_projected: 0, total_adjusted: 0, shows: [] }

    masters.forEach(m => {
      let showProj = 0
      let showAdj = 0

      m.event_projections?.forEach((p: any) => {
        const factor = conversionMap[p.company_name] || 1.0
        const proj = Number(p.projected_pax) || 0
        showProj += proj
        showAdj += proj * factor
      })

      const showData: EffectivenessShow = {
        id: m.id,
        date: m.event_date,
        show: m.show_name,
        venue: m.venues?.name || "Sin Venue",
        status: m.status,
        projected_pax: showProj,
        adjusted_pax: Math.round(showAdj),
        efficiency: showProj > 0 ? (showAdj / showProj) * 100 : 100
      }

      const evDate = new Date(m.event_date + 'T12:00:00')
      if (evDate <= endOfThisWeek) {
        thisWeek.shows.push(showData)
        thisWeek.total_projected += showProj
        thisWeek.total_adjusted += showAdj
      } else if (evDate >= startOfNextWeek && evDate <= endOfNextWeek) {
        nextWeek.shows.push(showData)
        nextWeek.total_projected += showProj
        nextWeek.total_adjusted += showAdj
      }
    })

    return {
      thisWeek: { ...thisWeek, total_adjusted: Math.round(thisWeek.total_adjusted) },
      nextWeek: { ...nextWeek, total_adjusted: Math.round(nextWeek.total_adjusted) }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={48} />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Calculando efectividad de shows...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 -m-8 p-8 space-y-10 pb-32">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <TrendingUp size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">Logística de Compras</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Efectividad de Shows</h1>
            <p className="text-slate-500 font-medium mt-1">Previsión de ventas reales basada en el factor de conversión por cliente.</p>
          </div>
          <div className="flex gap-4">
             <div className="bg-indigo-600 px-6 py-4 rounded-3xl text-white shadow-xl shadow-indigo-200">
                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Previsión 14 Días</p>
                <p className="text-3xl font-black tabular-nums">{data.thisWeek.total_adjusted + data.nextWeek.total_adjusted} <span className="text-xs opacity-70">VIANDAS</span></p>
             </div>
          </div>
        </div>

        {/* SECTIONS */}
        <div className="space-y-16">
          <SectionView title="Esta Semana" data={data.thisWeek} isPast={false} />
          <SectionView title="Próxima Semana" data={data.nextWeek} isPast={false} />
        </div>
      </div>
    </div>
  )
}

function SectionView({ title, data, isPast }: { title: string, data: GroupedMetrics, isPast: boolean }) {
  if (data.shows.length === 0) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          {title}
          <span className="text-xs font-black bg-slate-200 text-slate-600 px-3 py-1 rounded-full">{data.shows.length} EVENTOS</span>
        </h2>
        <div className="flex items-center gap-6 text-right">
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyectado</p>
              <p className="text-lg font-black text-slate-600">{data.total_projected}</p>
           </div>
           <div className="h-8 w-px bg-slate-200" />
           <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Ajustado (Compra)</p>
              <p className="text-lg font-black text-indigo-700">{data.total_adjusted}</p>
           </div>
        </div>
      </div>

      <div className="space-y-4">
        {data.shows.map(show => (
          <EffectivenessCard key={show.id} show={show} />
        ))}
      </div>
    </div>
  )
}

function EffectivenessCard({ show }: { show: EffectivenessShow }) {
  const evDate = new Date(show.date + 'T12:00:00')
  const day = evDate.getDate()
  const month = evDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.','')
  
  const statusColors: any = {
    ejecutado: 'bg-indigo-600 text-white border-indigo-700',
    cancelado: 'bg-red-50 text-red-700 border-red-100',
    confirmado: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    pendiente: 'bg-amber-50 text-amber-900 border-amber-200'
  }
  const cls = statusColors[show.status.toLowerCase()] || 'bg-slate-50 text-slate-600'

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
      <div className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
        
        {/* Date */}
        <div className="flex flex-row md:flex-col items-center justify-center bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shrink-0 min-w-[80px]">
          <span className="text-2xl font-black text-slate-900 tabular-nums leading-none">{day}</span>
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest md:mt-1">{month}</span>
        </div>

        {/* Show & Venue */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight truncate leading-tight group-hover:text-indigo-600 transition-colors">
            {show.show}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <MapPin size={12} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">{show.venue}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="flex items-center gap-8 px-6 py-3 bg-slate-50/50 rounded-2xl border border-slate-100/50 shrink-0">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Proyectado</p>
            <p className="text-lg font-black text-slate-700 tabular-nums">{show.projected_pax}</p>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Ajustado</p>
            <p className="text-lg font-black text-indigo-600 tabular-nums">{show.adjusted_pax}</p>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Probabilidad</p>
            <p className="text-lg font-black text-emerald-600 tabular-nums">{Math.round(show.efficiency)}%</p>
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0 md:min-w-[120px] text-center">
          <span className={`inline-block w-full text-[10px] font-black px-4 py-2 rounded-xl border uppercase tracking-widest ${cls}`}>
            {show.status}
          </span>
        </div>

      </div>
    </div>
  )
}
