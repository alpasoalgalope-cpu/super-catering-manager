"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { syncClientPricesToFutureStoresAction } from "@/app/actions/online-sales"
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
  ChefHat,
  Gift,
  Hash,
  UserCheck,
  Users,
  TrendingUp,
  Award,
  Sparkles,
  Check,
  ToggleLeft,
  ToggleRight
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
      supabase.from("clients").select("id, name, sale_type").order("name")
    ])
    
    if (rErr || recErr || cErr) {
      setMessage({ type: 'error', text: "Error al cargar datos: " + (rErr?.message || recErr?.message || cErr?.message) })
    } else {
      const clientsDataSafe = clientsData || []
      const rulesDataSafe = rulesData || []
      
      // AUTO-LINK: Match existing rules by name if client_id is missing & read stored local tier configs
      const linkedRules = rulesDataSafe.map(r => {
        let matchedClientId = r.client_id
        if (!matchedClientId && r.company_name) {
          const client = clientsDataSafe.find(c => normalizeKey(c.name) === normalizeKey(r.company_name))
          if (client) matchedClientId = client.id
        }

        // Load custom tier config from localStorage if available
        let customConfig: any = {}
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(`commercial_tier_config_${r.id}`) || 
                        localStorage.getItem(`commercial_tier_config_${normalizeKey(r.company_name)}`)
            if (raw) customConfig = JSON.parse(raw)
          } catch (e) {
            console.error(e)
          }
        }

        const matchedClient = clientsDataSafe.find(c => c.id === matchedClientId) as any
        const isMayoristaDefault = Boolean(
          r.company_name?.toLowerCase().includes('rock') || 
          r.company_name?.toLowerCase().includes('terco') || 
          matchedClient?.sale_type?.toLowerCase() === 'mayorista'
        )

        return { 
          ...r, 
          client_id: matchedClientId,
          is_mayorista: customConfig.is_mayorista ?? isMayoristaDefault,
          tier_10_enabled: customConfig.tier_10_enabled ?? r.coordinator_included ?? true,
          tier_10_water: customConfig.tier_10_water ?? false,
          tier_30_enabled: customConfig.tier_30_enabled ?? r.driver_included ?? true,
          tier_50_enabled: customConfig.tier_50_enabled ?? r.includes_water ?? true,
          tier_70_enabled: customConfig.tier_70_enabled ?? true,
          tier_70_bonus: customConfig.tier_70_bonus !== undefined ? Number(customConfig.tier_70_bonus) : 10000,
          commission_per_unit: customConfig.commission_per_unit !== undefined ? Number(customConfig.commission_per_unit) : 1000
        }
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
      free_unit_step: 10,
      driver_included: true,
      coordinator_included: true,
      includes_water: true,
      is_mayorista: false,
      tier_10_enabled: true,
      tier_10_water: false,
      tier_30_enabled: true,
      tier_50_enabled: true,
      tier_70_enabled: true,
      tier_70_bonus: 10000,
      commission_per_unit: 1000,
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
      const { 
        isNew, 
        id, 
        is_mayorista,
        tier_10_enabled, 
        tier_10_water,
        tier_30_enabled, 
        tier_50_enabled, 
        tier_70_enabled, 
        tier_70_bonus, 
        commission_per_unit, 
        ...ruleData 
      } = rule

      // Map tier settings to standard DB columns
      ruleData.coordinator_included = Boolean(tier_10_enabled)
      ruleData.driver_included = Boolean(tier_30_enabled)
      ruleData.includes_water = Boolean(tier_50_enabled)

      let error
      
      if (isNew) {
        const { error: insErr } = await supabase.from("commercial_rules").insert([ruleData])
        error = insErr
      } else {
        const { error: updErr } = await supabase.from("commercial_rules").update(ruleData).eq("id", id)
        error = updErr
      }

      if (error) throw error

      // Save custom tier config in localStorage for instant access across components
      const commVal = commission_per_unit !== undefined && commission_per_unit !== "" ? Number(commission_per_unit) : 0
      const bonusVal = tier_70_bonus !== undefined && tier_70_bonus !== "" ? Number(tier_70_bonus) : 10000

      const tierConfig = {
        is_mayorista: Boolean(is_mayorista),
        tier_10_enabled: Boolean(tier_10_enabled),
        tier_10_water: Boolean(tier_10_water),
        tier_30_enabled: Boolean(tier_30_enabled),
        tier_50_enabled: Boolean(tier_50_enabled),
        tier_70_enabled: Boolean(tier_70_enabled),
        tier_70_bonus: isNaN(bonusVal) ? 10000 : bonusVal,
        commission_per_unit: isNaN(commVal) ? 0 : commVal
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`commercial_tier_config_${id}`, JSON.stringify(tierConfig))
        if (rule.company_name) {
          localStorage.setItem(`commercial_tier_config_${normalizeKey(rule.company_name)}`, JSON.stringify(tierConfig))
        }
      }

      // Sincronizar automáticamente con la tabla clients
      if (rule.company_name) {
        const priceBase = Number(rule.price_base) || 0
        const priceSintacc = Number(rule.price_sintacc_base) || priceBase || 0
        const limitPct = Number(rule.sintacc_limit_pct) || 0
        const freeStep = rule.free_unit_step ? Number(rule.free_unit_step) : null
        const saleType = is_mayorista ? 'mayorista' : 'minorista'

        if (rule.client_id) {
          await supabase.from("clients").update({
            vianda_price: priceBase,
            sintacc_price: priceSintacc,
            sintacc_included_pct: limitPct,
            free_unit_step: freeStep,
            sale_type: saleType
          }).eq("id", rule.client_id)
        } else {
          await supabase.from("clients").update({
            vianda_price: priceBase,
            sintacc_price: priceSintacc,
            sintacc_included_pct: limitPct,
            free_unit_step: freeStep,
            sale_type: saleType
          }).ilike("name", rule.company_name.trim())
        }

        // Sincronizar también con futuras tiendas online
        syncClientPricesToFutureStoresAction(rule.company_name.trim(), priceBase, priceSintacc).catch(console.error)
      }

      setMessage({ type: 'success', text: `Regla comercial de ${rule.company_name} guardada y sincronizada correctamente.` })
      fetchRules()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const saveAllRules = async () => {
    setSaving(true)
    setMessage(null)
    try {
      for (const rule of rules) {
        const { 
          isNew, 
          id, 
          is_mayorista,
          tier_10_enabled, 
          tier_10_water,
          tier_30_enabled, 
          tier_50_enabled, 
          tier_70_enabled, 
          tier_70_bonus, 
          commission_per_unit, 
          ...ruleData 
        } = rule

        ruleData.coordinator_included = Boolean(tier_10_enabled)
        ruleData.driver_included = Boolean(tier_30_enabled)
        ruleData.includes_water = Boolean(tier_50_enabled)

        if (isNew) {
          await supabase.from("commercial_rules").insert([ruleData])
        } else {
          await supabase.from("commercial_rules").update(ruleData).eq("id", id)
        }

        const commVal = commission_per_unit !== undefined && commission_per_unit !== "" ? Number(commission_per_unit) : 0
        const bonusVal = tier_70_bonus !== undefined && tier_70_bonus !== "" ? Number(tier_70_bonus) : 10000

        const tierConfig = {
          is_mayorista: Boolean(is_mayorista),
          tier_10_enabled: Boolean(tier_10_enabled),
          tier_10_water: Boolean(tier_10_water),
          tier_30_enabled: Boolean(tier_30_enabled),
          tier_50_enabled: Boolean(tier_50_enabled),
          tier_70_enabled: Boolean(tier_70_enabled),
          tier_70_bonus: isNaN(bonusVal) ? 10000 : bonusVal,
          commission_per_unit: isNaN(commVal) ? 0 : commVal
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(`commercial_tier_config_${id}`, JSON.stringify(tierConfig))
          if (rule.company_name) {
            localStorage.setItem(`commercial_tier_config_${normalizeKey(rule.company_name)}`, JSON.stringify(tierConfig))
          }
        }

        // Sincronizar automáticamente con la tabla clients
        if (rule.company_name) {
          const priceBase = Number(rule.price_base) || 0
          const priceSintacc = Number(rule.price_sintacc_base) || priceBase || 0
          const limitPct = Number(rule.sintacc_limit_pct) || 0
          const freeStep = rule.free_unit_step ? Number(rule.free_unit_step) : null
          const saleType = is_mayorista ? 'mayorista' : 'minorista'

          if (rule.client_id) {
            await supabase.from("clients").update({
              vianda_price: priceBase,
              sintacc_price: priceSintacc,
              sintacc_included_pct: limitPct,
              free_unit_step: freeStep,
              sale_type: saleType
            }).eq("id", rule.client_id)
          } else {
            await supabase.from("clients").update({
              vianda_price: priceBase,
              sintacc_price: priceSintacc,
              sintacc_included_pct: limitPct,
              free_unit_step: freeStep,
              sale_type: saleType
            }).ilike("name", rule.company_name.trim())
          }

          syncClientPricesToFutureStoresAction(rule.company_name.trim(), priceBase, priceSintacc).catch(console.error)
        }
      }

      setMessage({ type: 'success', text: '¡Todas las reglas comerciales se guardaron y sincronizaron con éxito!' })
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
      <div className="flex flex-wrap justify-between items-end gap-4 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Settings2 size={32} strokeWidth={2.5} />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Configuración Comercial</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tighter">Reglas de Precios y Escalas</h1>
          <p className="text-slate-500 mt-2 font-medium">Define precios, comisiones por vianda y las escalas de liberados aplicables a cada empresa.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={addRule}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Plus size={20} /> Nueva Regla
          </button>
          <button 
            onClick={saveAllRules}
            disabled={saving || rules.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2.5 transition-all shadow-xl shadow-emerald-200 transform active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            <span>Guardar Todos los Cambios</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          <AlertCircle size={18} />
          {message.text}
        </div>
      )}

      {/* RULES LIST */}
      <div className="grid grid-cols-1 gap-8">
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
            
            {/* ROW 1: CLIENTE, PRECIOS Y COMISIÓN */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Cliente y Modalidad */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Building2 size={12} className="text-indigo-500" /> Empresa Cliente
                  </label>
                  
                  {/* Selector Mayorista / Minorista */}
                  <button
                    type="button"
                    onClick={() => updateLocalRule(rule.id, 'is_mayorista', !rule.is_mayorista)}
                    className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full transition border ${
                      rule.is_mayorista 
                        ? 'bg-purple-100 text-purple-800 border-purple-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                    title="Alternar entre Mayorista (tripulación 100% liberada) y Minorista (por escala de ocupación)"
                  >
                    {rule.is_mayorista ? '🏢 Mayorista (Tripulación Libre)' : '🏬 Minorista (Por Escala)'}
                  </button>
                </div>
                
                <select 
                  className="w-full p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-sm font-black text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
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

                <div className="text-[10px] text-slate-400 font-semibold px-1 flex items-center justify-between">
                  <span>Técnico: <strong className="text-slate-600">{rule.company_name}</strong></span>
                  {rule.is_mayorista && (
                    <span className="text-[9px] text-purple-600 font-bold">Tripulación siempre libre</span>
                  )}
                </div>
              </div>

              {/* Precios y Comisión por Vianda */}
              <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-4 lg:border-l lg:pl-8 border-slate-100">
                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter block mb-1">Precio Base</label>
                  <div className="flex items-center gap-0.5">
                    <span className="text-slate-400 font-bold text-xs">$</span>
                    <input 
                      type="number" 
                      className="w-full text-base font-black text-slate-900 bg-transparent outline-none" 
                      value={rule.price_base} 
                      onChange={e => updateLocalRule(rule.id, 'price_base', Number(e.target.value))} 
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/60">
                  <label className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter block mb-1">Base Sin TACC</label>
                  <div className="flex items-center gap-0.5">
                    <span className="text-indigo-400 font-bold text-xs">$</span>
                    <input 
                      type="number" 
                      className="w-full text-base font-black text-indigo-700 bg-transparent outline-none" 
                      value={rule.price_sintacc_base ?? rule.price_base} 
                      onChange={e => updateLocalRule(rule.id, 'price_sintacc_base', Number(e.target.value))} 
                    />
                  </div>
                </div>

                <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/60">
                  <label className="text-[9px] font-black text-rose-500 uppercase tracking-tighter block mb-1">Exc. Sin TACC</label>
                  <div className="flex items-center gap-0.5">
                    <span className="text-rose-400 font-bold text-xs">$</span>
                    <input 
                      type="number" 
                      className="w-full text-base font-black text-rose-700 bg-transparent outline-none" 
                      value={rule.price_sintacc_threshold} 
                      onChange={e => updateLocalRule(rule.id, 'price_sintacc_threshold', Number(e.target.value))} 
                    />
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/80 ring-2 ring-emerald-500/10">
                  <label className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter block mb-1 flex items-center gap-1">
                    <DollarSign size={10} className="text-emerald-600" />
                    Comisión / Vianda
                  </label>
                  <div className="flex items-center gap-0.5">
                    <span className="text-emerald-500 font-bold text-xs">$</span>
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full text-base font-black text-emerald-800 bg-transparent outline-none" 
                      value={rule.commission_per_unit !== undefined ? rule.commission_per_unit : 1000} 
                      onChange={e => updateLocalRule(rule.id, 'commission_per_unit', e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="lg:col-span-2 flex justify-end gap-3 lg:border-l lg:pl-8 border-slate-100 items-center h-full">
                <button 
                  onClick={() => deleteRule(rule.id, rule.isNew)}
                  className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition"
                  title="Eliminar regla"
                >
                  <Trash2 size={22} />
                </button>
                <button 
                  onClick={() => saveRule(rule)}
                  disabled={saving}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition shadow-lg shadow-emerald-100 flex items-center gap-2"
                  title="Guardar cambios"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>Guardar</span>
                </button>
              </div>
            </div>

            {/* ROW 2: ESCALAS COMERCIALES (10%, 30%, 50%, 70%) & BONIFICACIONES */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
               <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Escala de Liberados y Bonificaciones (% de Ocupación)</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Activa o desactiva cada tramo de la escala según el acuerdo con esta empresa.</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                    Reglas dinámicas por volumen
                  </span>
               </div>

               {/* 4 CARDS DE LA ESCALA COMERCIAL */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* TRAMO 10%: LIBERA COORDINADOR (CON OPCIÓN DE AGUA) */}
                  <div className={`p-4 rounded-2xl border transition-all ${rule.tier_10_enabled ? 'bg-sky-50/60 border-sky-200 text-sky-950' : 'bg-slate-50/60 border-slate-200/80 text-slate-400 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-sky-100 text-sky-800 rounded-lg">
                        10% Venta
                      </span>
                      <input 
                        type="checkbox"
                        className="w-4 h-4 accent-sky-600 cursor-pointer"
                        checked={rule.tier_10_enabled ?? true}
                        onChange={e => updateLocalRule(rule.id, 'tier_10_enabled', e.target.checked)}
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <Users size={16} className={rule.tier_10_enabled ? "text-sky-600 shrink-0 mt-0.5" : "text-slate-400 shrink-0 mt-0.5"} />
                      <div className="w-full">
                        <p className="text-xs font-bold leading-snug">Libera Coordinador</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">1 vianda de tripulación para el coordinador.</p>
                        
                        {/* Selector Modalidad: Solo Vianda vs Vianda + Agua */}
                        {rule.tier_10_enabled && (
                          <div className="mt-2.5 pt-2 border-t border-sky-200/60 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateLocalRule(rule.id, 'tier_10_water', false)}
                              className={`text-[9px] font-black px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                                !rule.tier_10_water 
                                  ? 'bg-sky-600 text-white shadow-sm' 
                                  : 'bg-white/80 text-sky-800 hover:bg-sky-100'
                              }`}
                            >
                              🍱 Solo Vianda
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLocalRule(rule.id, 'tier_10_water', true)}
                              className={`text-[9px] font-black px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                                rule.tier_10_water 
                                  ? 'bg-blue-600 text-white shadow-sm' 
                                  : 'bg-white/80 text-blue-800 hover:bg-blue-100'
                              }`}
                            >
                              💧 Vianda + Agua
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TRAMO 30%: LIBERA CHOFERES */}
                  <div className={`p-4 rounded-2xl border transition-all ${rule.tier_30_enabled ? 'bg-amber-50/60 border-amber-200 text-amber-950' : 'bg-slate-50/60 border-slate-200/80 text-slate-400 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg">
                        30% Venta
                      </span>
                      <input 
                        type="checkbox"
                        className="w-4 h-4 accent-amber-600 cursor-pointer"
                        checked={rule.tier_30_enabled ?? true}
                        onChange={e => updateLocalRule(rule.id, 'tier_30_enabled', e.target.checked)}
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <UserCheck size={16} className={rule.tier_30_enabled ? "text-amber-600 shrink-0 mt-0.5" : "text-slate-400 shrink-0 mt-0.5"} />
                      <div>
                        <p className="text-xs font-bold leading-snug">Libera Chofer/es</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Libera viandas de choferes (1 o 2 por coche según unidad).</p>
                      </div>
                    </div>
                  </div>

                  {/* TRAMO 50%: LIBERA AGUAS */}
                  <div className={`p-4 rounded-2xl border transition-all ${rule.tier_50_enabled ? 'bg-blue-50/60 border-blue-200 text-blue-950' : 'bg-slate-50/60 border-slate-200/80 text-slate-400 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg">
                        50% Venta
                      </span>
                      <input 
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                        checked={rule.tier_50_enabled ?? true}
                        onChange={e => updateLocalRule(rule.id, 'tier_50_enabled', e.target.checked)}
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <Droplets size={16} className={rule.tier_50_enabled ? "text-blue-600 shrink-0 mt-0.5" : "text-slate-400 shrink-0 mt-0.5"} />
                      <div>
                        <p className="text-xs font-bold leading-snug">Libera Aguas</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Bonificación 100% de agua para todos los pasajeros.</p>
                      </div>
                    </div>
                  </div>

                  {/* TRAMO 70%: BONO COMISIÓN EXTRA */}
                  <div className={`p-4 rounded-2xl border transition-all ${rule.tier_70_enabled ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-slate-50/60 border-slate-200/80 text-slate-400 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg">
                        70% Venta
                      </span>
                      <input 
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        checked={rule.tier_70_enabled ?? true}
                        onChange={e => updateLocalRule(rule.id, 'tier_70_enabled', e.target.checked)}
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <Award size={16} className={rule.tier_70_enabled ? "text-emerald-600 shrink-0 mt-0.5" : "text-slate-400 shrink-0 mt-0.5"} />
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold leading-snug">Bono Extra Alto Rend.</p>
                        </div>
                        <div className="flex items-center gap-1 mt-1 bg-white/80 px-2 py-0.5 rounded-lg border border-emerald-100">
                          <span className="text-[9px] font-black text-emerald-700">+$</span>
                          <input 
                            type="number"
                            className="w-full text-xs font-black text-emerald-900 bg-transparent outline-none"
                            value={rule.tier_70_bonus !== undefined ? rule.tier_70_bonus : 10000}
                            onChange={e => updateLocalRule(rule.id, 'tier_70_bonus', e.target.value === '' ? '' : Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

               </div>

               {/* AJUSTES ADICIONALES: SIN TACC Y PASO FIJO */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  
                  {/* % Tolerancia Sin TACC */}
                  <div className="flex items-center justify-between p-3.5 bg-purple-50/40 border border-purple-100 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Percent size={14} className="text-purple-600" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">% Tolerancia Sin TACC en Cupo</p>
                        <p className="text-[9px] text-slate-400">Porcentaje de viandas celíacas sin costo extra</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl px-2.5 py-1">
                      <input 
                        type="number" 
                        placeholder="5"
                        className="w-12 font-black text-purple-900 bg-transparent outline-none text-right text-xs"
                        value={rule.sintacc_limit_pct ?? ""}
                        onChange={e => updateLocalRule(rule.id, 'sintacc_limit_pct', Number(e.target.value))}
                      />
                      <span className="text-xs font-bold text-purple-600">%</span>
                    </div>
                  </div>

                  {/* Paso Liberados (1 c/ X) */}
                  <div className="flex items-center justify-between p-3.5 bg-amber-50/40 border border-amber-100 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Gift size={14} className="text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">Paso Fijo de Liberados (Opcional)</p>
                        <p className="text-[9px] text-slate-400">1 vianda liberada cada X viandas vendidas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-xl px-2.5 py-1">
                      <input 
                        type="number" 
                        placeholder="10"
                        className="w-12 font-black text-amber-900 bg-transparent outline-none text-right text-xs"
                        value={rule.free_unit_step ?? ""}
                        onChange={e => updateLocalRule(rule.id, 'free_unit_step', e.target.value ? Number(e.target.value) : null)}
                      />
                      <span className="text-[10px] font-bold text-amber-600">un.</span>
                    </div>
                  </div>

               </div>
            </div>

            {/* ROW 3: VINCULACIÓN TÉCNICA (Escandallos) */}
            <div className="pt-6 border-t border-slate-100">
               <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ChefHat size={14} />
                  </div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mapeo Técnico de Recetas (Para Cocina y Escandallo)</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 'recipe_trad_id', label: 'TRADICIONAL', color: 'slate' },
                    { id: 'recipe_veg_id', label: 'VEGETARIANA', color: 'emerald' },
                    { id: 'recipe_vegan_id', label: 'VEGANA', color: 'teal' },
                    { id: 'recipe_sintacc_id', label: 'SIN TACC', color: 'indigo' }
                  ].map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                       <label className={`text-[9px] font-bold text-${cat.color}-600 uppercase tracking-wider ml-1`}>{cat.label}</label>
                       <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-400 transition"
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
