"use client"

import React, { useState, useEffect, useCallback } from "react"
import { getRVTrasladosReportAction, getRVTrasladosShowsComparisonAction, RVCoordinatorPerformance } from "@/app/actions/reports"
import { Users, TrendingUp, DollarSign, Package, Calendar, Loader2, ArrowLeft, Trophy, Zap, Search, Check } from "lucide-react"
import Link from "next/link"

interface ShowItem {
  id: string
  name: string
  date: string
}

interface ComparisonRow {
  coordinador: string
  venta_seleccionada: number
  conv_seleccionada: number
  conv_historica: number
  diferencia: number
}

export default function RVTrasladosReport() {
  const [data, setData] = useState<RVCoordinatorPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Comparative states
  const [shows, setShows] = useState<ShowItem[]>([])
  const [selectedShows, setSelectedShows] = useState<string[]>([])
  const [comparisonList, setComparisonList] = useState<ComparisonRow[]>([])
  const [selectedRevenue, setSelectedRevenue] = useState(0)
  const [showSearch, setShowSearch] = useState("")
  const [loadingComparison, setLoadingComparison] = useState(false)

  const loadBaseReport = useCallback(async () => {
    setLoading(true)
    const res = await getRVTrasladosReportAction()
    if (res.error) setError(res.error)
    else if (res.data) setData(res.data)
    setLoading(false)
  }, [])

  const loadShows = useCallback(async () => {
    const res = await getRVTrasladosShowsComparisonAction([])
    if (res.success && res.shows) {
      setShows(res.shows)
    }
  }, [])

  const loadComparison = useCallback(async () => {
    if (selectedShows.length === 0) {
      setComparisonList([])
      setSelectedRevenue(0)
      return
    }
    setLoadingComparison(true)
    const res = await getRVTrasladosShowsComparisonAction(selectedShows)
    if (res.success && res.comparison) {
      setComparisonList(res.comparison)
      setSelectedRevenue(res.grandTotalSalesSelected || 0)
    }
    setLoadingComparison(false)
  }, [selectedShows])

  useEffect(() => {
    loadBaseReport()
    loadShows()
  }, [loadBaseReport, loadShows])

  useEffect(() => {
    loadComparison()
  }, [loadComparison])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="font-bold tracking-widest uppercase text-sm italic">Analizando desempeño de coordinadores...</p>
    </div>
  )

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/informes" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
              RV Traslados <span className="text-indigo-600">| Desempeño</span>
            </h1>
            <p className="text-slate-500 font-medium">Análisis histórico de ventas por coordinador.</p>
          </div>
        </div>
      </div>

      {error && <div className="p-6 bg-rose-50 border border-rose-100 text-rose-600 rounded-3xl font-bold">{error}</div>}

      {/* Podium / Dual Top Performers */}
      {data.length > 0 && (() => {
        const topVolumeCoord = data[0];
        const topEfficiencyCoord = [...data].sort((a, b) => b.conversion - a.conversion)[0];
        
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Card 1: Master de Volumen */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[3rem] p-8 text-white shadow-xl relative overflow-hidden group hover:shadow-2xl hover:shadow-indigo-950/20 transition-all duration-300">
              <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-500">
                <Trophy size={160} />
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                   <Trophy size={28} className="text-amber-300" />
                </div>
                <div>
                  <p className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[9px] leading-none mb-1">Máxima Facturación</p>
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest leading-none">Master de Volumen</h4>
                </div>
              </div>
              <div className="space-y-4">
                 <h2 className="text-4xl font-black italic tracking-tighter truncate">{topVolumeCoord.coordinador}</h2>
                 <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                       <DollarSign size={16} className="text-emerald-400" />
                       <span className="text-xl font-black">{formatCurrency(topVolumeCoord.total_venta)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Calendar size={16} className="text-indigo-300" />
                       <span className="text-sm font-bold text-slate-300">{topVolumeCoord.total_eventos} Eventos</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <TrendingUp size={16} className="text-amber-400" />
                       <span className="text-sm font-bold text-slate-300">{topVolumeCoord.conversion.toFixed(1)}% Conv.</span>
                    </div>
                 </div>
              </div>
            </div>

            {/* Card 2: Líder de Eficiencia */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[3rem] p-8 text-white shadow-xl relative overflow-hidden group hover:shadow-2xl hover:shadow-emerald-950/20 transition-all duration-300">
              <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-500">
                <Zap size={160} />
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                   <Zap size={28} className="text-amber-300" />
                </div>
                <div>
                  <p className="text-emerald-200 font-black uppercase tracking-[0.2em] text-[9px] leading-none mb-1">Efectividad Comercial</p>
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest leading-none">Líder de Eficiencia</h4>
                </div>
              </div>
              <div className="space-y-4">
                 <h2 className="text-4xl font-black italic tracking-tighter truncate">{topEfficiencyCoord.coordinador}</h2>
                 <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                       <TrendingUp size={16} className="text-amber-300" />
                       <span className="text-xl font-black">{topEfficiencyCoord.conversion.toFixed(1)}% Conv.</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <DollarSign size={16} className="text-emerald-300" />
                       <span className="text-sm font-bold text-emerald-100">{formatCurrency(topEfficiencyCoord.total_venta)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Calendar size={16} className="text-teal-200" />
                       <span className="text-sm font-bold text-teal-100">{topEfficiencyCoord.total_eventos} Eventos</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Shows Comparative Section */}
      <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic flex items-center gap-2">
            <Users className="text-indigo-600" size={24} /> Comparador de Desempeño por Show
          </h2>
          <p className="text-slate-500 font-medium text-sm">
            Selecciona uno o más recitales para analizar qué coordinadores viajaron, su porcentaje de facturación en esos shows y cómo se compara con su promedio histórico.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Shows list checklist */}
          <div className="lg:col-span-1 bg-slate-50 rounded-[2rem] p-6 border border-slate-200 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Listado de Shows</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedShows(shows.map(s => s.id))}
                  className="text-[10px] font-black text-indigo-600 hover:underline uppercase"
                >
                  Todos
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button 
                  onClick={() => setSelectedShows([])}
                  className="text-[10px] font-black text-slate-400 hover:underline uppercase"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Buscar show..."
                value={showSearch}
                onChange={e => setShowSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 transition"
              />
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {shows
                .filter(s => s.name.toLowerCase().includes(showSearch.toLowerCase()))
                .map(s => {
                  const isChecked = selectedShows.includes(s.id)
                  return (
                    <label 
                      key={s.id} 
                      className={`flex items-start gap-3 p-3 rounded-xl border text-xs font-bold cursor-pointer select-none transition-all ${
                        isChecked 
                          ? "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-sm" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedShows(prev => 
                            prev.includes(s.id) 
                              ? prev.filter(id => id !== s.id) 
                              : [...prev, s.id]
                          )
                        }}
                        className="sr-only"
                      />
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition ${
                        isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                      }`}>
                        {isChecked && <Check size={10} strokeWidth={4} />}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold leading-tight">{s.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 leading-none mt-1">{s.date}</p>
                      </div>
                    </label>
                  )
                })}
              {shows.length === 0 && (
                <p className="text-slate-400 text-center py-10 text-xs font-bold">No hay shows registrados</p>
              )}
            </div>
          </div>

          {/* Right Column: Comparative table */}
          <div className="lg:col-span-2 flex flex-col justify-between">
            {selectedShows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50 flex-1">
                <Users size={32} className="text-slate-300 mb-2" />
                <p className="font-black uppercase tracking-widest text-xs">Ningún show seleccionado</p>
                <p className="text-[10px] text-slate-400 mt-1">Selecciona uno o más recitales de la lista izquierda para iniciar la comparación.</p>
              </div>
            ) : loadingComparison ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 flex-1">
                <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                <p className="text-xs font-bold uppercase tracking-wider">Calculando comparativa de ventas...</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-[2rem] overflow-hidden flex-1 flex flex-col justify-between">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-4 px-5 font-black uppercase text-slate-400 tracking-wider">Coordinador</th>
                        <th className="py-4 px-5 font-black uppercase text-slate-400 tracking-wider text-right">Venta en Shows</th>
                        <th className="py-4 px-5 font-black uppercase text-slate-400 tracking-wider text-center">Conv. Shows</th>
                        <th className="py-4 px-5 font-black uppercase text-slate-400 tracking-wider text-center">Conv. Histórica</th>
                        <th className="py-4 px-5 font-black uppercase text-slate-400 tracking-wider text-center">Desviación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonList.map((c, idx) => {
                        const isPositive = c.diferencia > 0
                        const isZero = c.diferencia === 0
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-5 font-bold text-slate-800">{c.coordinador}</td>
                            <td className="py-3.5 px-5 text-right font-black text-slate-700">
                              {formatCurrency(c.venta_seleccionada)}
                            </td>
                            <td className="py-3.5 px-5 text-center font-black text-indigo-600">
                              {c.conv_seleccionada.toFixed(1)}%
                            </td>
                            <td className="py-3.5 px-5 text-center font-black text-slate-500">
                              {c.conv_historica.toFixed(1)}%
                            </td>
                            <td className={`py-3.5 px-5 text-center font-black ${
                              isZero ? "text-slate-400" : isPositive ? "text-emerald-600" : "text-rose-500"
                            }`}>
                              {isZero ? "0.0%" : (isPositive ? "+" : "") + c.diferencia.toFixed(1) + "%"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer comparison summary */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500 rounded-b-[2rem]">
                  <span>Total Facturación en Seleccionados:</span>
                  <span className="text-sm font-black text-slate-900">{formatCurrency(selectedRevenue)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {data.slice(1).map((coord, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
               <div className="flex justify-between items-start mb-4">
                  <div className="bg-slate-50 p-3 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                     <Users size={20} className="text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">#{idx + 2} Ranking</span>
               </div>
               <h3 className="text-xl font-black text-slate-800 italic uppercase mb-4">{coord.coordinador}</h3>
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-400 font-bold uppercase text-[10px]">Viajes (Eventos)</span>
                     <span className="font-bold text-slate-600">{coord.total_eventos}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-400 font-bold uppercase text-[10px]">Ventas Totales</span>
                     <span className="font-black text-slate-700">{formatCurrency(coord.total_venta)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-400 font-bold uppercase text-[10px]">Conversión PAX/Vta</span>
                     <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{coord.conversion.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-400 font-bold uppercase text-[10px]">Venta p/ Viaje</span>
                     <span className="font-bold text-emerald-600">{formatCurrency(coord.promedio_venta_evento)}</span>
                  </div>
               </div>
            </div>
         ))}
      </div>

      {data.length === 0 && !loading && (
        <div className="bg-slate-50 p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em]">No hay datos históricos suficientes para RV Traslados</p>
        </div>
      )}
    </div>
  )
}
