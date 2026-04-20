"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import CoordinatorModal from "../forms/CoordinatorModal"

type Coordinator = {
  id: string
  name: string
  phone: string
  company: string
  created_at: string
}

export default function CoordinatorList({ initialData }: { initialData: Coordinator[] }) {
  const router = useRouter()
  const [coordinators, setCoordinators] = useState<Coordinator[]>(initialData)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCoordinator, setSelectedCoordinator] = useState<Coordinator | undefined>()

  const handleEdit = (coord: Coordinator) => {
    setSelectedCoordinator(coord)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedCoordinator(undefined)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este coordinador?")) return

    const { error } = await supabase.from("coordinators").delete().eq("id", id)

    if (error) {
      alert("Error al eliminar: " + error.message)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Coordinadores</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de responsables de micros y unidades.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="rounded-xl bg-[#7FB3D5] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#6FA3C5]"
        >
          + Nuevo Coordinador
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#EAF4F4] text-slate-700 uppercase text-xs tracking-wide">
              <th className="text-left p-4 font-semibold border-b border-slate-200">Nombre</th>
              <th className="text-left p-4 font-semibold border-b border-slate-200">Teléfono</th>
              <th className="text-left p-4 font-semibold border-b border-slate-200">Empresa</th>
              <th className="text-right p-4 font-semibold border-b border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {initialData.map((coord) => (
              <tr key={coord.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4 text-slate-800 font-semibold">{coord.name}</td>
                <td className="p-4 text-slate-600 font-mono text-xs">{coord.phone}</td>
                <td className="p-4 text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                    {coord.company}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(coord)}
                    className="text-[#7FB3D5] hover:text-[#5794BC] font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(coord.id)}
                    className="text-red-400 hover:text-red-600 font-medium"
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {initialData.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400">
                  No hay coordinadores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CoordinatorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        coordinator={selectedCoordinator}
      />
    </div>
  )
}
