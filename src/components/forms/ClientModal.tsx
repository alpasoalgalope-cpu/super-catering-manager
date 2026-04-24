"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Building2, X, Save, Loader2, User, Phone, Mail,
  MapPin, CreditCard, Hash, Percent, Coins, TrendingUp
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────
type Client = {
  id?: string
  name: string
  company?: string
  phone?: string
  email?: string
  contact_name?: string
  sale_type?: string
  vianda_price?: number | null
  sintacc_price?: number | null
  sintacc_included_pct?: number | null
  cuit?: string | null
  localidad?: string | null
  provincia?: string | null
  free_unit_step?: number | null
  conversion_factor?: number | null
}

const EMPTY: Client = {
  name: "", company: "", phone: "", email: "", contact_name: "",
  sale_type: "mayorista", vianda_price: null, sintacc_price: null,
  sintacc_included_pct: null, cuit: "", localidad: "", provincia: "",
  free_unit_step: null, conversion_factor: 1.0,
}

// ─── Helper Sub-component ─────────────────────────────────
function Field({
  label, icon: Icon, required, children,
}: {
  label: string; icon?: any; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        {Icon && <Icon size={10} />}
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Input Styles ─────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition " +
  "focus:border-purple-400 focus:ring-1 focus:ring-purple-100 placeholder:text-slate-300"

const numCls =
  inputCls +
  " text-right tabular-nums [appearance:textfield] " +
  "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

// ─── Component ────────────────────────────────────────────
export default function ClientModal({
  isOpen,
  onClose,
  client,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  client?: Client
  onSuccess?: (id: string, name: string) => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<Client>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync when opening / changing client
  useEffect(() => {
    setForm(client ? { ...EMPTY, ...client } : EMPTY)
    setError(null)
  }, [client, isOpen])

  if (!isOpen) return null

  // ── Helpers ──────────────────────────────────────────
  const set = (field: keyof Client, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const numVal = (v: number | null | undefined): string =>
    v == null || v === 0 ? "" : String(v)

  const parseNum = (s: string) =>
    s.trim() === "" ? null : Number(s.replace(/[^\d.]/g, ""))

  // ── Submit ───────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setError(null)

    const payload: Record<string, any> = {
      name: form.name.trim(),
      company: form.company?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      contact_name: form.contact_name?.trim() || null,
      sale_type: form.sale_type || "vianda",
      vianda_price: form.vianda_price ?? null,
      sintacc_price: form.sintacc_price ?? null,
      sintacc_included_pct: form.sintacc_included_pct ?? null,
      cuit: form.cuit?.trim() || null,
      localidad: form.localidad?.trim() || null,
      provincia: form.provincia?.trim() || null,
      free_unit_step: form.free_unit_step ?? null,
      conversion_factor: form.conversion_factor ?? 1.0,
    }
    if (client?.id) payload.id = client.id

    // upsert: creates or updates depending on whether id exists
    const { data, error: err } = await supabase
      .from("clients")
      .upsert([payload], { onConflict: "id" })
      .select()

    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    const saved = data?.[0]
    if (onSuccess && saved) onSuccess(saved.id, saved.name)
    router.refresh()
    onClose()
  }

  // ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="bg-slate-900 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/10 rounded-xl">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-black text-base leading-tight">
                {client?.id ? "Editar Cliente" : "Nuevo Cliente"}
              </h2>
              <p className="text-white/50 text-[10px] font-medium">
                {client?.id ? `ID: ${client.id.slice(0,8)}…` : "Solo el nombre es obligatorio"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white transition p-1 hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-7 py-6 space-y-6"
        >
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium px-4 py-3">
              {error}
            </div>
          )}

          {/* ── IDENTIFICACIÓN ── */}
          <section className="space-y-4">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-100 pb-2">
              Identificación
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre de Fantasía" icon={Building2} required>
                <input
                  required
                  className={inputCls}
                  placeholder="Ej: Rock en las Venas"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Razón Social / Empresa" icon={Building2}>
                <input
                  className={inputCls}
                  placeholder="Ej: RE Las Venas S.A."
                  value={form.company ?? ""}
                  onChange={e => set("company", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="CUIT" icon={CreditCard}>
                <input
                  className={inputCls}
                  placeholder="20-12345678-9"
                  value={form.cuit ?? ""}
                  onChange={e => set("cuit", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Nombre de Contacto" icon={User}>
                <input
                  className={inputCls}
                  placeholder="Ej: Martín López"
                  value={form.contact_name ?? ""}
                  onChange={e => set("contact_name", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Email" icon={Mail}>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="info@empresa.com"
                  value={form.email ?? ""}
                  onChange={e => set("email", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Teléfono / WhatsApp" icon={Phone}>
                <input
                  className={inputCls}
                  placeholder="+54 9 11 ..."
                  value={form.phone ?? ""}
                  onChange={e => set("phone", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
            </div>
          </section>

          {/* ── UBICACIÓN ── */}
          <section className="space-y-4">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-100 pb-2">
              Ubicación
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Localidad" icon={MapPin}>
                <input
                  className={inputCls}
                  placeholder="Ej: CABA"
                  value={form.localidad ?? ""}
                  onChange={e => set("localidad", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Provincia" icon={MapPin}>
                <input
                  className={inputCls}
                  placeholder="Ej: Buenos Aires"
                  value={form.provincia ?? ""}
                  onChange={e => set("provincia", e.target.value)}
                  onFocus={e => e.target.select()}
                />
              </Field>
            </div>
          </section>

          {/* ── TARIFARIO ── */}
          <section className="space-y-4">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-100 pb-2">
              Tarifario de Precios
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Precio Vianda ($)" icon={Coins}>
                <input
                  inputMode="numeric"
                  className={numCls}
                  placeholder="0"
                  value={numVal(form.vianda_price)}
                  onChange={e => set("vianda_price", parseNum(e.target.value))}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Precio Sin TACC ($)" icon={Coins}>
                <input
                  inputMode="numeric"
                  className={numCls}
                  placeholder="0"
                  value={numVal(form.sintacc_price)}
                  onChange={e => set("sintacc_price", parseNum(e.target.value))}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="% Sin TACC Incl." icon={Percent}>
                <input
                  inputMode="numeric"
                  className={numCls}
                  placeholder="5"
                  value={numVal(form.sintacc_included_pct)}
                  onChange={e => set("sintacc_included_pct", parseNum(e.target.value))}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Libre cada X (step)" icon={Hash}>
                <input
                  inputMode="numeric"
                  className={numCls}
                  placeholder="Ej: 10"
                  value={numVal(form.free_unit_step)}
                  onChange={e => set("free_unit_step", parseNum(e.target.value))}
                  onFocus={e => e.target.select()}
                />
              </Field>
              <Field label="Factor Conversión (0-1)" icon={TrendingUp}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className={numCls}
                  placeholder="1.0"
                  value={form.conversion_factor ?? ""}
                  onChange={e => set("conversion_factor", parseNum(e.target.value))}
                  onFocus={e => e.target.select()}
                />
              </Field>
            </div>
            <p className="text-[10px] text-slate-400">
              <strong className="text-purple-500">% Sin TACC Incl.:</strong> porcentaje del total de PAX que se cobra a precio vianda estándar.
              El resto se cobra al precio Sin TACC. <br />
              <strong className="text-purple-500">Libre cada X:</strong> 1 unidad liberada por cada X vendidas (Ej: 10 → 1 libre cada 10). <br />
              <strong className="text-purple-500">Factor Conversión:</strong> Multiplicador de PAX para planificación de compras (Ej: 0.5 = 50%).
            </p>
          </section>

          {/* ── TIPO VENTA ── */}
          <section className="space-y-3">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-100 pb-2">
              Tipo de Venta
            </p>
            <div className="flex gap-3">
              {[
                { id: "mayorista", label: "Mayorista" },
                { id: "minorista", label: "Minorista" },
                { id: "combo", label: "Combo" }
              ].map(type => (
                <label
                  key={type.id}
                  className={`flex-1 text-center py-2.5 rounded-xl border cursor-pointer text-xs font-black uppercase transition ${
                    form.sale_type === type.id
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="sale_type"
                    value={type.id}
                    checked={form.sale_type === type.id}
                    onChange={() => set("sale_type", type.id)}
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !form.name.trim()}
            onClick={() => formRef.current?.requestSubmit()}
            className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-500 transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {loading ? "Guardando..." : client?.id ? "Actualizar" : "Crear Cliente"}
          </button>
        </div>

      </div>
    </div>
  )
}
