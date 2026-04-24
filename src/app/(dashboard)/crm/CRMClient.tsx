"use client"
// CRM Client Logic

import React, { useState, useMemo } from 'react'
import { Plus, Search, Filter, Download, ArrowUpRight } from 'lucide-react'
import PipelineTable from '@/components/crm/PipelineTable'
import LeadForm from '@/components/crm/LeadForm'

interface CRMClientProps {
  initialLeads: any[]
}

export default function CRMClient({ initialLeads }: CRMClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLeads = useMemo(() => {
    return initialLeads.filter(l => 
      l.razon_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tax_id.includes(searchQuery) ||
      (l.contacto_principal || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [initialLeads, searchQuery])

  const handleEdit = (lead: any) => {
    setEditingLead(lead)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingLead(null)
  }

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <input
            type="text"
            placeholder="Buscar por Razón Social, CUIT o Contacto..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all font-bold text-slate-800 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex gap-3">
          <button className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <Filter size={16} />
            Filtros
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Plus size={18} />
            Nuevo Prospecto
          </button>
        </div>
      </div>

      {/* Form Overlay / Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <LeadForm 
              initialData={editingLead} 
              onSuccess={handleClose} 
              onCancel={handleClose} 
            />
          </div>
        </div>
      )}

      {/* Pipeline View */}
      <div className="grid grid-cols-1 gap-6">
        <PipelineTable leads={filteredLeads} onEdit={handleEdit} />
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl">
          <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Valor Total Pipeline</p>
          <p className="text-3xl font-bold tabular-nums">
            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(
              filteredLeads.reduce((acc, curr) => acc + (curr.valor_estimado || 0), 0)
            )}
          </p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Prospectos Activos</p>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {filteredLeads.filter(l => l.etapa !== 'Cerrado').length}
          </p>
        </div>
        <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100 shadow-sm">
          <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Cierres del Mes</p>
          <p className="text-3xl font-bold tabular-nums text-emerald-900">
            {filteredLeads.filter(l => l.etapa === 'Cerrado').length}
          </p>
        </div>
      </div>
    </div>
  )
}
