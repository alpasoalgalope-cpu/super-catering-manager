"use client"

import React, { useState } from 'react'
import { Plus, Loader2, CheckCircle2, AlertCircle, X, Save } from 'lucide-react'
import { upsertLead, LeadStage } from '@/app/actions/crm'

interface LeadFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  initialData?: any
}

export default function LeadForm({ onSuccess, onCancel, initialData }: LeadFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

  const [formData, setFormData] = useState({
    razon_social: initialData?.razon_social || '',
    tax_id: initialData?.tax_id || '',
    contacto_principal: initialData?.contacto_principal || '',
    email_contacto: initialData?.email_contacto || '',
    telefono: initialData?.telefono || '',
    etapa: (initialData?.etapa as LeadStage) || 'Prospecto',
    valor_estimado: initialData?.valor_estimado || 0,
    notas: initialData?.notas || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const result = await upsertLead({
      ...formData,
      id: initialData?.id
    })

    if (result.success) {
      setMessage({ text: 'Empresa guardada exitosamente', type: 'success' })
      if (!initialData) {
        setFormData({
          razon_social: '',
          tax_id: '',
          contacto_principal: '',
          email_contacto: '',
          telefono: '',
          etapa: 'Prospecto',
          valor_estimado: 0,
          notas: ''
        })
      }
      setTimeout(() => {
        if (onSuccess) onSuccess()
      }, 1000)
    } else {
      setMessage({ text: `Error: ${result.error}`, type: 'error' })
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="text-xl font-bold text-slate-900 uppercase italic tracking-tighter">
            {initialData ? 'Editar Lead' : 'Nuevo Registro de Empresa'}
          </h3>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Staging de Empresa Maestra</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all">
            <X size={20} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Razón Social</label>
            <input
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={formData.razon_social}
              onChange={e => setFormData({ ...formData, razon_social: e.target.value })}
              placeholder="Ej: Catering Gourmet S.A."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">CUIT / ID Fiscal</label>
            <input
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={formData.tax_id}
              onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
              placeholder="Ej: 30-71234567-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Contacto Principal</label>
            <input
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={formData.contacto_principal}
              onChange={e => setFormData({ ...formData, contacto_principal: e.target.value })}
              placeholder="Nombre del responsable"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Email</label>
            <input
              type="email"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={formData.email_contacto}
              onChange={e => setFormData({ ...formData, email_contacto: e.target.value })}
              placeholder="contacto@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Teléfono</label>
            <input
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={formData.telefono}
              onChange={e => setFormData({ ...formData, telefono: e.target.value })}
              placeholder="+54 11 ..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Etapa del Pipeline</label>
            <select
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
              value={formData.etapa}
              onChange={e => setFormData({ ...formData, etapa: e.target.value as LeadStage })}
            >
              <option value="Prospecto">Prospecto</option>
              <option value="Contactado">Contactado</option>
              <option value="En prueba">En prueba</option>
              <option value="Cliente activo">Cliente activo</option>
              <option value="Cliente dormido">Cliente dormido</option>
              <option value="Perdido">Perdido</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Valor Estimado (ARS)</label>
            <input
              type="number"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={formData.valor_estimado}
              onChange={e => setFormData({ ...formData, valor_estimado: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Notas y Observaciones</label>
          <textarea
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all min-h-[100px]"
            value={formData.notas}
            onChange={e => setFormData({ ...formData, notas: e.target.value })}
            placeholder="Detalles adicionales sobre la empresa o el contacto..."
          />
        </div>

        <div className="pt-4 flex gap-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {initialData ? 'Actualizar Registro' : 'Grabar en Pipeline'}
          </button>
        </div>
      </form>
    </div>
  )
}
