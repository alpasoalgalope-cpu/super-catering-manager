"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Bus, Save, Loader2, X, Hash, CreditCard, Gauge, Building2, Tag } from "lucide-react"

// ─── Types ────────────────────────────────────────────────
type Client = { id: string; name: string }

type Vehicle = {
  id?: string
  client_id: string | null
  internal_name: string
  plate: string
  brand?: string | null
  vehicle_type: "Micro" | "Trafic" | ""
  capacity: number | null
}

const CAPACITY_DEFAULTS: Record<string, number> = {
  Micro: 62,
  Trafic: 17,
}

const EMPTY: Vehicle = {
  client_id: null,
  internal_name: "",
  plate: "",
  brand: "",
  vehicle_type: "",
  capacity: null,
}

// ─── Input Style ──────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition " +
  "focus:border-purple-400 focus:ring-1 focus:ring-purple-100 placeholder:text-slate-300"

const numCls =
  inputCls +
  " text-right tabular-nums [appearance:textfield] " +
  "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

// ─── Field Wrapper ────────────────────────────────────────
function Field({ label, icon: Icon, required, children }: {
  label: string; icon?: any; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        {Icon && <Icon size={10} />}{label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────
export default function FleetModal({
  isOpen,
  onClose,
  vehicle,
  clients,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  vehicle?: Vehicle
  clients: Client[]
  onSuccess: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<Vehicle>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(vehicle ? { ...EMPTY, ...vehicle } : EMPTY)
    setError(null)
  }, [vehicle, isOpen])

  if (!isOpen) return null

  const set = (field: keyof Vehicle, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleTypeChange = (type: "Micro" | "Trafic") => {
    setForm(prev => ({
      ...prev,
      vehicle_type: type,
      // Only auto-fill capacity if it hasn't been manually changed or is at default
      capacity: CAPACITY_DEFAULTS[type],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload: Record<string, any> = {
      client_id: form.client_id || null,
      internal_name: form.internal_name.trim(),
      plate: form.plate.trim().toUpperCase(),
      brand: form.brand?.trim() || null,
      vehicle_type: form.vehicle_type || null,
      capacity: form.capacity ?? null,
    }

    let err: any;
    if (vehicle?.id) {
      const res = await supabase
        .from("vehicles")
        .update(payload)
        .eq("id", vehicle.id)
      err = res.error
    } else {
      const res = await supabase
        .from("vehicles")
        .insert([payload])
      err = res.error
    }

    setLoading(false)
    if (err) { 
      console.error("🔥 SUPABASE ERROR DETAILS:\n", JSON.stringify(err, null, 2))
      const codeMsg = err.code ? ` (Código: ${err.code})` : ""
      setError(`Error al guardar: ${err.message}${codeMsg}. Revisar consola para más detalles.`)
      return 
    }
    
    onSuccess()
    onClose()
  }

  const canSave = true

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-slate-900 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/10 rounded-xl"><Bus size={18} /></div>
            <div>
              <h2 className="font-black text-base leading-tight">
                {vehicle?.id ? "Editar Unidad" : "Nueva Unidad de Flota"}
              </h2>
              <p className="text-white/50 text-[10px] font-medium">
                Solo Interno y Patente son obligatorios
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="text-white/50 hover:text-white transition p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form ref={formRef} onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3 font-medium">
              {error}
            </div>
          )}

          {/* Identificación */}
          <section className="space-y-4">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-100 pb-2">
              Identificación
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Interno / Nombre" icon={Tag}>
                <input
                  className={inputCls}
                  placeholder="Ej: Bus 01, Trafic Azul"
                  value={form.internal_name}
                  onChange={e => set("internal_name", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Patente" icon={CreditCard}>
                <input
                  className={`${inputCls} uppercase font-mono`}
                  placeholder="Ej: AB 123 CD"
                  value={form.plate}
                  onChange={e => set("plate", e.target.value.toUpperCase())}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Marca / Modelo" icon={Hash}>
                <input
                  className={inputCls}
                  placeholder="Ej: Mercedes-Benz OF-1721"
                  value={form.brand ?? ""}
                  onChange={e => set("brand", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Empresa Dueña" icon={Building2}>
                <select
                  className={inputCls}
                  value={form.client_id ?? ""}
                  onChange={e => set("client_id", e.target.value || null)}
                >
                  <option value="">— Sin empresa —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Tipo y Capacidad */}
          <section className="space-y-4">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-100 pb-2">
              Tipo y Capacidad
            </p>

            {/* Type buttons */}
            <div className="grid grid-cols-2 gap-3">
              {(["Micro", "Trafic"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`py-4 rounded-2xl border-2 font-black text-sm transition flex flex-col items-center gap-1 ${
                    form.vehicle_type === type
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >
                  <Bus size={22} className={form.vehicle_type === type ? "text-purple-500" : "text-slate-300"} />
                  <span>{type}</span>
                  <span className="text-[10px] font-medium opacity-60">{CAPACITY_DEFAULTS[type]} PAX default</span>
                </button>
              ))}
            </div>

            {/* Capacity override */}
            <Field label="Capacidad Real (PAX)" icon={Gauge}>
              <input
                inputMode="numeric"
                className={numCls}
                placeholder={form.vehicle_type ? String(CAPACITY_DEFAULTS[form.vehicle_type]) : "0"}
                value={form.capacity ?? ""}
                onChange={e => set("capacity", e.target.value ? parseInt(e.target.value.replace(/\D/g, "")) || null : null)}
                onFocus={e => e.target.select()}
              />
              <p className="text-[10px] text-slate-400">
                Se autocompleta al elegir tipo. Podés sobreescribirlo.
              </p>
            </Field>
          </section>
        </form>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !canSave}
            onClick={() => formRef.current?.requestSubmit()}
            className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-500 transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {loading ? "Guardando..." : vehicle?.id ? "Actualizar" : "Crear Unidad"}
          </button>
        </div>
      </div>
    </div>
  )
}
