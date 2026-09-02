"use client"

import React, { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { X, Plus, Trash2, Loader2, Save } from "lucide-react"

interface CreatePOModalProps {
  editOrderId?: string | null
  onClose: () => void
  onSuccess: () => void
}

export default function CreatePOModal({ editOrderId, onClose, onSuccess }: CreatePOModalProps) {
  const [proveedores, setProveedores] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form State
  const [proveedorId, setProveedorId] = useState("")
  const [fechaEsperada, setFechaEsperada] = useState("")
  const [items, setItems] = useState<{ producto_id: string, bultos: number, unidadesPorBulto: number, costoTotal: number, costoUnitario: number }[]>([])

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [{ data: provs }, { data: prods }] = await Promise.all([
        supabase.from("proveedores").select("id, nombre").order("nombre"),
        supabase.from("productos").select("id, nombre, unidad_medida, proveedor_id, gramos_por_unidad, producto_proveedores(proveedor_id)").order("nombre")
      ])
      
      if (provs) setProveedores(provs)
      if (prods) setProductos(prods)
      
      if (editOrderId) {
        const { data: po } = await supabase
          .from("purchase_orders")
          .select("*, purchase_order_items(*)")
          .eq("id", editOrderId)
          .single()

        if (po) {
          setProveedorId(po.proveedor_id)
          setFechaEsperada(po.fecha_esperada)
          
          const loadedItems = po.purchase_order_items.map((item: any) => {
            const prod = (prods || []).find((p: any) => p.id === item.producto_id)
            const unitsPerPkg = prod?.gramos_por_unidad || 1
            return {
              producto_id: item.producto_id,
              bultos: Number(item.cantidad) / unitsPerPkg,
              unidadesPorBulto: unitsPerPkg,
              costoUnitario: Number(item.costo_unitario),
              costoTotal: Number(item.cantidad) * Number(item.costo_unitario)
            }
          })
          setItems(loadedItems)
        }
      } else {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setFechaEsperada(tomorrow.toISOString().split('T')[0])
      }
      
      setLoading(false)
    }
    fetchData()
  }, [editOrderId])

  const availableProducts = proveedorId 
    ? productos.filter(p => 
        p.proveedor_id === proveedorId || 
        (p.producto_proveedores && p.producto_proveedores.some((pp: any) => pp.proveedor_id === proveedorId))
      ) 
    : productos

  const handleAddItem = () => {
    setItems([...items, { producto_id: "", bultos: 1, unidadesPorBulto: 1, costoTotal: 0, costoUnitario: 0 }])
  }

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const handleItemChange = (idx: number, field: string, value: any) => {
    const newItems = [...items]
    const item = newItems[idx]
    
    // Asignar el nuevo valor
    item[field as keyof typeof item] = value as never

    // Si se selecciona un producto, traer unidades_por_bulto automáticamente
    if (field === 'producto_id') {
      if (value) {
        const selectedProd = productos.find(p => p.id === value)
        if (selectedProd) {
          item.unidadesPorBulto = selectedProd.gramos_por_unidad || 1
          item.bultos = 1
        }
      } else {
        item.unidadesPorBulto = 1
        item.bultos = 1
      }
    }

    // Lógica de cálculo automático
    const totalQty = (Number(item.bultos) || 0) * (Number(item.unidadesPorBulto) || 0)

    if (field === 'bultos' || field === 'unidadesPorBulto' || field === 'producto_id') {
      // Si cambia la cantidad (o el producto, que actualizó las unidades), recalcular el costo total basado en el costo unitario existente
      item.costoTotal = Number((item.costoUnitario * totalQty).toFixed(2))
    } 
    else if (field === 'costoTotal') {
      // Si cambia el costo total, recalcular el costo unitario
      item.costoUnitario = totalQty > 0 ? Number((Number(value) / totalQty).toFixed(4)) : 0
    } 
    else if (field === 'costoUnitario') {
      // Si cambia el costo unitario, recalcular el costo total
      item.costoTotal = Number((Number(value) * totalQty).toFixed(2))
    }

    setItems(newItems)
  }

  const totalCosto = items.reduce((acc, curr) => acc + (Number(curr.costoTotal) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proveedorId || !fechaEsperada || items.length === 0) {
      alert("Por favor complete todos los campos y agregue al menos un insumo.")
      return
    }

    if (items.some(i => !i.producto_id || i.bultos <= 0 || i.unidadesPorBulto <= 0)) {
      alert("Todos los insumos deben tener un producto seleccionado y cantidades mayores a cero.")
      return
    }

    setSaving(true)

    try {
      let poId = editOrderId

      if (editOrderId) {
        // Update existing PO
        const { error: poErr } = await supabase
          .from("purchase_orders")
          .update({
            proveedor_id: proveedorId,
            fecha_esperada: fechaEsperada,
            costo_total: totalCosto
          })
          .eq("id", editOrderId)

        if (poErr) throw poErr

        // Delete old items
        const { error: delErr } = await supabase
          .from("purchase_order_items")
          .delete()
          .eq("po_id", editOrderId)
          
        if (delErr) throw delErr
      } else {
        // Insert new PO
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .insert({
            proveedor_id: proveedorId,
            fecha_esperada: fechaEsperada,
            estado: 'PENDIENTE',
            costo_total: totalCosto
          })
          .select('id')
          .single()

        if (poErr) throw poErr
        poId = po.id
      }

      // Insert Items (shared for both create and update)
      const itemsToInsert = items.map(item => {
        const totalQty = Number(item.bultos) * Number(item.unidadesPorBulto)
        const unitCost = totalQty > 0 ? Number(item.costoTotal) / totalQty : 0
        return {
          po_id: poId,
          producto_id: item.producto_id,
          cantidad: totalQty,
          costo_unitario: unitCost
        }
      })

      const { error: itemsErr } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert)

      if (itemsErr) throw itemsErr

      alert(`Orden de compra ${editOrderId ? 'actualizada' : 'creada'} exitosamente.`)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      alert("Error al guardar la orden de compra: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
              {editOrderId ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {editOrderId ? 'Modificación de stock en tránsito' : 'Ingreso de stock en tránsito'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            
            {/* Cabecera de OC */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proveedor</label>
                <select 
                  value={proveedorId}
                  onChange={(e) => {
                    setProveedorId(e.target.value)
                    // Clear items if provider changes to avoid invalid products
                    setItems([])
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Seleccione un proveedor...</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fecha Esperada de Recepción</label>
                <input 
                  type="date"
                  value={fechaEsperada}
                  onChange={(e) => setFechaEsperada(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Ítems */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Insumos a Pedir</h3>
                <button 
                  type="button"
                  onClick={handleAddItem}
                  className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={14} /> Agregar Fila
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay insumos agregados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex-1 w-full md:w-auto">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Producto</label>
                        <select
                          value={item.producto_id}
                          onChange={(e) => handleItemChange(idx, 'producto_id', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        >
                          <option value="">Seleccionar insumo...</option>
                          {availableProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="w-24 shrink-0">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bultos</label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={item.bultos || ''}
                          onChange={(e) => handleItemChange(idx, 'bultos', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="w-24 shrink-0">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unid/Bulto</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.unidadesPorBulto || ''}
                          onChange={(e) => handleItemChange(idx, 'unidadesPorBulto', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Unit.</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={item.costoUnitario === 0 ? '' : item.costoUnitario}
                            onChange={(e) => handleItemChange(idx, 'costoUnitario', e.target.value)}
                            className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Opcional"
                          />
                        </div>
                      </div>

                      <div className="w-32 shrink-0">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Total</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.costoTotal === 0 ? '' : item.costoTotal}
                            onChange={(e) => handleItemChange(idx, 'costoTotal', e.target.value)}
                            className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Opcional"
                          />
                        </div>
                      </div>

                      <div className="pt-5">
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-right px-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Costo Estimado Total</p>
                    <p className="text-2xl font-black text-slate-800 tabular-nums">
                      $ {totalCosto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
              <button 
                type="button" 
                onClick={onClose}
                className="px-6 py-3 font-black text-slate-500 uppercase text-xs tracking-widest hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={saving || items.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Confirmar Orden
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
