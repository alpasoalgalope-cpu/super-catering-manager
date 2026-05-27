"use client"

import React, { useState, useEffect } from "react"
import { getRVTrasladosReportAction, RVCoordinatorPerformance } from "@/app/actions/reports"
import { Users, TrendingUp, DollarSign, Package, Calendar, Loader2, ArrowLeft, Trophy, Zap } from "lucide-react"
import Link from "next/link"

export default function RVTrasladosReport() {
  const [data, setData] = useState<RVCoordinatorPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await getRVTrasladosReportAction()
      if (res.error) setError(res.error)
      else if (res.data) setData(res.data)
      setLoading(false)
    }
    load()
  }, [])

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
