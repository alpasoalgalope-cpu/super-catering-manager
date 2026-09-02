"use client"

import React, { useState } from "react"
import { Search, Package, ArrowRight, Tag, Building2, Calculator, Info, Edit3, X } from "lucide-react"
import ProductForm from "@/components/forms/ProductForm"
import { formatMoneyAR } from "@/lib/currency"

interface Props {
  productos: any[]
  familias: any[]
  proveedores: any[]
}

export default function CatalogManager({ productos, familias, proveedores }: Props) {
  const [searchTerm, setSearchTerm] = useState("")
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filtered = productos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.familias?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.proveedores?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.producto_proveedores?.some((pp: any) => pp.proveedores?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleEdit = (product: any) => {
    // Preparar data inicial para el form
    const latestPrice = product.precios_historicos?.sort((a: any, b: any) => 
      new Date(b.fecha_desde || b.created_at).getTime() - new Date(a.fecha_desde || a.created_at).getTime()
    )[0]

    setEditingProduct({
      ...product,
      precio_neto: latestPrice?.precio_neto || 0
    })
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative group max-w-2xl mx-auto">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <Search size={22} />
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre, familia o proveedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 rounded-[2rem] outline-none text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white shadow-xl shadow-slate-200/50 transition-all"
        />
      </div>

      {/* Grid Headers (Desktop) */}
      <div className="hidden lg:grid grid-cols-12 gap-4 px-10 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
        <div className="col-span-4">Insumo / Detalle</div>
        <div className="col-span-2">Familia</div>
        <div className="col-span-2">Proveedor</div>
        <div className="col-span-1 text-center">Rinde</div>
        <div className="col-span-1 text-center">U. Base</div>
        <div className="col-span-2 text-right">Costo Neto Escandallo</div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const latestPrice = p.precios_historicos && p.precios_historicos.length > 0
            ? p.precios_historicos.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
            : null

          return (
            <div key={p.id} className="bg-white rounded-2xl px-6 py-3 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4">
                
                {/* Product Info */}
                <div className="col-span-1 lg:col-span-4 flex items-center gap-5">
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                    <Package size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 uppercase italic leading-none truncate mb-1">{p.nombre}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                       ID: {p.id.slice(0, 8)}
                    </div>
                  </div>
                </div>

                {/* Family */}
                <div className="col-span-1 lg:col-span-2">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Tag size={12} className="text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-tighter truncate">
                      {p.familias?.nombre || '-'}
                    </span>
                  </div>
                </div>

                {/* Provider */}
                <div className="col-span-1 lg:col-span-2">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Building2 size={12} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-bold truncate" title={p.proveedores?.nombre}>
                      {p.proveedores?.nombre || '-'}
                    </span>
                    {p.producto_proveedores && p.producto_proveedores.filter((pp: any) => pp.proveedor_id !== p.proveedor_id).length > 0 && (
                      <span 
                        className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0 cursor-help"
                        title={`Proveedores adicionales:\n${p.producto_proveedores.filter((pp: any) => pp.proveedor_id !== p.proveedor_id).map((pp: any) => pp.proveedores?.nombre || pp.proveedor_id).join('\n')}`}
                      >
                        +{p.producto_proveedores.filter((pp: any) => pp.proveedor_id !== p.proveedor_id).length} otros
                      </span>
                    )}
                  </div>
                </div>

                {/* Rinde */}
                <div className="col-span-1 lg:col-span-1 text-center">
                  <div className="inline-flex px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold italic border border-rose-100">
                    {(p.factor_merma * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Base Unit */}
                <div className="col-span-1 lg:col-span-1 text-center">
                   <div className="text-xs font-bold text-slate-400">
                    1 {p.unidad_medida}
                   </div>
                </div>

                {/* Cost & Actions */}
                <div className="col-span-1 lg:col-span-2 flex items-center justify-end gap-6">
                  {latestPrice ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">Costo Neto</span>
                      <div className="text-lg font-bold text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors">
                        {formatMoneyAR(latestPrice.costo_unitario_base || latestPrice.costo_unidad_base)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-300 italic">Sin precio</span>
                  )}
                  
                  <button 
                    onClick={() => handleEdit(p)}
                    className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                    title="Editar Insumo"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>

              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <Info size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm italic">
              No hay insumos que coincidan con la búsqueda.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative border border-slate-100">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl">
                       <Edit3 size={20} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 uppercase italic tracking-tighter">Editar Insumo Maestro</h2>
                 </div>
                 <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                 >
                    <X size={24} />
                 </button>
              </div>
              
              <div className="overflow-y-auto p-8 custom-scrollbar">
                 <ProductForm 
                    familias={familias}
                    proveedores={proveedores}
                    initialData={editingProduct}
                    onSuccess={() => {
                       setIsModalOpen(false)
                       // Opcional: podrías disparar un refresh aquí, pero revalidatePath ya debería encargarse
                       window.location.reload() 
                    }}
                    onCancel={() => setIsModalOpen(false)}
                 />
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
