"use client"

import React, { useState, useEffect, useMemo } from "react"
import { getReportsDataAction, ReportRow } from "@/app/actions/reports"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, ReferenceLine 
} from 'recharts'
import { 
  TrendingUp, Calendar, Filter, Loader2, ChevronLeft, ChevronRight, 
  BarChart3, DollarSign, Package
} from "lucide-react"
import Link from "next/link"

export default function ProyectadoVsVentasPage() {
  const [data, setData] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly')
  const [selectedWeek, setSelectedWeek] = useState<number>(0) // 0 = Todo el Mes, 1 = Semana 1, etc.
  const [selectedCompany, setSelectedCompany] = useState<string>('all')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getReportsDataAction()
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        setData(res.data)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  // Helper for grouping and formatting
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  // Get active companies list of the month dynamically
  const activeCompaniesList = useMemo(() => {
    const filtered = data.filter(row => {
      const d = new Date(row.fecha + 'T12:00:00')
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
    })
    return Array.from(new Set(filtered.map(row => row.empresa).filter(Boolean))).sort()
  }, [data, selectedYear, selectedMonth])

  // Get client KPI summary cards
  const companySummaryData = useMemo(() => {
    const filtered = data.filter(row => {
      const d = new Date(row.fecha + 'T12:00:00')
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
    })

    const summaries: Record<string, { empresa: string, proyectado: number, vendido: number, venta_total: number }> = {}

    filtered.forEach(row => {
      const key = row.empresa || 'S/D'
      if (!summaries[key]) {
        summaries[key] = { empresa: key, proyectado: 0, vendido: 0, venta_total: 0 }
      }
      summaries[key].proyectado += row.pax_proyectado || 0
      summaries[key].vendido += row.unidades_vendidas || 0
      summaries[key].venta_total += row.venta_total || 0
    })

    return Object.values(summaries).map(s => {
      const pct = s.proyectado > 0 ? (s.vendido / s.proyectado) * 100 : 0
      return {
        empresa: s.empresa,
        proyectado: Math.round(s.proyectado),
        vendido: Math.round(s.vendido),
        venta_total: Math.round(s.venta_total),
        efectividad: Math.round(pct)
      }
    }).sort((a, b) => b.venta_total - a.venta_total)
  }, [data, selectedYear, selectedMonth])

  // Get recharts chart data
  const chartData = useMemo(() => {
    // Filter by year and month
    const filtered = data.filter(row => {
      const d = new Date(row.fecha + 'T12:00:00')
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
    })

    if (viewMode === 'weekly') {
      // Group by Week (Weeks 1 to 4+)
      const weeks = [
        { name: "Semana 1 (01-07)", proyectado: 0, vendido: 0, proyectado_pesos: 0, vendido_pesos: 0 },
        { name: "Semana 2 (08-14)", proyectado: 0, vendido: 0, proyectado_pesos: 0, vendido_pesos: 0 },
        { name: "Semana 3 (15-21)", proyectado: 0, vendido: 0, proyectado_pesos: 0, vendido_pesos: 0 },
        { name: "Semana 4 (22+)", proyectado: 0, vendido: 0, proyectado_pesos: 0, vendido_pesos: 0 }
      ]

      filtered.forEach(row => {
        const d = new Date(row.fecha + 'T12:00:00')
        const day = d.getDate()
        let weekIdx = 3 // default Week 4 (day 22+)
        if (day <= 7) weekIdx = 0
        else if (day <= 14) weekIdx = 1
        else if (day <= 21) weekIdx = 2

        weeks[weekIdx].proyectado += row.pax_proyectado || 0
        weeks[weekIdx].vendido += row.unidades_vendidas || 0
        
        const estProjPesos = (row.pax_proyectado || 0) * (row.unidades_vendidas > 0 ? row.venta_total / row.unidades_vendidas : 0)
        weeks[weekIdx].proyectado_pesos += estProjPesos
        weeks[weekIdx].vendido_pesos += row.venta_total || 0
      })

      return weeks.map(w => ({
        name: w.name,
        proyectado: Math.round(w.proyectado),
        vendido: Math.round(w.vendido),
        proyectado_pesos: Math.round(w.proyectado_pesos),
        vendido_pesos: Math.round(w.vendido_pesos)
      }))
    } else {
      // Daily mode
      let dailyData = filtered

      // Apply company filter
      if (selectedCompany !== 'all') {
        dailyData = dailyData.filter(row => row.empresa === selectedCompany)
      }

      // Apply week zoom filter
      if (selectedWeek > 0) {
        dailyData = dailyData.filter(row => {
          const d = new Date(row.fecha + 'T12:00:00')
          const day = d.getDate()
          if (selectedWeek === 1) return day <= 7
          if (selectedWeek === 2) return day > 7 && day <= 14
          if (selectedWeek === 3) return day > 14 && day <= 21
          return day > 21
        })
      }

      return dailyData.map(row => ({
        name: `${new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} - ${row.empresa}`,
        fecha: row.fecha,
        empresa: row.empresa,
        proyectado: Math.round(row.pax_proyectado || 0),
        vendido: Math.round(row.unidades_vendidas || 0),
        proyectado_pesos: Math.round(row.pax_proyectado * (row.unidades_vendidas > 0 ? row.venta_total / row.unidades_vendidas : 0)),
        vendido_pesos: Math.round(row.venta_total || 0)
      })).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    }
  }, [data, selectedYear, selectedMonth, viewMode, selectedWeek, selectedCompany])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-bold tracking-widest uppercase text-sm">Cargando informes...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <Link href="/informes" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
              <TrendingUp className="text-indigo-600" size={32} />
              Proyectado vs Ventas
            </h1>
          </div>
          <p className="text-slate-500 font-medium ml-12">Análisis de efectividad y desvíos comerciales por empresa.</p>
        </div>

        {/* Month/Year Selector */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <Calendar className="text-slate-400 ml-2" size={20} />
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent border-none font-bold text-slate-700 outline-none cursor-pointer"
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent border-none font-bold text-slate-700 outline-none cursor-pointer pr-4"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* 1. SECCIÓN DE TARJETAS RESUMEN POR CLIENTE (PANORAMA GENERAL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {companySummaryData.length === 0 ? (
          <div className="col-span-full py-10 text-center bg-slate-50 border border-slate-100 rounded-3xl text-slate-400 font-bold uppercase text-xs">
             No hay datos de clientes para este período
          </div>
        ) : (
          companySummaryData.map((client) => {
            const isGood = client.efectividad >= 90
            const isMedium = client.efectividad >= 70 && client.efectividad < 90
            const progressColor = isGood ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500'
            const badgeColor = isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isMedium ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            
            return (
              <div 
                key={client.empresa} 
                className="bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-indigo-200 rounded-[2rem] p-6 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <h3 className="font-black text-slate-800 text-base uppercase leading-tight truncate max-w-[170px]" title={client.empresa}>
                      {client.empresa}
                    </h3>
                    <span className={`text-[10px] font-black px-2.5 py-1 border rounded-full uppercase tracking-wider tabular-nums ${badgeColor}`}>
                      {client.efectividad.toFixed(0)}% Efec.
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
                    <div className={`h-full ${progressColor} rounded-full`} style={{ width: `${Math.min(client.efectividad, 100)}%` }} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Vendido</p>
                      <p className="text-lg font-black text-slate-700 tabular-nums">{client.vendido} u</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Proyectado</p>
                      <p className="text-lg font-black text-slate-500 tabular-nums">{client.proyectado} u</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400">Facturación</span>
                  <span className="font-black text-slate-800 tabular-nums">{formatCurrency(client.venta_total)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 2. BARRA DE CONTROLES: VIEW MODE TABS Y ZOOM FILTERS */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-white p-4 rounded-3xl border border-slate-200 gap-4">
        
        {/* View Mode Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl self-start lg:self-auto shadow-inner">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'weekly' 
                ? 'bg-white text-indigo-600 shadow-md font-extrabold' 
                : 'text-slate-500 hover:text-slate-800 font-bold'
            }`}
          >
            Resumen Semanal
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'daily' 
                ? 'bg-white text-indigo-600 shadow-md font-extrabold' 
                : 'text-slate-500 hover:text-slate-800 font-bold'
            }`}
          >
            Detalle Diario
          </button>
        </div>

        {/* Dynamic Zoom & Focus Filters - Only shown in Daily Mode */}
        {viewMode === 'daily' && (
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Week Zoom Filter */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>Zoom Semana:</span>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-transparent border-none outline-none font-black text-slate-800 cursor-pointer"
              >
                <option value={0}>Todo el Mes</option>
                <option value={1}>Semana 1 (Días 1-7)</option>
                <option value={2}>Semana 2 (Días 8-14)</option>
                <option value={3}>Semana 3 (Días 15-21)</option>
                <option value={4}>Semana 4 (Días 22+)</option>
              </select>
            </div>

            {/* Company Focus Filter */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-600">
              <Filter size={14} className="text-slate-400" />
              <span>Enfoque Empresa:</span>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-transparent border-none outline-none font-black text-slate-800 cursor-pointer max-w-[150px]"
              >
                <option value="all">Todas las Empresas</option>
                {activeCompaniesList.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            </div>

          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-20 text-center">
          <BarChart3 className="mx-auto text-slate-200 mb-4" size={64} />
          <p className="text-slate-400 font-bold uppercase tracking-widest">Sin datos para {months[selectedMonth]} {selectedYear}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
          
          {/* CHART 1: UNIDADES */}
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <Package size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Comparativa en Unidades</h2>
                  <p className="text-sm text-slate-400 font-bold uppercase">PAX Proyectado vs Sandwiches Vendidos</p>
                </div>
              </div>
            </div>

            <div className="h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    angle={viewMode === 'weekly' ? 0 : -90} 
                    textAnchor={viewMode === 'weekly' ? 'middle' : 'end'} 
                    interval={0} 
                    height={viewMode === 'weekly' ? 50 : 150}
                    tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ fontWeight: 800, fontSize: '13px' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '0', paddingBottom: '30px' }}
                  />
                  <Bar dataKey="proyectado" name="Proyectado" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={viewMode === 'weekly' ? 40 : 20} />
                  <Bar dataKey="vendido" name="Vendido" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={viewMode === 'weekly' ? 40 : 20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* CHART 2: PESOS */}
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Comparativa en Facturación ($)</h2>
                  <p className="text-sm text-slate-400 font-bold uppercase">Proyectado Estimado vs Realidad</p>
                </div>
              </div>
            </div>

            <div className="h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    angle={viewMode === 'weekly' ? 0 : -90} 
                    textAnchor={viewMode === 'weekly' ? 'middle' : 'end'} 
                    interval={0} 
                    height={viewMode === 'weekly' ? 50 : 150}
                    tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }}
                    tickFormatter={(val) => `$${val/1000}k`}
                  />
                  <Tooltip 
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ fontWeight: 800, fontSize: '13px' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '0', paddingBottom: '30px' }}
                  />
                  <Bar dataKey="proyectado_pesos" name="Proyectado ($)" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={viewMode === 'weekly' ? 40 : 20} />
                  <Bar dataKey="vendido_pesos" name="Vendido ($)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={viewMode === 'weekly' ? 40 : 20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
