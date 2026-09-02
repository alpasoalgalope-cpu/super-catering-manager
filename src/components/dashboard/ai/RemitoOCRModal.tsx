"use client"

import React, { useState, useRef } from "react"
import { X, Camera, Upload, CheckCircle2, AlertCircle, Loader2, Sparkles, FileText, Plus, Trash2 } from "lucide-react"
import { scanRemitoOCRAction } from "@/app/actions/gemini-copilot"

interface RemitoOCRModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyData?: (data: any) => void
}

export default function RemitoOCRModal({ isOpen, onClose, onApplyData }: RemitoOCRModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setImagePreview(base64)
      setExtractedData(null)
      setError(null)
      await runOCR(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const runOCR = async (base64: string, mimeType: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await scanRemitoOCRAction(base64, mimeType || "image/jpeg")
      if (!res.success) throw new Error(res.error)
      setExtractedData(res.data)
    } catch (err: any) {
      setError(err.message || "Error al procesar la imagen del remito.")
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (extractedData && onApplyData) {
      onApplyData(extractedData)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Camera size={24} className="text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  Gemini Vision OCR
                </span>
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight mt-0.5">
                Escanear Remito de Proveedor
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-slate-200 hover:border-emerald-500 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center shadow-inner transition-transform group-hover:scale-110">
                <Upload size={28} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base uppercase">
                  Subí o sacá una foto del remito
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Formatos soportados: JPG, PNG, WEBP (Se procesará automáticamente con IA)
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Image Preview */}
              <div className="md:col-span-5 space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 max-h-80">
                  <img
                    src={imagePreview}
                    alt="Remito Escaneado"
                    className="w-full h-auto object-contain max-h-80 mx-auto"
                  />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cambiar Imagen
                </button>
              </div>

              {/* Right Column: OCR Extraction Results */}
              <div className="md:col-span-7 space-y-4">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                    <Loader2 size={36} className="text-emerald-600 animate-spin" />
                    <p className="font-black text-slate-800 text-sm uppercase tracking-tight">
                      Analizando texto, bultos y cantidades con Gemini Vision...
                    </p>
                  </div>
                ) : error ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : extractedData ? (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block">
                          Proveedor Detectado
                        </span>
                        <span className="font-black text-xs text-slate-900 uppercase">
                          {extractedData.proveedor_detectado || 'S/D'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block">
                          Nro Comprobante
                        </span>
                        <span className="font-black text-xs text-slate-900">
                          {extractedData.nro_comprobante || 'S/N'}
                        </span>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-wider">
                          <tr>
                            <th className="p-2.5">Ítem / Insumo</th>
                            <th className="p-2.5 text-right">Cant</th>
                            <th className="p-2.5 text-right">Bultos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                          {extractedData.items?.map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5">{it.descripcion}</td>
                              <td className="p-2.5 text-right tabular-nums text-emerald-700 font-black">
                                {it.cantidad} {it.unidad_medida || ''}
                              </td>
                              <td className="p-2.5 text-right tabular-nums text-slate-500">
                                {it.bultos || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {extractedData.observaciones && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {extractedData.observaciones}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Recepción Inteligente OCR
          </span>
          <div className="flex items-center gap-3">
            {extractedData && (
              <button
                onClick={handleApply}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 size={14} /> Usar Datos del Remito
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
