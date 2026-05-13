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

  const chartData = useMemo(() => {
    // Filter by year and month
    const filtered = data.filter(row => {
      const d = new Date(row.fecha + 'T12:00:00')
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
    })

    // Group by Date + Company for the chart
    // Recharts expects an array of objects where each object is a "point" on the X axis.
    // Since the user wants X-axis as Date, but grouped by Company.
    // A better approach for "Eje X Fecha, barras por empresa" is to have a "Date - Company" label on X
    // OR have grouped bars on each date.
    
    // Let's create a list of entries for each event/company combo
    return filtered.map(row => ({
      name: `${new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} - ${row.empresa}`,
      fecha: row.fecha,
      empresa: row.empresa,
      proyectado: row.pax_proyectado,
      vendido: row.unidades_vendidas,
      proyectado_pesos: row.pax_proyectado * (row.unidades_vendidas > 0 ? row.venta_total / row.unidades_vendidas : 0), // Estimate projected $
      vendido_pesos: row.venta_total
    })).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  }, [data, selectedYear, selectedMonth])

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
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
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

      {chartData.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-20 text-center">
          <BarChart3 className="mx-auto text-slate-200 mb-4" size={64} />
          <p className="text-slate-400 font-bold uppercase tracking-widest">Sin datos para {months[selectedMonth]} {selectedYear}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
          
          {/* CHART 1: UNIDADES */}
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
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
                    angle={-90} 
                    textAnchor="end" 
                    interval={0} 
                    height={150}
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
                  <Bar dataKey="proyectado" name="Proyectado" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="vendido" name="Vendido" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* CHART 2: PESOS */}
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
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
                    angle={-90} 
                    textAnchor="end" 
                    interval={0} 
                    height={150}
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
                  <Bar dataKey="proyectado_pesos" name="Proyectado ($)" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="vendido_pesos" name="Vendido ($)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
