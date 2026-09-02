"use client"

import React, { useState, useEffect } from 'react'
import { X, Save, Loader2, Clock, CheckCircle2, AlertTriangle, ToggleLeft, ToggleRight, Sparkles, Store, Package } from 'lucide-react'
import { updateStoreEventAction } from '@/app/actions/online-sales'

interface Props {
  store: any
  onClose: () => void
  onUpdated: (updatedStore?: any) => void
}

export default function StoreEditModal({ store, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Format existing sales_deadline to YYYY-MM-DDTHH:MM for input[type="datetime-local"]
  const getInitialDeadline = (deadlineVal?: string) => {
    const val = deadlineVal !== undefined ? deadlineVal : store.sales_deadline
    if (!val) return ''
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return ''
      const pad = (n: number) => n < 10 ? '0' + n : n
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  const [formData, setFormData] = useState({
    title: store.title || '',
    subtitle: store.subtitle || '',
    is_active: store.is_active ?? true,
    sales_deadline: getInitialDeadline(),
    
    // Combos stock & prices
    combo_trad_enabled: store.combo_trad_enabled ?? true,
    combo_trad_price: Number(store.combo_trad_price) || 0,
    combo_trad_name: store.combo_trad_name || 'Combo Tradicional + Agua sin Gas',
    combo_trad_desc: store.combo_trad_desc || '',

    combo_veg_enabled: store.combo_veg_enabled ?? true,
    combo_veg_price: Number(store.combo_veg_price) || 0,
    combo_veg_name: store.combo_veg_name || 'Combo Vegetariano + Agua sin Gas',
    combo_veg_desc: store.combo_veg_desc || '',

    combo_sintacc_enabled: store.combo_sintacc_enabled ?? true,
    combo_sintacc_price: Number(store.combo_sintacc_price) || 0,
    combo_sintacc_name: store.combo_sintacc_name || 'Combo Sin TACC + Agua sin Gas',
    combo_sintacc_desc: store.combo_sintacc_desc || '',

    combo_vegan_enabled: store.combo_vegan_enabled ?? true,
    combo_vegan_price: Number(store.combo_vegan_price) || 0,
    combo_vegan_name: store.combo_vegan_name || 'Combo Vegano + Agua sin Gas',
    combo_vegan_desc: store.combo_vegan_desc || ''
  })

  // Keep formData in sync whenever store prop changes
  useEffect(() => {
    if (store) {
      setFormData({
        title: store.title || '',
        subtitle: store.subtitle || '',
        is_active: store.is_active ?? true,
        sales_deadline: getInitialDeadline(store.sales_deadline),
        
        combo_trad_enabled: store.combo_trad_enabled ?? true,
        combo_trad_price: Number(store.combo_trad_price) || 0,
        combo_trad_name: store.combo_trad_name || 'Combo Tradicional + Agua sin Gas',
        combo_trad_desc: store.combo_trad_desc || '',

        combo_veg_enabled: store.combo_veg_enabled ?? true,
        combo_veg_price: Number(store.combo_veg_price) || 0,
        combo_veg_name: store.combo_veg_name || 'Combo Vegetariano + Agua sin Gas',
        combo_veg_desc: store.combo_veg_desc || '',

        combo_sintacc_enabled: store.combo_sintacc_enabled ?? true,
        combo_sintacc_price: Number(store.combo_sintacc_price) || 0,
        combo_sintacc_name: store.combo_sintacc_name || 'Combo Sin TACC + Agua sin Gas',
        combo_sintacc_desc: store.combo_sintacc_desc || '',

        combo_vegan_enabled: store.combo_vegan_enabled ?? true,
        combo_vegan_price: Number(store.combo_vegan_price) || 0,
        combo_vegan_name: store.combo_vegan_name || 'Combo Vegano + Agua sin Gas',
        combo_vegan_desc: store.combo_vegan_desc || ''
      })
    }
  }, [store])

  const eventDate = store.available_dates?.[0] || store.events_master?.event_date

  const setPresetDeadline = (hours: number, minutes: number = 0) => {
    if (!eventDate) return
    const pad = (n: number) => n < 10 ? '0' + n : n
    setFormData(prev => ({
      ...prev,
      sales_deadline: `${eventDate}T${pad(hours)}:${pad(minutes)}`
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const toBuenosAiresISO = (dtString: string) => {
        if (!dtString) return null
        // If it's already a full ISO string with timezone, parse it
        if (dtString.includes('Z') || (dtString.includes('-') && dtString.length > 19)) {
          return new Date(dtString).toISOString()
        }
        // If it's YYYY-MM-DDTHH:mm, attach -03:00 (Buenos Aires ART)
        const clean = dtString.length === 16 ? `${dtString}:00-03:00` : dtString
        return new Date(clean).toISOString()
      }

      const payload: any = {
        title: formData.title,
        subtitle: formData.subtitle,
        is_active: formData.is_active,
        sales_deadline: formData.sales_deadline ? toBuenosAiresISO(formData.sales_deadline) : null,
        
        combo_trad_enabled: formData.combo_trad_enabled,
        combo_trad_price: Number(formData.combo_trad_price),
        combo_trad_name: formData.combo_trad_name,
        combo_trad_desc: formData.combo_trad_desc,

        combo_veg_enabled: formData.combo_veg_enabled,
        combo_veg_price: Number(formData.combo_veg_price),
        combo_veg_name: formData.combo_veg_name,
        combo_veg_desc: formData.combo_veg_desc,

        combo_sintacc_enabled: formData.combo_sintacc_enabled,
        combo_sintacc_price: Number(formData.combo_sintacc_price),
        combo_sintacc_name: formData.combo_sintacc_name,
        combo_sintacc_desc: formData.combo_sintacc_desc,

        combo_vegan_enabled: formData.combo_vegan_enabled,
        combo_vegan_price: Number(formData.combo_vegan_price),
        combo_vegan_name: formData.combo_vegan_name,
        combo_vegan_desc: formData.combo_vegan_desc
      }

      const res = await updateStoreEventAction(store.id, payload)
      if (!res.success) throw new Error(res.error || 'Error al actualizar tienda')

      onUpdated(res.data || { ...store, ...payload })
    } catch (err: any) {
      console.error("Error updating store:", err)
      setError(err.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                Ajustes de Tienda
              </span>
              <span className="text-xs text-slate-400 font-bold">/tienda/{store.slug}</span>
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-tight text-white mt-1">
              {formData.title || store.title}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* 1. APERTURA / CIERRE MANUAL & HORARIO */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Store size={15} className="text-indigo-600" />
              1. Estado de Tienda y Horario de Cierre
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Manual Open/Closed Switch */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
                <div>
                  <label className="text-xs font-bold text-slate-800 block">
                    {formData.is_active ? "🟢 Tienda Abierta (Recibiendo Pedidos)" : "🔴 Tienda Pausada (Cerrada)"}
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {formData.is_active ? "Los pasajeros pueden comprar online." : "Bloquea compras con cartel de pausa."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(d => ({ ...d, is_active: !d.is_active }))}
                  className="cursor-pointer text-indigo-600 hover:opacity-80 transition"
                >
                  {formData.is_active ? <ToggleRight size={36} className="text-emerald-500" /> : <ToggleLeft size={36} className="text-slate-400" />}
                </button>
              </div>

              {/* Automatic Sales Deadline */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Clock size={13} className="text-indigo-600" /> Cierre Automático (Hora Bs. As.)
                  </label>
                  {formData.sales_deadline && (
                    <button
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, sales_deadline: '' }))}
                      className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                    >
                      Quitar límite
                    </button>
                  )}
                </div>

                <input
                  type="datetime-local"
                  value={formData.sales_deadline}
                  onChange={e => setFormData(d => ({ ...d, sales_deadline: e.target.value }))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />

                {eventDate && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPresetDeadline(12, 0)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                    >
                      Día del viaje 12:00 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDeadline(18, 0)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                    >
                      Día del viaje 18:00 PM
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. CONTROL DE STOCK Y DISPONIBILIDAD POR PRODUCTO */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Package size={15} className="text-indigo-600" />
                2. Disponibilidad de Combos (Encender / Apagar Stock)
              </h3>
              <span className="text-[11px] text-slate-500 font-semibold">
                Apagá un combo si te quedaste sin pan, fiambre o insumos.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Tradicional */}
              <div className={`p-4 rounded-2xl border transition ${formData.combo_trad_enabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/80 border-slate-200 opacity-75'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-slate-800">🥪 Combo Tradicional</span>
                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, combo_trad_enabled: !d.combo_trad_enabled }))}
                    className="cursor-pointer"
                  >
                    {formData.combo_trad_enabled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">DISPONIBLE</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">SIN STOCK</span>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={formData.combo_trad_price}
                    onChange={e => setFormData(d => ({ ...d, combo_trad_price: Number(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="Precio"
                  />
                </div>
              </div>

              {/* Vegetariano */}
              <div className={`p-4 rounded-2xl border transition ${formData.combo_veg_enabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/80 border-slate-200 opacity-75'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-slate-800">🥗 Combo Vegetariano</span>
                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, combo_veg_enabled: !d.combo_veg_enabled }))}
                    className="cursor-pointer"
                  >
                    {formData.combo_veg_enabled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">DISPONIBLE</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">SIN STOCK</span>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={formData.combo_veg_price}
                    onChange={e => setFormData(d => ({ ...d, combo_veg_price: Number(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="Precio"
                  />
                </div>
              </div>

              {/* Sin TACC */}
              <div className={`p-4 rounded-2xl border transition ${formData.combo_sintacc_enabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/80 border-slate-200 opacity-75'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-slate-800">🌾 Combo Sin TACC</span>
                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, combo_sintacc_enabled: !d.combo_sintacc_enabled }))}
                    className="cursor-pointer"
                  >
                    {formData.combo_sintacc_enabled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">DISPONIBLE</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">SIN STOCK</span>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={formData.combo_sintacc_price}
                    onChange={e => setFormData(d => ({ ...d, combo_sintacc_price: Number(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="Precio"
                  />
                </div>
              </div>

              {/* Vegano */}
              <div className={`p-4 rounded-2xl border transition ${formData.combo_vegan_enabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/80 border-slate-200 opacity-75'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-slate-800">🌱 Combo Vegano</span>
                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, combo_vegan_enabled: !d.combo_vegan_enabled }))}
                    className="cursor-pointer"
                  >
                    {formData.combo_vegan_enabled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">DISPONIBLE</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">SIN STOCK</span>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={formData.combo_vegan_price}
                    onChange={e => setFormData(d => ({ ...d, combo_vegan_price: Number(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="Precio"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
