"use client"

import React from "react"
import { X, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Loader2 } from "lucide-react"

interface FinancialDiagnosisModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    healthStatus: 'SALUDABLE' | 'PRECAUCION' | 'DEFICIT'
    marginPct: number
    executiveSummary: string
    showAnalysis: {
      showName: string
      revenue: number
      costRatio: string
      status: 'VERDE' | 'AMARILLO' | 'ROJO'
      note: string
    }[]
    keyInsights: string[]
    optimizations: string[]
  } | null
  loading: boolean
}

export default function FinancialDiagnosisModal({ isOpen, onClose, data, loading }: FinancialDiagnosisModalProps) {
  if (!isOpen) return null

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)

  const statusConfig = {
    SALUDABLE: {
      label: 'MARGEN SALUDABLE',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: CheckCircle2,
      badge: 'bg-emerald-500'
    },
    PRECAUCION: {
      label: 'PRECAUCIÓN / AJUSTADO',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: AlertTriangle,
      badge: 'bg-amber-500'
    },
    DEFICIT: {
      label: 'DÉFICIT / RIESGO',
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: ShieldAlert,
      badge: 'bg-rose-500'
    }
  }

  const currentCfg = data?.healthStatus ? statusConfig[data.healthStatus] : statusConfig.SALUDABLE
  const StatusIcon = currentCfg.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-amber-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <DollarSign size={24} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  Gemini Copilot Financiero
                </span>
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight mt-0.5">
                Diagnóstico de Rentabilidad Semanal
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 size={48} className="text-amber-500 animate-spin" />
              <div>
                <p className="font-black text-slate-800 text-lg uppercase tracking-tight">
                  Analizando facturación vs costos de insumos...
                </p>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                  Evaluando márgenes brutos y desvíos por evento
                </p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              
              {/* Main Traffic Light Card */}
              <div className={`p-6 rounded-3xl border flex items-center justify-between ${currentCfg.color}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center shadow-xs">
                    <StatusIcon size={28} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">
                      Estado General de la Semana
                    </span>
                    <h3 className="text-xl font-black uppercase tracking-tight">
                      {currentCfg.label}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">
                    Margen Estimado
                  </span>
                  <span className="text-3xl font-black tabular-nums">
                    {data.marginPct}%
                  </span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" /> Resumen Ejecutivo del CFO
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                  {data.executiveSummary}
                </p>
              </div>

              {/* Breakdown per Show */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-3">
                  Análisis de Rentabilidad por Show
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.showAnalysis?.map((sh, idx) => {
                    const pillColor =
                      sh.status === 'VERDE'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : sh.status === 'AMARILLO'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200'

                    return (
                      <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-black text-xs uppercase text-slate-900 truncate">
                            {sh.showName}
                          </h5>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${pillColor}`}>
                            {sh.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-400 font-bold">Facturación:</span>
                          <span className="font-black text-slate-800 tabular-nums">{formatCurrency(sh.revenue)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold bg-slate-50 p-2 rounded-xl border border-slate-100">
                          {sh.note}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recommendations and Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-indigo-600" /> Insights Estratégicos
                  </h5>
                  <ul className="space-y-1.5">
                    {data.keyInsights?.map((ins, i) => (
                      <li key={i} className="text-xs text-indigo-950 font-medium flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <TrendingDown size={14} className="text-emerald-600" /> Oportunidades de Optimización
                  </h5>
                  <ul className="space-y-1.5">
                    {data.optimizations?.map((opt, i) => (
                      <li key={i} className="text-xs text-emerald-950 font-medium flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Powered by Google Gemini 2.5 Flash
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
