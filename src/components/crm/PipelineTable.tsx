"use client"

import React, { useState } from 'react'
import { MoreHorizontal, Mail, Phone, Calendar, DollarSign, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { deleteLead, LeadStage } from '@/app/actions/crm'

interface PipelineTableProps {
  leads: any[]
  onEdit: (lead: any) => void
}

export default function PipelineTable({ leads, onEdit }: PipelineTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const getStageColor = (stage: LeadStage) => {
    switch (stage) {
      case 'Prospecto': return 'bg-slate-100 text-slate-600 border-slate-200'
      case 'Contactado': return 'bg-blue-50 text-blue-600 border-blue-100'
      case 'En prueba': return 'bg-purple-50 text-purple-600 border-purple-100'
      case 'Cliente activo': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
      case 'Cliente dormido': return 'bg-amber-50 text-amber-600 border-amber-100'
      case 'Perdido': return 'bg-rose-50 text-rose-600 border-rose-100'
      default: return 'bg-slate-50 text-slate-500'
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este lead?')) return
    setIsDeleting(id)
    await deleteLead(id)
    setIsDeleting(null)
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <th className="px-6 py-5 font-bold">Empresa / Razón Social</th>
              <th className="px-6 py-5 font-bold">Etapa</th>
              <th className="px-6 py-5 font-bold">Contacto</th>
              <th className="px-6 py-5 font-bold text-right">Valor Est.</th>
              <th className="px-6 py-5 font-bold">Fecha Alta</th>
              <th className="px-6 py-5 font-bold text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{lead.razon_social}</span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{lead.tax_id}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStageColor(lead.etapa)}`}>
                    {lead.etapa}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <span>{lead.contacto_principal || 'Sin asignar'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {lead.email_contacto && (
                        <a href={`mailto:${lead.email_contacto}`} className="text-slate-400 hover:text-indigo-500 transition-colors">
                          <Mail size={12} />
                        </a>
                      )}
                      {lead.telefono && (
                        <a href={`tel:${lead.telefono}`} className="text-slate-400 hover:text-indigo-500 transition-colors">
                          <Phone size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right tabular-nums">
                  <span className="text-xs font-bold text-slate-900">{formatCurrency(lead.valor_estimado)}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Calendar size={12} />
                    {new Date(lead.created_at).toLocaleDateString('es-AR')}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(lead)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Editar Lead"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(lead.id)}
                      disabled={isDeleting === lead.id}
                      className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                      title="Eliminar Registro"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <DollarSign size={40} className="text-slate-200" />
                    <p className="text-slate-400 font-medium italic">No hay prospectos en el pipeline actualmente.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
