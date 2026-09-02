"use client"

import React from "react"
import { X, Truck, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Loader2 } from "lucide-react"

interface SupplierShortagesModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    status: 'OPTIMO' | 'ALERTA' | 'CRITICO'
    diagnosis: string
    shortages: { item: string; needed: string; arriving: string; diff: string; severity: 'ALTA' | 'MEDIA' | 'BAJA' }[]
    recommendedActions: string[]
  } | null
  loading: boolean
}

export default function SupplierShortagesModal({ isOpen, onClose, data, loading }: SupplierShortagesModalProps) {
  if (!isOpen) return null

  const statusConfig = {
    OPTIMO: {
      label: 'STOCK Y RECEPCIONES EN ORDEN',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: CheckCircle2,
    },
    ALERTA: {
      label: 'FALTANTES MENORES DETECTADOS',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: AlertTriangle,
    },
    CRITICO: {
      label: 'FALTANTES CRÍTICOS PARA ESTA SEMANA',
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: ShieldAlert,
    }
  }

  const currentCfg = data?.status ? statusConfig[data.status] : statusConfig.OPTIMO
  const StatusIcon = currentCfg.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400 shadow-inner">
              <Truck size={24} className="text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-teal-400/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-400/30">
                  Control Predictivo IA
                </span>
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight mt-0.5">
                Cruce de Insumos vs Producción
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
              <Loader2 size={48} className="text-teal-600 animate-spin" />
              <div>
                <p className="font-black text-slate-800 text-lg uppercase tracking-tight">
                  Comparando órdenes de compra vs PAX de los shows...
                </p>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                  Verificando stock de panes, fiambres, bebidas y descartables
                </p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Traffic light banner */}
              <div className={`p-6 rounded-3xl border flex items-center gap-4 ${currentCfg.color}`}>
                <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center shadow-xs">
                  <StatusIcon size={28} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">
                    Estado de Abastecimiento Semanal
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tight">
                    {currentCfg.label}
                  </h3>
                </div>
              </div>

              {/* Diagnosis text */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-teal-600" /> Diagnóstico Predictivo
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                  {data.diagnosis}
                </p>
              </div>

              {/* Shortages table */}
              {data.shortages && data.shortages.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-3">
                    Balance de Insumos Críticos
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-wider">
                        <tr>
                          <th className="p-3">Insumo</th>
                          <th className="p-3 text-right">Demanda (PAX)</th>
                          <th className="p-3 text-right">Llegando (OC)</th>
                          <th className="p-3 text-right">Diferencia</th>
                          <th className="p-3 text-center">Severidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                        {data.shortages.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3">{s.item}</td>
                            <td className="p-3 text-right tabular-nums text-slate-600">{s.needed}</td>
                            <td className="p-3 text-right tabular-nums text-slate-600">{s.arriving}</td>
                            <td className={`p-3 text-right tabular-nums font-black ${s.diff.startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {s.diff}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                                s.severity === 'ALTA'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : s.severity === 'MEDIA'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {s.severity}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {data.recommendedActions && data.recommendedActions.length > 0 && (
                <div className="bg-teal-50/60 border border-teal-100 p-5 rounded-2xl space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                    <Truck size={14} className="text-teal-600" /> Acciones Sugeridas de Compras
                  </h5>
                  <ul className="space-y-1.5">
                    {data.recommendedActions.map((act, i) => (
                      <li key={i} className="text-xs text-teal-950 font-medium flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Super Catering Manager IA
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
