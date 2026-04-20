"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Building2, X, Save, Loader2 } from "lucide-react"

interface CompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (name: string) => void
}

export default function CompanyModal({ isOpen, onClose, onSuccess }: CompanyModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    company_name: "",
    price_base: "",
    sintacc_limit_pct: "10",
    special_sintacc_price: "",
    includes_water: false,
    // New extended fields
    address: "",
    city: "",
    province: "",
    cuit: "",
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from("commercial_rules")
      .insert([{
        company_name: form.company_name.trim(),
        price_base: form.price_base ? parseFloat(form.price_base) : null,
        sintacc_limit_pct: form.sintacc_limit_pct ? parseFloat(form.sintacc_limit_pct) : 10,
        special_sintacc_price: form.special_sintacc_price ? parseFloat(form.special_sintacc_price) : null,
        includes_water: form.includes_water,
        // Extended fields (stored in notes/extra fields if columns exist, otherwise ignored gracefully)
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        cuit: form.cuit.trim() || null,
      }])

    setSaving(false)
    if (err) {
      // If columns don't exist yet, retry without them
      const { error: err2 } = await supabase
        .from("commercial_rules")
        .insert([{
          company_name: form.company_name.trim(),
          price_base: form.price_base ? parseFloat(form.price_base) : null,
          sintacc_limit_pct: form.sintacc_limit_pct ? parseFloat(form.sintacc_limit_pct) : 10,
          includes_water: form.includes_water,
        }])
      if (err2) {
        setSaving(false)
        setError(err2.message)
        return
      }
    }
    onSuccess(form.company_name.trim())
    setForm({ company_name: "", price_base: "", sintacc_limit_pct: "10", special_sintacc_price: "", includes_water: false, address: "", city: "", province: "", cuit: "" })
    onClose()
  }

  const Field = ({ label, value, onChange, placeholder, type = "text" }: any) => (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase">{label}</label>
      <input
        type={type}
        inputMode={type === "numeric" ? "numeric" : undefined}
        className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 transition text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(type === "numeric" ? /\D/g : /(?!)/g, ''))}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Building2 size={20} />
            <h2 className="font-black text-lg">Nueva Empresa Cliente</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>
          )}

          {/* Required */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Nombre de la Empresa *</label>
            <input
              required
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 transition font-bold"
              placeholder="Ej: Rock en las Venas"
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
            />
          </div>

          {/* Identity */}
          <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos Fiscales / Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CUIT" placeholder="20-12345678-9" value={form.cuit} onChange={(v: string) => setForm({ ...form, cuit: v })} />
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Provincia</label>
                <input
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 transition text-sm"
                  placeholder="Ej: Buenos Aires"
                  value={form.province}
                  onChange={e => setForm({ ...form, province: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Localidad</label>
                <input
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 transition text-sm"
                  placeholder="Ej: CABA"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Dirección</label>
                <input
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 transition text-sm"
                  placeholder="Ej: Corrientes 1234"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regla Comercial (Opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Precio Base (ARS)</label>
                <input
                  type="text" inputMode="numeric"
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm"
                  placeholder="0"
                  value={form.price_base}
                  onChange={e => setForm({ ...form, price_base: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">% Sin TACC Libre</label>
                <input
                  type="text" inputMode="numeric"
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm"
                  placeholder="10"
                  value={form.sintacc_limit_pct}
                  onChange={e => setForm({ ...form, sintacc_limit_pct: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>
            {/* Precio Especial Sin TACC */}
            <div className="space-y-1 p-3 rounded-xl border border-purple-100 bg-purple-50">
              <label className="text-[10px] font-black text-purple-500 uppercase flex items-center gap-1">
                ⚡ Precio Especial Sin TACC (Override)
              </label>
              <input
                type="text" inputMode="numeric"
                className="w-full p-3 border border-purple-200 rounded-xl outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm bg-white"
                placeholder="Ej: 10000 (RV TRASLADOS)"
                value={form.special_sintacc_price}
                onChange={e => setForm({ ...form, special_sintacc_price: e.target.value.replace(/\D/g, '') })}
              />
              <p className="text-[9px] text-purple-400">Si se completa, este precio reemplaza al Sin TACC base para esta empresa.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white transition">
              <input
                type="checkbox"
                className="w-5 h-5 rounded accent-indigo-600"
                checked={form.includes_water}
                onChange={e => setForm({ ...form, includes_water: e.target.checked })}
              />
              <span className="text-sm font-bold text-slate-700">Incluye Agua</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Guardando..." : "Crear Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
