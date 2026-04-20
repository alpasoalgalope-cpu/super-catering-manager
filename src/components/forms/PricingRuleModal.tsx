"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function PricingRuleModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const rule_name = formData.get("rule_name") as string
    const unit_price = parseFloat(formData.get("unit_price") as string)
    const includes_water = formData.get("includes_water") === "on"
    const is_gluten_free = formData.get("is_gluten_free") === "on"
    const sintacc_surcharge = parseFloat((formData.get("sintacc_surcharge") as string) || "0")

    const { error: insertError } = await supabase
      .from("pricing_rules")
      .insert([
        {
          rule_name,
          unit_price,
          includes_water,
          is_gluten_free,
          sintacc_surcharge,
        },
      ])

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">
            Nueva Regla de Precio
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="rule_name" className="text-sm font-medium text-slate-700">
              Nombre de la Regla
            </label>
            <input
              required
              type="text"
              id="rule_name"
              name="rule_name"
              placeholder="Ej. Entrada Campo, VIP..."
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="unit_price" className="text-sm font-medium text-slate-700">
              Precio Unitario (ARS)
            </label>
            <input
              required
              type="number"
              step="0.01"
              id="unit_price"
              name="unit_price"
              placeholder="0.00"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="sintacc_surcharge" className="text-sm font-medium text-slate-700">
              Recargo por exceso Sin TACC ($)
            </label>
            <input
              required
              type="number"
              step="0.01"
              id="sintacc_surcharge"
              name="sintacc_surcharge"
              defaultValue="0"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="flex flex-col gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                name="includes_water"
                className="h-4 w-4 rounded border-slate-300 text-[#7FB3D5] focus:ring-[#7FB3D5]"
              />
              ¿Incluye Agua?
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                name="is_gluten_free"
                className="h-4 w-4 rounded border-slate-300 text-[#7FB3D5] focus:ring-[#7FB3D5]"
              />
              ¿Menú sin TACC (Gluten Free)?
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[#7FB3D5] px-4 py-2 text-sm font-medium text-white hover:bg-[#6FA3C5] transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Regla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
