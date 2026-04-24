"use client"

import React, { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { createProveedorAction } from "@/app/actions/inventory"

export default function ProveedorForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const nombre = formData.get("nombre") as string
    const contacto = formData.get("contacto") as string

    try {
      const result = await createProveedorAction(nombre, contacto)
      if (result.success) {
        ;(e.target as HTMLFormElement).reset()
      } else {
        setError(result.error || "Error al guardar")
      }
    } catch (err: any) {
      setError(err.message || "Error fatal")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
        <Plus size={16} /> Alta de Proveedor
      </h2>
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nombre / Razón Social</label>
        <input 
          name="nombre"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold focus:border-indigo-500 transition disabled:opacity-50"
          placeholder="Ej: Distribuidora Frigor..."
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Contacto / Teléfono</label>
        <input 
          name="contacto"
          disabled={isSubmitting}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold focus:border-indigo-500 transition disabled:opacity-50"
          placeholder="Ej: 11 1234-5678"
        />
      </div>

      {error && (
        <p className="text-xs font-bold text-rose-500 px-1">{error}</p>
      )}

      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Agregar Proveedor"}
      </button>
    </form>
  )
}
