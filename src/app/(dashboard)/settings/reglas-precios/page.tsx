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
  Loader2
} from "lucide-react"

export default function ReglasPreciosPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("commercial_rules")
      .select("*")
      .order("company_name", { ascending: true })
    
    if (error) {
      setMessage({ type: 'error', text: "Error al cargar reglas: " + error.message })
    } else {
      setRules(data || [])
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
            <span className="text-xs font-black uppercase tracking-[0.2em]">Configuración Avanzada</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Reglas de Precios</h1>
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
          <div key={rule.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Cliente */}
              <div className="lg:col-span-3 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Building2 size={10} /> Empresa Cliente</label>
                <input 
                  className="w-full text-xl font-black text-slate-800 bg-transparent outline-none focus:text-indigo-600 transition"
                  value={rule.company_name}
                  onChange={e => updateLocalRule(rule.id, 'company_name', e.target.value)}
                />
              </div>

              {/* Precio Base */}
              <div className="lg:col-span-2 space-y-2 lg:border-l lg:pl-8 border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><DollarSign size={10} /> Precio Base</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-black text-lg">$</span>
                  <input 
                    type="number"
                    className="w-full text-xl font-black text-slate-800 bg-transparent outline-none"
                    value={rule.price_base}
                    onChange={e => {
                      const val = Number(e.target.value)
                      updateLocalRule(rule.id, 'price_base', val)
                      // Auto-update ST base if it matches
                      if (!rule.price_sintacc_base || rule.price_sintacc_base === rule.price_base) {
                        updateLocalRule(rule.id, 'price_sintacc_base', val)
                      }
                    }}
                  />
                </div>
              </div>

              {/* Precio Base ST */}
              <div className="lg:col-span-2 space-y-2 lg:border-l lg:pl-8 border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><DollarSign size={10} /> Base Sin TACC</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-black text-lg">$</span>
                  <input 
                    type="number"
                    className="w-full text-xl font-black text-indigo-600 bg-transparent outline-none"
                    value={rule.price_sintacc_base ?? rule.price_base}
                    onChange={e => {
                      const val = Number(e.target.value)
                      updateLocalRule(rule.id, 'price_sintacc_base', val)
                    }}
                  />
                </div>
              </div>

              {/* Precio Excedente ST */}
              <div className="lg:col-span-2 space-y-2 lg:border-l lg:pl-8 border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><DollarSign size={10} /> Exc. Sin TACC</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-black text-lg">$</span>
                  <input 
                    type="number"
                    className="w-full text-xl font-black text-rose-600 bg-transparent outline-none"
                    value={rule.price_sintacc_threshold}
                    onChange={e => updateLocalRule(rule.id, 'price_sintacc_threshold', Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Cupo ST % */}
              <div className="lg:col-span-1 space-y-2 lg:border-l lg:pl-8 border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Percent size={10} /> Cupo</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    className="w-10 text-xl font-black text-slate-400 bg-transparent outline-none"
                    value={rule.sintacc_limit_pct}
                    onChange={e => updateLocalRule(rule.id, 'sintacc_limit_pct', Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Agua */}
              <div className="lg:col-span-1 space-y-2 lg:border-l lg:pl-8 border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Droplets size={10} /> Agua</label>
                <div className="flex items-center h-8">
                  <input 
                    type="checkbox"
                    className="w-6 h-6 rounded-lg text-indigo-600 accent-indigo-600"
                    checked={rule.includes_water}
                    onChange={e => updateLocalRule(rule.id, 'includes_water', e.target.checked)}
                  />
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
                  className="p-3 bg-slate-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition shadow-sm"
                >
                  {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
