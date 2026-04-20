"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function VehicleModal({
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
    const vehicle_type = formData.get("vehicle_type") as string
    const capacity = parseInt(formData.get("capacity") as string, 10)
    const default_driver_meals = parseInt(formData.get("default_driver_meals") as string, 10)

    const { error: insertError } = await supabase
      .from("vehicle_defaults")
      .upsert([
        {
          vehicle_type,
          capacity,
          default_driver_meals,
        },
      ], { onConflict: "vehicle_type" })

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
            Vehículo por Defecto
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
            <label htmlFor="vehicle_type" className="text-sm font-medium text-slate-700">
              Tipo de Vehículo
            </label>
            <select
              required
              id="vehicle_type"
              name="vehicle_type"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            >
              <option value="Micro">Micro</option>
              <option value="Traffic">Traffic</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="capacity" className="text-sm font-medium text-slate-700">
              Capacidad Estimada (Pasajeros)
            </label>
            <input
              required
              type="number"
              min="1"
              id="capacity"
              name="capacity"
              placeholder="Ej. 60"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="default_driver_meals" className="text-sm font-medium text-slate-700">
              Viandas de Chofer (Automáticas)
            </label>
            <input
              required
              type="number"
              min="0"
              id="default_driver_meals"
              name="default_driver_meals"
              placeholder="Ej. 2"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
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
              {loading ? "Guardando..." : "Guardar Registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
