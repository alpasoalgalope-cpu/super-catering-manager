import React from "react"
import { supabase } from "@/lib/supabase"
import StockManager from "@/components/inventory/StockManager"
import { Boxes } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function InventarioStockPage() {
  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, stock_actual, stock_anterior, stock_minimo, familias(nombre)')
    .order('familia_id', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    return <div className="p-8 text-rose-500 font-bold">Error al cargar productos: {error.message}</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Boxes size={32} strokeWidth={2.5} />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Inventario / Operaciones</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tighter">Control de Stock</h1>
          <p className="text-slate-500 mt-2 font-medium">Actualización rápida de existencias físicas en depósito.</p>
        </div>
      </div>

      <StockManager initialProducts={productos as any} />
    </div>
  )
}
