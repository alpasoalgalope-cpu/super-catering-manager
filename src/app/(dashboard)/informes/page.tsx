"use client"

import React, { useState, useEffect, useMemo } from "react"
import { getReportsDataAction, ReportRow } from "@/app/actions/reports"
import { 
  Search, Loader2, ArrowUpDown, Download, TrendingUp, 
  BarChart3, ChevronRight, Trophy, DollarSign, PieChart,
  ClipboardList, Activity, Calculator, Smile
} from "lucide-react"
import Link from "next/link"

export default function InformesPage() {
  const [data, setData] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters for the detailed table
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<'fecha' | 'venta_total' | 'pax_proyectado'>('fecha')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getReportsDataAction()
      if (res.error) setError(res.error)
      else if (res.data) setData(res.data)
      setLoading(false)
    }
    loadData()
  }, [])

  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data]
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      filtered = filtered.filter(row => 
        row.evento.toLowerCase().includes(lower) || 
        row.empresa.toLowerCase().includes(lower) ||
        row.venue.toLowerCase().includes(lower) ||
        row.coordinador.toLowerCase().includes(lower)
      )
    }
    filtered.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'fecha') {
        valA = new Date(valA + 'T12:00:00').getTime()
        valB = new Date(valB + 'T12:00:00').getTime()
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return filtered
  }, [data, searchTerm, sortBy, sortOrder])

  const toggleSort = (field: 'fecha' | 'venta_total' | 'pax_proyectado') => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('desc') }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  const formatPct = (pct: number) => `${pct.toFixed(1)}%`

  const handleExport = () => {
    if (!filteredAndSortedData.length) return
    try {
      const { utils, writeFile } = require('xlsx')
      const exportData = filteredAndSortedData.map(r => ({
        'Fecha': new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR'),
        'Coordinador': r.coordinador,
        'Evento': r.evento,
        'Venue': r.venue,
        'Empresa': r.empresa,
        'PAX Proyectado': r.pax_proyectado,
        'Unidades Vendidas': r.unidades_vendidas,
        'Unidades Liberadas': r.unidades_liberadas,
        'Total Unidades': r.total_unidades,
        'Tradicionales': r.trad_qty,
        'Vegetarianos': r.veg_qty,
        'Veganos': r.vegan_qty,
        'Sin TACC': r.sintacc_qty,
        'Venta ($)': r.venta_total
      }))
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, "Informe Ventas")
      writeFile(wb, `Informe_Ventas_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err) { console.error("Export error:", err) }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Activity className="text-indigo-600" size={32} /> Central de <span className="text-indigo-600">Informes</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Análisis de rendimiento operativo y salud financiera del negocio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* SECCIÓN 1: RENDIMIENTO OPERATIVO */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Rendimiento Operativo</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <Link href="/informes/proyectado-vs-ventas" className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic">Proyectado vs Ventas</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Análisis de cumplimiento por empresa</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition" />
            </Link>

            <Link href="/informes/rv-traslados" className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Trophy size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic">Desempeño RV Traslados</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Ranking de coordinadores y conversión</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition" />
            </Link>

            <Link href="/informes/satisfaccion" className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition">
                  <Smile size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic">Historial de Satisfacción</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Monitoreo de calidad y tasa de respuesta por show</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition" />
            </Link>
          </div>
        </div>

        {/* SECCIÓN 2: ANÁLISIS FINANCIERO */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <DollarSign size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Análisis Financiero</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Link href="/informes/flujo-caja" className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic">Análisis de Flujo de Caja</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Evolución mensual, ingresos/egresos y rubros</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition" />
            </Link>

            <Link href="/informes/financieros" className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-rose-100 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl group-hover:bg-rose-600 group-hover:text-white transition">
                  <PieChart size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic">Rentabilidad y Costos</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Materia Prima vs Logística vs Extras</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-rose-500 transform group-hover:translate-x-1 transition" />
            </Link>

            <Link href="/finanzas/iva" className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-violet-100 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-violet-50 text-violet-600 rounded-2xl group-hover:bg-violet-600 group-hover:text-white transition">
                  <Calculator size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic">Gestión y Conciliación de IVA</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Mapeo de comprobantes AFIP y doble párrafo de IVA</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-violet-500 transform group-hover:translate-x-1 transition" />
            </Link>
          </div>
        </div>
      </div>

      {/* DETALLE OPERATIVO (LA TABLA) */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <ClipboardList size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Detalle Operativo de Eventos</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition w-48"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={handleExport} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white transition shadow-sm">
              <Download size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            {loading ? (
              <div className="p-20 text-center"><Loader2 className="animate-spin inline-block text-indigo-500" size={32} /></div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-4 pl-6 cursor-pointer" onClick={() => toggleSort('fecha')}>Fecha</th>
                    <th className="p-4">Coordinador</th>
                    <th className="p-4">Evento</th>
                    <th className="p-4">Empresa</th>
                    <th className="p-4 text-center">PAX Proy.</th>
                    <th className="p-4 text-center text-indigo-600">Total Un.</th>
                    <th className="p-4 pr-6 text-right text-emerald-600 cursor-pointer" onClick={() => toggleSort('venta_total')}>Venta ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredAndSortedData.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6 font-bold">{new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td className="p-4 text-slate-500">{row.coordinador}</td>
                      <td className="p-4 font-bold text-slate-900">{row.evento}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black uppercase">{row.empresa}</span>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-400">{row.pax_proyectado}</td>
                      <td className="p-4 text-center font-black text-indigo-600">{row.total_unidades}</td>
                      <td className="p-4 pr-6 text-right font-black text-emerald-600">{formatCurrency(row.venta_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
