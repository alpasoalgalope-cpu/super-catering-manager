"use client"

import React, { useState, useMemo } from "react"
import { 
  FolderOpen, Plus, Pencil, Trash2, Search, ArrowLeftRight, 
  HelpCircle, AlertCircle, CheckCircle2, ChevronRight, Layers, Tag
} from "lucide-react"
import Link from "next/link"
import { 
  CashConcept, CashSubconcept,
  createConceptAction, updateConceptAction, deleteConceptAction,
  createSubconceptAction, updateSubconceptAction, deleteSubconceptAction,
  checkCategoryInUseAction, getCategoriesAction
} from "@/app/actions/categorias"

interface CategoryDashboardProps {
  concepts: CashConcept[]
  subconcepts: CashSubconcept[]
}

const COLORS = [
  "border-t-indigo-500", 
  "border-t-violet-500", 
  "border-t-fuchsia-500", 
  "border-t-rose-500", 
  "border-t-emerald-500", 
  "border-t-cyan-500", 
  "border-t-amber-500",
  "border-t-pink-500"
]

export default function CategoryDashboard({ 
  concepts: initialConcepts, 
  subconcepts: initialSubconcepts 
}: CategoryDashboardProps) {
  const [concepts, setConcepts] = useState<CashConcept[]>(initialConcepts)
  const [subconcepts, setSubconcepts] = useState<CashSubconcept[]>(initialSubconcepts)
  
  const [selectedTab, setSelectedTab] = useState<'Egreso' | 'Ingreso'>('Egreso')
  const [searchTerm, setSearchTerm] = useState("")
  
  // Notification states
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  
  // Modal states
  const [conceptModal, setConceptModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    id?: string
    name: string
    tipo: 'Ingreso' | 'Egreso'
  }>({ open: false, mode: 'create', name: '', tipo: 'Egreso' })

  const [subconceptModal, setSubconceptModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    id?: string
    conceptId?: string
    name: string
  }>({ open: false, mode: 'create', name: '' })

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    type: 'concept' | 'subconcept'
    id: string
    name: string
    inUse: boolean
    count: number
    checking: boolean
  }>({ open: false, type: 'concept', id: '', name: '', inUse: false, count: 0, checking: false })

  // Show auto-dismissing notifications
  const triggerNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification(null)
    }, 4000)
  }

  // Refresh data from DB
  const refreshData = async () => {
    const res = await getCategoriesAction()
    if (res.success && res.concepts && res.subconcepts) {
      setConcepts(res.concepts)
      setSubconcepts(res.subconcepts)
    }
  }

  // Filtered concepts by tab & search
  const filteredConcepts = useMemo(() => {
    return concepts.filter(c => {
      if (c.tipo !== selectedTab) return false
      if (!searchTerm) return true
      
      const matchConcept = c.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchSubconcepts = subconcepts.some(s => 
        s.concept_id === c.id && s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      return matchConcept || matchSubconcepts
    })
  }, [concepts, subconcepts, selectedTab, searchTerm])

  // Subconcepts grouped by concept
  const subconceptsByConcept = useMemo(() => {
    const map: Record<string, CashSubconcept[]> = {}
    subconcepts.forEach(s => {
      if (!map[s.concept_id]) map[s.concept_id] = []
      map[s.concept_id].push(s)
    })
    return map
  }, [subconcepts])

  // --- HANDLERS FOR RUBROS (CONCEPTS) ---
  const handleOpenCreateConcept = () => {
    setConceptModal({
      open: true,
      mode: 'create',
      name: '',
      tipo: selectedTab
    })
  }

  const handleOpenEditConcept = (concept: CashConcept) => {
    setConceptModal({
      open: true,
      mode: 'edit',
      id: concept.id,
      name: concept.name,
      tipo: concept.tipo
    })
  }

  const handleSaveConcept = async () => {
    if (!conceptModal.name.trim()) return
    
    if (conceptModal.mode === 'create') {
      const res = await createConceptAction(conceptModal.name, conceptModal.tipo)
      if (res.success) {
        triggerNotification('success', `Rubro "${conceptModal.name}" creado con éxito.`)
        setConceptModal(prev => ({ ...prev, open: false }))
        refreshData()
      } else {
        triggerNotification('error', `Error al crear rubro: ${res.error}`)
      }
    } else if (conceptModal.mode === 'edit' && conceptModal.id) {
      const res = await updateConceptAction(conceptModal.id, conceptModal.name)
      if (res.success) {
        triggerNotification('success', `Rubro actualizado a "${conceptModal.name}".`)
        setConceptModal(prev => ({ ...prev, open: false }))
        refreshData()
      } else {
        triggerNotification('error', `Error al actualizar rubro: ${res.error}`)
      }
    }
  }

  // --- HANDLERS FOR SUBCATEGORIAS (SUBCONCEPTS) ---
  const handleOpenCreateSubconcept = (conceptId: string) => {
    setSubconceptModal({
      open: true,
      mode: 'create',
      conceptId,
      name: ''
    })
  }

  const handleOpenEditSubconcept = (sub: CashSubconcept) => {
    setSubconceptModal({
      open: true,
      mode: 'edit',
      id: sub.id,
      conceptId: sub.concept_id,
      name: sub.name
    })
  }

  const handleSaveSubconcept = async () => {
    if (!subconceptModal.name.trim()) return

    if (subconceptModal.mode === 'create' && subconceptModal.conceptId) {
      const res = await createSubconceptAction(subconceptModal.conceptId, subconceptModal.name)
      if (res.success) {
        triggerNotification('success', `Subcategoría "${subconceptModal.name}" agregada con éxito.`)
        setSubconceptModal(prev => ({ ...prev, open: false }))
        refreshData()
      } else {
        triggerNotification('error', `Error al agregar subcategoría: ${res.error}`)
      }
    } else if (subconceptModal.mode === 'edit' && subconceptModal.id) {
      const res = await updateSubconceptAction(subconceptModal.id, subconceptModal.name)
      if (res.success) {
        triggerNotification('success', `Subcategoría actualizada a "${subconceptModal.name}".`)
        setSubconceptModal(prev => ({ ...prev, open: false }))
        refreshData()
      } else {
        triggerNotification('error', `Error al actualizar subcategoría: ${res.error}`)
      }
    }
  }

  // --- HANDLERS FOR DELETION WITH IN-USE CHECKS ---
  const handleOpenDelete = async (type: 'concept' | 'subconcept', id: string, name: string) => {
    setDeleteModal({
      open: true,
      type,
      id,
      name,
      inUse: false,
      count: 0,
      checking: true
    })

    const res = await checkCategoryInUseAction(id, type)
    if (res.success) {
      setDeleteModal(prev => ({
        ...prev,
        inUse: res.inUse || false,
        count: res.count || 0,
        checking: false
      }))
    } else {
      setDeleteModal(prev => ({ ...prev, checking: false }))
      triggerNotification('error', `Error al verificar uso de categoría: ${res.error}`)
    }
  }

  const handleConfirmDelete = async () => {
    if (deleteModal.type === 'concept') {
      const res = await deleteConceptAction(deleteModal.id)
      if (res.success) {
        triggerNotification('success', `Rubro "${deleteModal.name}" eliminado correctamente.`)
        setDeleteModal(prev => ({ ...prev, open: false }))
        refreshData()
      } else {
        triggerNotification('error', `Error al eliminar rubro: ${res.error}`)
      }
    } else {
      const res = await deleteSubconceptAction(deleteModal.id)
      if (res.success) {
        triggerNotification('success', `Subcategoría "${deleteModal.name}" eliminada correctamente.`)
        setDeleteModal(prev => ({ ...prev, open: false }))
        refreshData()
      } else {
        triggerNotification('error', `Error al eliminar subcategoría: ${res.error}`)
      }
    }
  }

  return (
    <div className="space-y-8 pb-32">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
            : 'bg-rose-50 text-rose-800 border-rose-100'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-rose-500" size={20} />}
          <span className="text-sm font-semibold uppercase tracking-wide text-xs">{notification.message}</span>
        </div>
      )}

      {/* Selector de Pestañas e Iniciar Creación */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        
        {/* Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 w-full md:w-auto">
          <button
            onClick={() => { setSelectedTab('Egreso'); setSelectedTab('Egreso') }}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              selectedTab === 'Egreso'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            Rubros de Gastos (Egresos)
          </button>
          <button
            onClick={() => setSelectedTab('Ingreso')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              selectedTab === 'Ingreso'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowLeftRight size={14} />
            Rubros de Ingresos
          </button>
        </div>

        {/* Búsqueda y Crear */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Buscar rubro o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 outline-none text-slate-800 text-xs pl-10 pr-4 py-2.5 rounded-2xl focus:border-indigo-300 focus:bg-white transition"
            />
          </div>

          {/* Crear Rubro Button */}
          <button
            onClick={handleOpenCreateConcept}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm"
          >
            <Plus size={16} />
            Nuevo Rubro
          </button>
        </div>
      </div>

      {/* Grid de Rubros */}
      {filteredConcepts.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <FolderOpen size={28} />
          </div>
          <h3 className="text-md font-bold text-slate-700 uppercase tracking-wider">No se encontraron categorías</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm 
              ? "No hay resultados que coincidan con tu búsqueda. Intentá con otro término." 
              : `Aún no hay rubros de ${selectedTab === 'Egreso' ? 'gastos' : 'ingresos'} registrados. ¡Creá el primero!`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConcepts.map((concept, index) => {
            const subs = subconceptsByConcept[concept.id] || []
            const colorClass = COLORS[index % COLORS.length]

            return (
              <div 
                key={concept.id} 
                className={`bg-white rounded-[2.5rem] border border-slate-200 border-t-4 ${colorClass} p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group h-full relative overflow-hidden`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 border border-indigo-100/30 px-2 py-0.5 rounded-full">
                        {concept.tipo === 'Egreso' ? 'Gasto' : 'Ingreso'}
                      </span>
                      <h4 className="text-md font-bold uppercase tracking-tight text-slate-800 flex items-center gap-2">
                        {concept.name}
                      </h4>
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-300">
                      <button 
                        onClick={() => handleOpenEditConcept(concept)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                        title="Editar nombre del rubro"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={() => handleOpenDelete('concept', concept.id, concept.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition"
                        title="Eliminar rubro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* List of Subconcepts */}
                  <div className="mt-6 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                      Conceptos de Caja ({subs.length})
                    </p>
                    
                    {subs.length === 0 ? (
                      <p className="text-[11px] italic text-slate-400 py-3">No hay conceptos de caja en este rubro.</p>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1 py-1">
                        {subs.map(sub => (
                          <div 
                            key={sub.id} 
                            className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl transition group/sub"
                          >
                            <span className="text-xs font-semibold text-slate-600 pl-1">{sub.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition duration-200">
                              <button 
                                onClick={() => handleOpenEditSubconcept(sub)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                                title="Editar"
                              >
                                <Pencil size={12} />
                              </button>
                              <button 
                                onClick={() => handleOpenDelete('subconcept', sub.id, sub.name)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Add Subconcept */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenCreateSubconcept(concept.id)}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-200 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition"
                  >
                    <Plus size={14} />
                    Agregar Concepto de Caja
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* --- MODAL DE CREACION/EDICION RUBRO (CONCEPT) --- */}
      {conceptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 max-w-md w-full p-8 shadow-2xl space-y-6 animate-in scale-in duration-300">
            <div>
              <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit flex items-center justify-center">
                <Tag size={20} />
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 mt-4">
                {conceptModal.mode === 'create' ? 'Crear Nuevo Rubro' : 'Editar Nombre del Rubro'}
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                {conceptModal.mode === 'create' 
                  ? `Registrar nueva categoría de ${conceptModal.tipo === 'Egreso' ? 'gasto' : 'ingreso'}` 
                  : 'Modifica el nombre del rubro principal'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre del Rubro</label>
                <input
                  type="text"
                  placeholder="Ej: Gastos de Oficina, Logística..."
                  value={conceptModal.name}
                  onChange={(e) => setConceptModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 outline-none text-slate-800 text-xs px-4 py-3 rounded-2xl focus:border-indigo-300 focus:bg-white transition"
                  autoFocus
                />
              </div>

              {conceptModal.mode === 'create' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Rubro</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConceptModal(prev => ({ ...prev, tipo: 'Egreso' }))}
                      className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition ${
                        conceptModal.tipo === 'Egreso' 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Egreso (Gasto)
                    </button>
                    <button
                      onClick={() => setConceptModal(prev => ({ ...prev, tipo: 'Ingreso' }))}
                      className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition ${
                        conceptModal.tipo === 'Ingreso' 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Ingreso
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setConceptModal(prev => ({ ...prev, open: false }))}
                className="flex-1 bg-slate-50 text-slate-500 hover:bg-slate-100 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition border border-slate-200/50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConcept}
                disabled={!conceptModal.name.trim()}
                className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE CREACION/EDICION SUBRUBRO (SUBCONCEPT) --- */}
      {subconceptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 max-w-md w-full p-8 shadow-2xl space-y-6 animate-in scale-in duration-300">
            <div>
              <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit flex items-center justify-center">
                <Layers size={20} />
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 mt-4">
                {subconceptModal.mode === 'create' ? 'Agregar Concepto de Caja' : 'Editar Concepto de Caja'}
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                {subconceptModal.mode === 'create' 
                  ? 'Registrar una subcategoría de imputación' 
                  : 'Modifica el nombre del concepto de caja'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre del Concepto de Caja</label>
                <input
                  type="text"
                  placeholder="Ej: Bienes Personales, Gastos Personales, ABL..."
                  value={subconceptModal.name}
                  onChange={(e) => setSubconceptModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 outline-none text-slate-800 text-xs px-4 py-3 rounded-2xl focus:border-indigo-300 focus:bg-white transition"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setSubconceptModal(prev => ({ ...prev, open: false }))}
                className="flex-1 bg-slate-50 text-slate-500 hover:bg-slate-100 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition border border-slate-200/50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSubconcept}
                disabled={!subconceptModal.name.trim()}
                className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE ELIMINACION CON VALIDACION --- */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 max-w-md w-full p-8 shadow-2xl space-y-6 animate-in scale-in duration-300">
            
            {deleteModal.checking ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Verificando uso en base de datos...</p>
              </div>
            ) : (
              <>
                <div>
                  <span className={`p-3 rounded-2xl w-fit flex items-center justify-center ${
                    deleteModal.inUse ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <AlertCircle size={20} />
                  </span>
                  
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 mt-4">
                    Eliminar {deleteModal.type === 'concept' ? 'Rubro' : 'Concepto de Caja'}
                  </h3>
                  
                  <p className="text-sm font-bold text-slate-700 mt-2">
                    ¿Estás seguro de que querés eliminar <span className="text-indigo-600">"{deleteModal.name}"</span>?
                  </p>
                </div>

                {deleteModal.inUse && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-2 flex items-start gap-3">
                    <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <p className="text-[11px] font-black uppercase tracking-wider text-amber-800 leading-none">Categoría en uso</p>
                      <p className="text-[11px] text-amber-700 leading-normal">
                        Esta categoría tiene **{deleteModal.count}** movimientos de caja asociados. Si la eliminás, los movimientos seguirán existiendo pero se desvincularán de este rubro (quedarán sin clasificar).
                      </p>
                    </div>
                  </div>
                )}

                {!deleteModal.inUse && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Esta categoría no tiene movimientos de caja asociados. Podés eliminarla con seguridad.
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}
                    className="flex-1 bg-slate-50 text-slate-500 hover:bg-slate-100 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition border border-slate-200/50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className={`flex-1 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm ${
                      deleteModal.inUse 
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10' 
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                    }`}
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
