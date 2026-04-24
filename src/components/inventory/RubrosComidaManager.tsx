"use client"

import React, { useState } from "react"
import { Plus, Trash2, LayoutGrid, Loader2 } from "lucide-react"
import { RubroComida } from "@/types/inventory"
import { createRubroAction, deleteRubroAction } from "@/app/actions/inventory"

interface Props {
  initialRubros: RubroComida[]
}

export default function RubrosComidaManager({ initialRubros }: Props) {
  const [rubros, setRubros] = useState(initialRubros)
  const [newRubroName, setNewRubroName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!newRubroName.trim()) return
    setLoading(true)
    const res = await createRubroAction(newRubroName.trim())
    if (res.success && res.data) {
      setRubros(prev => [...prev, res.data as RubroComida].sort((a,b) => a.nombre.localeCompare(b.nombre)))
      setNewRubroName("")
    } else {
      alert("Error al guardar: " + res.error)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Seguro que desea eliminar el rubro "${name}"?`)) return
    const res = await deleteRubroAction(id)
    if (res.success) {
      setRubros(prev => prev.filter(r => r.id !== id))
    } else {
      alert("Error al eliminar: " + res.error)
    }
  }

  return (
    <div className="max-w-3xl bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mx-auto md:mx-0">
      <div className="p-8 border-b border-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">Gestión de Rubros</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Agregue categorías como "Sándwiches", "Ensaladas", etc.</p>
        </div>
        <LayoutGrid className="text-indigo-100" size={32} />
      </div>

      <div className="p-10 space-y-8">
        <div className="flex gap-4">
          <input 
            type="text"
            className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase text-xs outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-inner"
            placeholder="Nombre de la nueva categoría..."
            value={newRubroName}
            onChange={e => setNewRubroName(e.target.value)}
            disabled={loading}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd}
            disabled={loading}
            className="px-10 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 transition shadow-xl shadow-indigo-100 active:scale-95 disabled:bg-slate-300"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : "Agregar"}
          </button>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
          {rubros.map(r => (
            <div key={r.id} className="flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors border border-transparent hover:border-slate-200 group">
              <span className="font-black text-slate-700 uppercase italic tracking-tight">{r.nombre}</span>
              <button 
                onClick={() => handleDelete(r.id, r.nombre)}
                className="p-3 text-slate-300 hover:text-rose-500 hover:bg-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {rubros.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase italic text-xs">No hay rubros cargados aún</div>
          )}
        </div>
      </div>

    </div>
  )
}

