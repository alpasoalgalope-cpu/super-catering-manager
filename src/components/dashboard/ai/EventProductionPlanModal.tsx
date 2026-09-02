"use client"

import React, { useState } from "react"
import { X, Clock, MessageSquare, Copy, Check, ChefHat, Sparkles, Loader2, Calendar } from "lucide-react"

interface EventProductionPlanModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    showTitle: string
    totalPax: number
    executiveNotes: string
    timeline: {
      phase: string
      title: string
      timeframe: string
      activities: string[]
    }[]
    kitchenWhatsappMessage: string
  } | null
  loading: boolean
}

export default function EventProductionPlanModal({ isOpen, onClose, data, loading }: EventProductionPlanModalProps) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'timeline' | 'whatsapp'>('timeline')

  if (!isOpen) return null

  const handleCopy = () => {
    if (!data?.kitchenWhatsappMessage) return
    navigator.clipboard.writeText(data.kitchenWhatsappMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <ChefHat size={24} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-400/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  Hoja de Ruta IA
                </span>
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight mt-0.5">
                Plan de Producción: {data?.showTitle || 'Evento'}
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

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-8 bg-slate-50 gap-4">
          <button
            onClick={() => setTab('timeline')}
            className={`py-3 px-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              tab === 'timeline'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock size={16} /> Cronograma D-2, D-1 y Día D
          </button>
          <button
            onClick={() => setTab('whatsapp')}
            className={`py-3 px-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              tab === 'whatsapp'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <MessageSquare size={16} /> WhatsApp para Cocina
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 size={40} className="text-indigo-600 animate-spin" />
              <p className="font-black text-slate-800 text-base uppercase tracking-tight">
                Generando hoja de ruta regresiva con Gemini...
              </p>
            </div>
          ) : data ? (
            <>
              {tab === 'timeline' && (
                <div className="space-y-6">
                  {/* Executive Notes */}
                  {data.executiveNotes && (
                    <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl text-xs text-slate-700 font-medium">
                      <span className="font-bold text-indigo-900 uppercase block mb-1">Pautas de Calidad:</span>
                      {data.executiveNotes}
                    </div>
                  )}

                  {/* 3-Phase Timeline */}
                  <div className="space-y-4">
                    {data.timeline?.map((phase, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                              {phase.phase}
                            </span>
                            <h4 className="font-black text-sm uppercase text-slate-900">
                              {phase.title}
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {phase.timeframe}
                          </span>
                        </div>
                        <ul className="space-y-1.5 pl-2">
                          {phase.activities?.map((act, aIdx) => (
                            <li key={aIdx} className="text-xs text-slate-700 font-semibold flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'whatsapp' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Mensaje listo para enviar al grupo de cocina:
                    </span>
                    <button
                      onClick={handleCopy}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? '¡Copiado!' : 'Copiar Mensaje'}
                    </button>
                  </div>

                  <div className="bg-slate-900 text-emerald-300 font-mono text-xs p-6 rounded-3xl whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
                    {data.kitchenWhatsappMessage}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Super Catering Manager IA
          </span>
          <div className="flex items-center gap-3">
            {data && (
              <button
                onClick={handleCopy}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '¡Copiado!' : 'Copiar para WhatsApp'}
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
