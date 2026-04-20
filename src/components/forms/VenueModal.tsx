"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { MapPin, X, Save, Loader2 } from "lucide-react"

interface Venue {
  id: string
  name: string
  address?: string
  meeting_point?: string
}

interface VenueModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (venue: Venue) => void
}

export default function VenueModal({ isOpen, onClose, onSuccess }: VenueModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", address: "", meeting_point: "" })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("venues")
      .insert([{ name: form.name.trim(), address: form.address.trim(), meeting_point: form.meeting_point.trim() }])
      .select()
      .single()

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSuccess(data as Venue)
      setForm({ name: "", address: "", meeting_point: "" })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <MapPin size={20} />
            <h2 className="font-black text-lg">Nuevo Venue / Predio</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Nombre del Venue *</label>
            <input
              required
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition"
              placeholder="Ej: Estadio River Plate"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Dirección / Maps</label>
            <input
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
              placeholder="Ej: Av. Figueroa Alcorta 7597"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Punto de Encuentro / Descarga</label>
            <input
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition"
              placeholder="Ej: Portón 4 - Calle Udaondo"
              value={form.meeting_point}
              onChange={e => setForm({ ...form, meeting_point: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-500 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Guardando..." : "Crear Venue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
