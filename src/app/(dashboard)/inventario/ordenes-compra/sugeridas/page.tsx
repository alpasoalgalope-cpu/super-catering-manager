"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ShoppingCart, Save, ArrowLeft, Trash2, Loader2, Package } from "lucide-react"

export default function DraftOrdersPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem("po_drafts")
    if (saved) {
      setDrafts(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  const handleItemChange = (draftIdx: number, itemIdx: number, field: string, value: any) => {
    const newDrafts = [...drafts]
    const item = newDrafts[draftIdx].items[itemIdx]
    
    item[field] = value

    const totalQty = (Number(item.bultos) || 0) * (Number(item.unidadesPorBulto) || 0)

    if (field === 'bultos' || field === 'unidadesPorBulto') {
      item.costoTotal = Number((item.costoUnitario * totalQty).toFixed(2))
    } 
    else if (field === 'costoTotal') {
      item.costoUnitario = totalQty > 0 ? Number((Number(value) / totalQty).toFixed(4)) : 0
    } 
    else if (field === 'costoUnitario') {
      item.costoTotal = Number((Number(value) * totalQty).toFixed(2))
    }

    setDrafts(newDrafts)
  }

  const handleRemoveItem = (draftIdx: number, itemIdx: number) => {
    const newDrafts = [...drafts]
    newDrafts[draftIdx].items.splice(itemIdx, 1)
    
    // If the draft has no more items, remove the draft completely
    if (newDrafts[draftIdx].items.length === 0) {
      newDrafts.splice(draftIdx, 1)
    }
    setDrafts(newDrafts)
  }

  const handleRemoveDraft = (draftIdx: number) => {
    const newDrafts = [...drafts]
    newDrafts.splice(draftIdx, 1)
    setDrafts(newDrafts)
  }

  const handleSaveAll = async () => {
    if (drafts.length === 0) return
    if (!confirm("¿Confirmar y crear todas estas Órdenes de Compra?")) return

    setSaving(true)
    try {
      for (const draft of drafts) {
        if (draft.items.length === 0) continue

        const totalCosto = draft.items.reduce((acc: number, curr: any) => acc + (Number(curr.costoTotal) || 0), 0)

        // 1. Create PO
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .insert({
            proveedor_id: draft.proveedor_id,
            fecha_esperada: draft.fecha_esperada,
            estado: 'PENDIENTE',
            costo_total: totalCosto
          })
          .select("id")
          .single()

        if (poErr) throw poErr

        // 2. Prepare items
        const poItems = draft.items.map((item: any) => {
          const totalQty = Number(item.bultos) * Number(item.unidadesPorBulto)
          const unitCost = totalQty > 0 ? Number(item.costoTotal) / totalQty : 0
          return {
            po_id: po.id,
            producto_id: item.producto_id,
            cantidad: totalQty,
            costo_unitario: unitCost
          }
        })

        // 3. Insert items
        const { error: itemsErr } = await supabase
          .from("purchase_order_items")
          .insert(poItems)

        if (itemsErr) throw itemsErr
      }

      localStorage.removeItem("po_drafts")
      alert("¡Órdenes de Compra generadas exitosamente!")
      router.push("/inventario/ordenes-compra")

    } catch (err: any) {
      console.error(err)
      alert("Error al guardar: " + err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>
  }

  if (drafts.length === 0) {
    return (
      <div className="p-10 text-center max-w-xl mx-auto space-y-6">
        <Package size={64} className="mx-auto text-slate-300" />
        <h2 className="text-2xl font-black text-slate-800">No hay borradores</h2>
        <p className="text-slate-500">No tienes ninguna orden sugerida pendiente de revisión.</p>
        <button 
          onClick={() => router.push("/inventario/proyeccion")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
        >
          Volver a Proyección
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
         <div>
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm font-bold uppercase tracking-widest mb-4 transition-colors"
            >
              <ArrowLeft size={16} /> Volver
            </button>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Revisión de Órdenes Sugeridas</h1>
            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest italic">
              Verificá y ajustá cantidades antes de crear las órdenes
            </p>
         </div>
         <button 
          onClick={handleSaveAll}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95"
         >
           {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
           Guardar {drafts.length} Órdenes
         </button>
      </div>

      {/* List of Drafts */}
      <div className="space-y-10">
        {drafts.map((draft, dIdx) => (
          <div key={dIdx} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
            
            <button 
              onClick={() => handleRemoveDraft(dIdx)}
              className="absolute top-6 right-6 p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="Descartar Orden Completa"
            >
              <Trash2 size={20} />
            </button>

            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-2">
                <ShoppingCart className="text-indigo-500" size={24} /> 
                {draft.proveedor_nombre}
              </h3>
              <div className="flex items-center gap-4 mt-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Esperada</label>
                  <input
                    type="date"
                    value={draft.fecha_esperada}
                    onChange={(e) => {
                      const newDrafts = [...drafts]
                      newDrafts[dIdx].fecha_esperada = e.target.value
                      setDrafts(newDrafts)
                    }}
                    className="bg-white border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 space-y-4">
              {draft.items.map((item: any, iIdx: number) => (
                <div key={item.producto_id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-100 transition-colors">
                  
                  <div className="flex-1 w-full">
                    <h4 className="text-sm font-black text-slate-900 uppercase">{item.nombre}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidad: {item.unidad_medida}</p>
                  </div>
                  
                  <div className="w-24 shrink-0">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bultos</label>
                    <input
                      type="number" min="0.1" step="0.1"
                      value={item.bultos || ''}
                      onChange={(e) => handleItemChange(dIdx, iIdx, 'bultos', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="w-24 shrink-0">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unid/Bulto</label>
                    <input
                      type="number" min="1" step="1"
                      value={item.unidadesPorBulto || ''}
                      onChange={(e) => handleItemChange(dIdx, iIdx, 'unidadesPorBulto', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="w-28 shrink-0">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Unit.</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number" min="0" step="0.0001"
                        value={item.costoUnitario === 0 ? '' : item.costoUnitario}
                        onChange={(e) => handleItemChange(dIdx, iIdx, 'costoUnitario', e.target.value)}
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Opc"
                      />
                    </div>
                  </div>

                  <div className="w-32 shrink-0">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Total</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.costoTotal === 0 ? '' : item.costoTotal}
                        onChange={(e) => handleItemChange(dIdx, iIdx, 'costoTotal', e.target.value)}
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Opc"
                      />
                    </div>
                  </div>

                  <div className="pt-4 md:pt-0">
                    <button 
                      onClick={() => handleRemoveItem(dIdx, iIdx)}
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Eliminar Insumo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                </div>
              ))}
            </div>

          </div>
        ))}
      </div>
    </div>
  )
}
