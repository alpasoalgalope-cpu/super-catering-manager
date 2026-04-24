"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  Plus, 
  Trash2, 
  Save, 
  Settings2, 
  Building2, 
  DollarSign, 
  Percent, 
  Droplets,
  AlertCircle,
  Loader2,
  ChefHat
} from "lucide-react"

// --- Helper for consistent key matching ---
function normalizeKey(str: string) {
  return str?.trim().toLowerCase().replace(/\s+/g, ' ') || ""
}

export default function ReglasPreciosPage() {
  const [rules, setRules] = useState<any[]>([])
  const [recetas, setRecetas] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    const [
      { data: rulesData, error: rErr },
      { data: recetasData, error: recErr },
      { data: clientsData, error: cErr }
    ] = await Promise.all([
      supabase.from("commercial_rules").select("*").order("company_name", { ascending: true }),
      supabase.from("recetas").select("id, nombre").order("nombre"),
      supabase.from("clients").select("id, name").order("name")
    ])
    
    if (rErr || recErr || cErr) {
      setMessage({ type: 'error', text: "Error al cargar datos: " + (rErr?.message || recErr?.message || cErr?.message) })
    } else {
      const clientsDataSafe = clientsData || []
      const rulesDataSafe = rulesData || []
      
      // AUTO-LINK: Match existing rules by name if client_id is missing
      const linkedRules = rulesDataSafe.map(r => {
        if (!r.client_id && r.company_name) {
          const client = clientsDataSafe.find(c => normalizeKey(c.name) === normalizeKey(r.company_name))
          if (client) return { ...r, client_id: client.id }
        }
        return r
      })

      setRules(linkedRules)
      setRecetas(recetasData || [])
      setClients(clientsDataSafe)
    }
    setLoading(false)
  }

  const addRule = () => {
    const newRule = {
      id: crypto.randomUUID(),
      company_name: "Nueva Empresa",
      price_base: 8500,
      price_sintacc_base: 8500,
      price_sintacc_threshold: 10000,
      sintacc_limit_pct: 5,
      includes_water: true,
      isNew: true
    }
    setRules([newRule, ...rules])
  }

  const updateLocalRule = (id: string, field: string, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const saveRule = async (rule: any) => {
    setSaving(true)
    setMessage(null)
    try {
      const { isNew, id, ...ruleData } = rule
      let error
      
      if (isNew) {
        const { error: insErr } = await supabase.from("commercial_rules").insert([ruleData])
        error = insErr
      } else {
        const { error: updErr } = await supabase.from("commercial_rules").update(ruleData).eq("id", id)
        error = updErr
      }

      if (error) throw error
      setMessage({ type: 'success', text: `Regla de ${rule.company_name} guardada.` })
      fetchRules()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const deleteRule = async (id: string, isNew?: boolean) => {
    if (isNew) {
      setRules(rules.filter(r => r.id !== id))
      return
    }

    if (!confirm("¿Estás seguro de eliminar esta regla comercial?")) return

    const { error } = await supabase.from("commercial_rules").delete().eq("id", id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      fetchRules()
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-10">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Settings2 size={32} strokeWidth={2.5} />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Configuración Avanzada</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tighter">Reglas de Precios</h1>
          <p className="text-slate-500 mt-2 font-medium">Define los umbrales de Sin TACC y precios base por empresa.</p>
        </div>
        
        <button 
          onClick={addRule}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-indigo-100 transform active:scale-95"
        >
          <Plus size={20} /> Nueva Regla
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          <AlertCircle size={18} />
          {message.text}
        </div>
      )}

      {/* RULES LIST */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
             <Loader2 className="animate-spin" size={40} />
             <p className="font-bold">Cargando reglas comerciales...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
             <p className="text-slate-400 font-bold uppercase tracking-widest">No hay reglas definidas</p>
          </div>
        ) : rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group flex flex-col gap-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Cliente */}
              <div className="lg:col-span-4 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Building2 size={10} /> Empresa Cliente</label>
                
                <select 
                  className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
                  value={rule.client_id || ""}
                  onChange={e => {
                    const val = e.target.value
                    const client = clients.find(c => c.id === val)
                    
                    setRules(prev => prev.map(r => 
                      r.id === rule.id 
                        ? { ...r, client_id: client?.id || "", company_name: client?.name || "" }
                        : r
                    ))
                  }}
                >
                  <option value="">-- Seleccionar Empresa --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-3 mt-2">
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] font-bold uppercase">
                      <Droplets size={10} className={rule.includes_water ? 'text-blue-500' : 'text-slate-300'} />
                      Incluye Agua
                      <input 
                        type="checkbox"
                        className="ml-1 w-4 h-4 accent-blue-600"
                        checked={rule.includes_water}
                        onChange={e => updateLocalRule(rule.id, 'includes_water', e.target.checked)}
                      />
                   </div>
                </div>
              </div>

              {/* Precios (Compactos) */}
              <div className="lg:col-span-6 grid grid-cols-3 gap-6 lg:border-l lg:pl-8 border-slate-100">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Precio Base</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-300 font-bold text-sm">$</span>
                    <input type="number" className="w-full text-lg font-bold text-slate-900 bg-transparent outline-none" value={rule.price_base} onChange={e => updateLocalRule(rule.id, 'price_base', Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">Base Sin TACC</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-300 font-bold text-sm">$</span>
                    <input type="number" className="w-full text-lg font-bold text-indigo-600 bg-transparent outline-none" value={rule.price_sintacc_base ?? rule.price_base} onChange={e => updateLocalRule(rule.id, 'price_sintacc_base', Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-rose-400 uppercase tracking-tighter">Exc. Sin TACC</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-300 font-bold text-sm">$</span>
                    <input type="number" className="w-full text-lg font-bold text-rose-600 bg-transparent outline-none" value={rule.price_sintacc_threshold} onChange={e => updateLocalRule(rule.id, 'price_sintacc_threshold', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="lg:col-span-2 flex justify-end gap-3 lg:border-l lg:pl-8 border-slate-100">
                <button 
                  onClick={() => deleteRule(rule.id, rule.isNew)}
                  className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition"
                >
                  <Trash2 size={24} />
                </button>
                <button 
                  onClick={() => saveRule(rule)}
                  disabled={saving}
                  className="p-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl transition shadow-lg shadow-emerald-100"
                >
                  {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                </button>
              </div>
            </div>

            {/* VINCULACIÓN TÉCNICA (Escandallos) */}
            <div className="pt-8 border-t border-slate-50">
               <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ChefHat size={14} />
                  </div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mapeo Técnico de Recetas (Para Escandallo y Logística)</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { id: 'recipe_trad_id', label: 'TRADICIONAL', color: 'slate' },
                    { id: 'recipe_veg_id', label: 'VEGETARIANA', color: 'emerald' },
                    { id: 'recipe_vegan_id', label: 'VEGANA', color: 'teal' },
                    { id: 'recipe_sintacc_id', label: 'SIN TACC', color: 'indigo' }
                  ].map((cat) => (
                    <div key={cat.id} className="space-y-2">
                       <label className={`text-[9px] font-bold text-${cat.color}-500 uppercase tracking-wider ml-1`}>{cat.label}</label>
                       <select 
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-400 transition"
                        value={rule[cat.id] || ""}
                        onChange={e => updateLocalRule(rule.id, cat.id, e.target.value)}
                       >
                          <option value="">-- No vinculada --</option>
                          {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                       </select>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
