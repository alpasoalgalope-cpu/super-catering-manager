"use client"

import React, { useState } from "react"
import { X, Sparkles, Copy, Check, Calendar, AlertTriangle, Clock, ChefHat, MessageSquare, Loader2 } from "lucide-react"

interface WeeklyBriefingModalProps {
  isOpen: boolean
  onClose: () => void
  briefingData: {
    summary: string
    whatsappText: string
    criticalIngredients: { name: string; quantity: string; unit: string; category: string }[]
    overlapAlerts: string[]
    miseEnPlaceSchedule: { day: string; tasks: string[] }[]
  } | null
  loading: boolean
}

export default function WeeklyBriefingModal({ isOpen, onClose, briefingData, loading }: WeeklyBriefingModalProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'briefing' | 'whatsapp' | 'schedule'>('briefing')

  if (!isOpen) return null

  const handleCopy = () => {
    if (!briefingData?.whatsappText) return
    navigator.clipboard.writeText(briefingData.whatsappText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Sparkles size={24} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  Gemini 2.5 Flash IA
                </span>
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight mt-0.5">
                Minuta Semanal de Producción
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-8 bg-slate-50 gap-4">
          <button
            onClick={() => setActiveTab('briefing')}
            className={`py-3 px-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'briefing'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <ChefHat size={16} /> Resumen Ejecutivo & Insumos
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 px-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'schedule'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock size={16} /> Cronograma Mise en Place
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`py-3 px-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <MessageSquare size={16} /> Formato WhatsApp
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 size={48} className="text-indigo-600 animate-spin" />
              <div>
                <p className="font-black text-slate-800 text-lg uppercase tracking-tight">
                  Gemini está analizando los shows y recetas...
                </p>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                  Consolidando insumos críticos y calculando cronograma de mise en place
                </p>
              </div>
            </div>
          ) : briefingData ? (
            <>
              {activeTab === 'briefing' && (
                <div className="space-y-6">
                  {/* Executive Summary Box */}
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-900 mb-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-600" /> Diagnóstico Operativo
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                      {briefingData.summary}
                    </p>
                  </div>

                  {/* Overlap & Critical Alerts */}
                  {briefingData.overlapAlerts && briefingData.overlapAlerts.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-900 mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-600" /> Alertas Operativas Críticas
                      </h3>
                      <ul className="space-y-2">
                        {briefingData.overlapAlerts.map((alert, idx) => (
                          <li key={idx} className="text-xs font-bold text-amber-800 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{alert}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Consolidated Critical Ingredients Table */}
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                      <ChefHat size={16} className="text-indigo-600" /> Insumos Críticos a Producir
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {briefingData.criticalIngredients.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block mb-1">
                              {item.category}
                            </span>
                            <h4 className="font-black text-xs text-slate-800 leading-tight">
                              {item.name}
                            </h4>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-baseline justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Cantidad:</span>
                            <span className="text-base font-black text-slate-900 tabular-nums">
                              {item.quantity} <span className="text-[10px] font-bold text-slate-500 uppercase">{item.unit}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-indigo-600" /> Cronograma Sugerido de Mise en Place
                  </h3>
                  <div className="space-y-4">
                    {briefingData.miseEnPlaceSchedule.map((dayPlan, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                          <Calendar size={16} className="text-indigo-600" />
                          <h4 className="font-black text-xs uppercase tracking-widest text-slate-800">
                            {dayPlan.day}
                          </h4>
                        </div>
                        <ul className="space-y-2 pl-2">
                          {dayPlan.tasks.map((task, tIdx) => (
                            <li key={tIdx} className="text-xs font-bold text-slate-700 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'whatsapp' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Mensaje estructurado con formato enriquecido para WhatsApp:
                    </span>
                    <button
                      onClick={handleCopy}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? '¡Copiado!' : 'Copiar para WhatsApp'}
                    </button>
                  </div>

                  <div className="bg-slate-900 text-emerald-300 font-mono text-xs p-6 rounded-3xl whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800 overflow-x-auto">
                    {briefingData.whatsappText}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm font-bold">
              Sin datos generados.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Powered by Google Gemini 2.5 Flash
          </span>
          <div className="flex items-center gap-3">
            {briefingData && (
              <button
                onClick={handleCopy}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '¡Copiado!' : 'Copiar Minuta'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
