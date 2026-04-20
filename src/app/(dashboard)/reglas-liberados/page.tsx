"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Plus, Save, Trash2, Edit2, X, Loader2 } from "lucide-react"

export default function FreeMealRulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Edit / Create State
  const [formState, setFormState] = useState({
     sale_mode: "PAQUETE O CERRADA",
     min_conversion: 0,
     role: "Chofer",
     vehicle_type: "Minibus",
     quantity: 1
  })

  const fetchRules = async () => {
    setLoading(true)
    const { data: r, error } = await supabase.from("free_meal_rules").select("*").order("sale_mode", { ascending: true })
    if (!error && r) {
       setRules(r)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const startEdit = (rule: any) => {
     setEditingId(rule.id)
     setFormState({
        sale_mode: rule.sale_mode,
        min_conversion: rule.min_conversion || 0,
        role: rule.role,
        vehicle_type: rule.vehicle_type,
        quantity: rule.quantity
     })
     setIsCreating(false)
  }

  const startCreate = () => {
     setIsCreating(true)
     setEditingId(null)
     setFormState({
        sale_mode: "PAQUETE O CERRADA",
        min_conversion: 0,
        role: "Chofer",
        vehicle_type: "Minibus",
        quantity: 1
     })
  }

  const cancelEdit = () => {
     setEditingId(null)
     setIsCreating(false)
  }

  const handleSave = async () => {
     setSaving(true)
     
     if (editingId) {
        // UPDATE
        await supabase.from("free_meal_rules").update(formState).eq("id", editingId)
     } else {
        // INSERT
        await supabase.from("free_meal_rules").insert([formState])
     }
     
     cancelEdit()
     await fetchRules()
     setSaving(false)
  }

  const handleDelete = async (id: string) => {
     if (!confirm("¿Eliminar definitivamente esta regla comercial?")) return
     await supabase.from("free_meal_rules").delete().eq("id", id)
     fetchRules()
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Reglas de Liberados
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Lógicas probabilísticas y reglas fijas de viandas gratis por empresa y tipo de vehículo. Configura los umbrales operativos que la App consumirá.
          </p>
        </div>
        <button 
           onClick={startCreate}
           className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-sm transition">
           <Plus size={18}/> Nueva Regla
        </button>
      </div>

      {(isCreating || editingId) && (
         <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[1.5rem] p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-black text-indigo-900">{isCreating ? 'Agregar Nueva Regla' : 'Editar Regla Exitente'}</h3>
               <button onClick={cancelEdit} className="text-indigo-400 hover:text-indigo-600"><X size={20}/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
               <div>
                  <label className="block text-[10px] font-black text-indigo-900/60 uppercase mb-1">Modo Venta</label>
                  <select 
                     value={formState.sale_mode} onChange={e=>setFormState({...formState, sale_mode: e.target.value})}
                     className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold outline-none focus:ring-2 focus:ring-indigo-200">
                     <option value="PAQUETE O CERRADA">Paquete / Cerrada</option>
                     <option value="REGULAR">Venta Libre (Regular)</option>
                     <option value="TOUR DE COMPRAS">Tour de Compras</option>
                     <option value="TRASLADOS ESPECIALES">Traslados Especiales</option>
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-indigo-900/60 uppercase mb-1">Venta Mín % (0=Auto)</label>
                  <input type="number" min={0} max={100} value={formState.min_conversion} onChange={e=>setFormState({...formState, min_conversion: Number(e.target.value)})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold outline-none"/>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-indigo-900/60 uppercase mb-1">Rol Favorecido</label>
                  <input type="text" value={formState.role} onChange={e=>setFormState({...formState, role: e.target.value})} className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold outline-none"/>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-indigo-900/60 uppercase mb-1">Tipo de Vehículo</label>
                  <select 
                     value={formState.vehicle_type} onChange={e=>setFormState({...formState, vehicle_type: e.target.value})}
                     className="w-full rounded-xl border-slate-200 bg-white p-3 font-semibold outline-none focus:ring-2 focus:ring-indigo-200">
                     <option value="Combi 19 pax">Combi 19 pax</option>
                     <option value="Minibus">Minibus</option>
                     <option value="Semi Cama">Micro Semi Cama</option>
                     <option value="Cama Ejecutiva">Micro Cama Ejecutiva</option>
                     <option value="Doble Piso">Micro Doble Piso</option>
                     <option value="Cualquiera">Cualquiera</option>
                  </select>
               </div>
               <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="block text-[10px] font-black text-indigo-900/60 uppercase mb-1">Cant.</label>
                     <input type="number" min={1} value={formState.quantity} onChange={e=>setFormState({...formState, quantity: Number(e.target.value)})} className="w-full text-center rounded-xl border-slate-200 bg-white p-3 font-bold text-amber-600 outline-none"/>
                  </div>
                  <button onClick={handleSave} disabled={saving} className="w-12 h-12 bg-indigo-600 mt-5 rounded-xl flex items-center justify-center text-white disabled:opacity-50 hover:bg-indigo-700 transition">
                     {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                  </button>
               </div>
            </div>
         </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={40}/></div>
      ) : (
        <div className="overflow-x-auto rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] leading-tight font-black tracking-widest border-b border-slate-200">
                <th className="text-left p-6">Modo de Venta</th>
                <th className="text-left p-6">Condición Operativa</th>
                <th className="text-left p-6">Rol</th>
                <th className="text-left p-6">Vehículo Evaluado</th>
                <th className="text-center p-6">Premio (Cant)</th>
                <th className="text-center p-6">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm font-semibold divide-y divide-slate-100">
              {rules?.map((rule) => {
                const isAuto = !rule.min_conversion || rule.min_conversion === 0;

                return (
                  <tr key={rule.id} className={`transition ${editingId === rule.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="p-6 text-slate-900 font-bold">{rule.sale_mode || "-"}</td>
                    
                    <td className="p-6">
                      {isAuto ? (
                        <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-600 border border-emerald-100">
                          AUTO LIBERADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-slate-600 bg-slate-100 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-black">
                          SÓLO SI VENDE &gt; {rule.min_conversion}%
                        </span>
                      )}
                    </td>

                    <td className="p-6 text-slate-600">{rule.role || "General"}</td>
                    <td className="p-6 text-slate-500 italic">{rule.vehicle_type || "Cualquiera"}</td>
                    <td className="p-6 text-center">
                      <span className="inline-block bg-amber-100 text-amber-700 w-10 h-10 rounded-full leading-[40px] font-black text-lg">
                        {rule.quantity}
                      </span>
                    </td>
                    <td className="p-6">
                       <div className="flex justify-center gap-3">
                          <button onClick={() => startEdit(rule)} className="text-slate-400 hover:text-indigo-600 transition"><Edit2 size={18}/></button>
                          <button onClick={() => handleDelete(rule.id)} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={18}/></button>
                       </div>
                    </td>
                  </tr>
                )
              })}

              {!rules?.length && (
                <tr>
                  <td colSpan={6} className="p-10 text-center font-medium text-slate-400">
                    No hay reglas de liberados configuradas en la plataforma.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
