"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import ClientModal from "../forms/ClientModal"
import { useRouter } from "next/navigation"

type Client = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  contact_name: string
  vianda_price: number
  sintacc_price: number
  sintacc_included_pct: number
  created_at: string
}

export default function ClientList({ initialData }: { initialData: Client[] }) {
  const router = useRouter()
  const [selectedClient, setSelectedClient] = useState<Client | undefined>()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedClient(undefined)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar cliente?")) return
    const { error } = await supabase.from("clients").delete().eq("id", id)
    if (error) alert(error.message)
    else router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes y Tarifas</h1>
          <p className="text-sm text-slate-500">Gestiona los precios base y Sin TACC por cada empresa.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-[#7FB3D5] text-white px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-[#6FA3C5]"
        >
          + Nuevo Cliente
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="p-4 border-b">Empresa / Contacto</th>
              <th className="p-4 border-b">Email / Tel</th>
              <th className="p-4 border-b text-center">P. Clásico</th>
              <th className="p-4 border-b text-center">P. Sin TACC</th>
              <th className="p-4 border-b text-center">% Inc.</th>
              <th className="p-4 border-b text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {initialData.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition">
                <td className="p-4">
                  <div className="font-bold text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.company}</div>
                </td>
                <td className="p-4">
                  <div className="text-slate-600">{c.email}</div>
                  <div className="text-xs text-slate-400 font-mono">{c.phone}</div>
                </td>
                <td className="p-4 text-center">
                   <span className="font-black text-slate-700">${c.vianda_price?.toLocaleString() || 0}</span>
                </td>
                <td className="p-4 text-center">
                   <span className="font-black text-blue-600">${c.sintacc_price?.toLocaleString() || 0}</span>
                </td>
                <td className="p-4 text-center">
                   <span className="bg-[#A8D8B9]/20 text-[#4c845d] px-2 py-0.5 rounded-full font-bold text-xs">
                     {c.sintacc_included_pct}%
                   </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleEdit(c)} className="text-[#7FB3D5] font-bold mr-3 hover:underline">Editar</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 font-medium">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={selectedClient}
      />
    </div>
  )
}
