"use client"

import React, { useState } from "react"
import ProductForm from "@/components/forms/ProductForm"
import { Package, Pencil, Trash2, Search, Filter } from "lucide-react"
import { Producto, Familia, Proveedor } from "@/types/inventory"
import { deleteProductAction } from "@/app/actions/inventory"

interface Props {
  initialProductos: any[]
  familias: Familia[]
  proveedores: Proveedor[]
}

export default function ProductManager({ initialProductos, familias, proveedores }: Props) {
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este insumo?")) {
      await deleteProductAction(id)
    }
  }

  const filteredProductos = initialProductos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-8">
      {/* Formulario de Alta/Edición */}
      <ProductForm 
        familias={familias} 
        proveedores={proveedores} 
        initialData={editingProduct}
        onCancel={() => setEditingProduct(null)}
        onSuccess={() => setEditingProduct(null)}
      />

      {/* Listado de Productos */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Catálogo Operativo</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de insumos y costos</p>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold focus:border-indigo-400 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Insumo</th>
                <th className="px-6 py-4">Familia / Proveedor</th>
                <th className="px-6 py-4">Fto. Compra</th>
                <th className="px-6 py-4 text-center">Rinde</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProductos.map(p => {
                // Obtener el precio más reciente si existe
                const latestPrice = p.precios_historicos && p.precios_historicos.length > 0
                  ? p.precios_historicos.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                  : null

                return (
                  <tr key={p.id} className={`hover:bg-slate-50/80 transition group ${editingProduct?.id === p.id ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="font-black text-slate-800">{p.nombre}</div>
                      {latestPrice && (
                        <div className="text-[10px] font-bold text-indigo-500 mt-0.5">
                          Ult. Precio: ${latestPrice.precio_neto}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                          {p.familias?.nombre || 'S/F'}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {p.proveedores?.nombre || 'S/P'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-600 text-xs">
                      {p.gramos_por_unidad} {p.unidad_medida}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="px-3 py-1 bg-rose-50 text-rose-600 font-black text-[10px] rounded-lg border border-rose-100 italic">
                        {(p.factor_merma * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button 
                          onClick={() => setEditingProduct({ ...p, precio_neto: latestPrice?.precio_neto })}
                          className="p-2 hover:bg-white hover:text-indigo-600 rounded-xl transition shadow-sm border border-transparent hover:border-slate-200"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-2 hover:bg-white hover:text-rose-600 rounded-xl transition shadow-sm border border-transparent hover:border-slate-200"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredProductos.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                     No se encontraron insumos que coincidan con la búsqueda.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
