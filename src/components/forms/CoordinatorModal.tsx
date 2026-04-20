"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Coordinator = {
  id?: string
  name: string
  phone: string
  company: string
}

export default function CoordinatorModal({
  isOpen,
  onClose,
  coordinator,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  coordinator?: Coordinator
  onSuccess?: (id: string, name: string) => void
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
    const name = formData.get("name") as string
    const phone = formData.get("phone") as string
    const company = formData.get("company") as string

    let result;

    if (coordinator?.id) {
      result = await supabase
        .from("coordinators")
        .update({ name, phone, company })
        .eq("id", coordinator.id)
        .select()
    } else {
      result = await supabase
        .from("coordinators")
        .insert([{ name, phone, company }])
        .select()
    }

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
    } else {
      if (onSuccess && result.data && result.data.length > 0) {
        onSuccess(result.data[0].id, result.data[0].name)
      }
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            {coordinator ? "Editar Coordinador" : "Nuevo Coordinador"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Nombre Completo</label>
            <input
              required
              name="name"
              defaultValue={coordinator?.name}
              placeholder="Ej. Juan Pérez"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Teléfono / WhatsApp</label>
            <input
              required
              name="phone"
              defaultValue={coordinator?.phone}
              placeholder="Ej. +54 9 11 ..."
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Empresa / Afiliación</label>
            <input
              required
              name="company"
              defaultValue={coordinator?.company}
              placeholder="Ej. Rock en las Venas"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#7FB3D5] focus:ring-1 focus:ring-[#7FB3D5]"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[#7FB3D5] px-4 py-2 text-sm font-medium text-white hover:bg-[#6FA3C5] transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Coordinador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
