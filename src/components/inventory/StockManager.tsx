"use client"

import React, { useState } from "react"
import { Search, Loader2, Save, Boxes, CheckCircle2 } from "lucide-react"
import { updateProductStockAction } from "@/app/actions/inventory"

interface StockProduct {
  id: string
  nombre: string
  unidad_medida: string
  stock_actual: number
  stock_anterior: number
  familias: { nombre: string }
}

interface StockManagerProps {
  initialProducts: StockProduct[]
}

export default function StockManager({ initialProducts }: StockManagerProps) {
  const [products, setProducts] = useState<StockProduct[]>(initialProducts)
  const [deltas, setDeltas] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase()
    return p.nombre.toLowerCase().includes(term) || (p.familias?.nombre || '').toLowerCase().includes(term)
  })

  // Agrupar por familias para una vista ordenada
  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const family = product.familias?.nombre || "Sin Familia"
    if (!acc[family]) acc[family] = []
    acc[family].push(product)
    return acc
  }, {} as Record<string, StockProduct[]>)

  const handleStockChange = (id: string, field: 'stock_actual', value: string) => {
    const numValue = value === "" ? 0 : Number(value)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: numValue } : p))
  }

  const handleDeltaChange = (id: string, value: string) => {
    setDeltas(prev => ({ ...prev, [id]: value }))
  }

  const saveStock = async (product: StockProduct) => {
    setSavingId(product.id)
    const delta = Number(deltas[product.id]) || 0
    const finalStock = product.stock_actual + delta
    
    // El stock_minimo lo mantenemos como 0 o lo quitamos del action si es posible.
    // Usaremos el valor actual para no pisarlo si existe en DB, aunque el usuario no lo vea aquí.
    const result = await updateProductStockAction(product.id, finalStock, 0)
    
    setSavingId(null)
    if (result.success) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock_actual: finalStock, stock_anterior: product.stock_actual } : p))
      setDeltas(prev => ({ ...prev, [product.id]: "" }))
      setSavedId(product.id)
      setTimeout(() => setSavedId(null), 2000)
    } else {
      alert("Error al guardar: " + result.error)
    }
  }

  const saveAll = async () => {
    setSavingId('all')
    let hasError = false
    for (const p of products) {
       const delta = Number(deltas[p.id]) || 0
       if (delta === 0 && p.stock_actual === initialProducts.find(ip => ip.id === p.id)?.stock_actual) continue
       
       const finalStock = p.stock_actual + delta
       const res = await updateProductStockAction(p.id, finalStock, 0)
       if (!res.success) hasError = true
       else {
         setProducts(prev => prev.map(item => item.id === p.id ? { ...item, stock_actual: finalStock, stock_anterior: p.stock_actual } : item))
         setDeltas(prev => ({ ...prev, [p.id]: "" }))
       }
    }
    setSavingId(null)
    if (!hasError) {
      setSavedId('all')
      setTimeout(() => setSavedId(null), 2000)
    } else {
      alert("Hubo un error al guardar algunos productos.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre o familia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
          />
        </div>
        <button 
          onClick={saveAll}
          disabled={savingId === 'all'}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-md shadow-indigo-100 disabled:opacity-70 shrink-0"
        >
          {savingId === 'all' ? <Loader2 size={18} className="animate-spin" /> : savedId === 'all' ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {savedId === 'all' ? 'Guardado Exitoso' : 'Guardar Todo'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest">
                <th className="p-4 pl-6">Insumo / Familia</th>
                <th className="p-4">Unidad</th>
                <th className="p-4 w-32 text-center text-emerald-600">Ingresar (+)</th>
                <th className="p-4 w-32 text-center text-slate-300">Stock Ant.</th>
                <th className="p-4 w-32">Stock Actual</th>
                <th className="p-4 w-24 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(groupedProducts).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-bold italic">No se encontraron productos.</td>
                </tr>
              ) : (
                Object.entries(groupedProducts).map(([family, prods]) => (
                  <React.Fragment key={family}>
                    <tr className="bg-slate-50/50">
                      <td colSpan={5} className="p-3 pl-6 text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50/30 border-y border-indigo-100/50">
                        {family}
                      </td>
                    </tr>
                    {prods.map(product => {
                      return (
                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4 pl-6">
                            <p className="font-bold text-slate-900">{product.nombre}</p>
                          </td>
                          <td className="p-4">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                              {product.unidad_medida}
                            </span>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={deltas[product.id] || ""}
                              onChange={(e) => handleDeltaChange(product.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="w-full bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-sm font-bold text-emerald-700 text-center focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="+ 0"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-bold text-slate-400 tabular-nums">
                              {product.stock_anterior || 0}
                            </span>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={product.stock_actual || ""}
                              onChange={(e) => handleStockChange(product.id, 'stock_actual', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="w-full border bg-slate-50 border-slate-200 text-slate-900 rounded-lg p-2 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => saveStock(product)}
                              disabled={savingId === product.id}
                              className={`p-2 rounded-lg transition-colors ${
                                savedId === product.id 
                                  ? "bg-emerald-100 text-emerald-600" 
                                  : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              }`}
                              title="Guardar fila"
                            >
                              {savingId === product.id ? <Loader2 size={18} className="animate-spin" /> : savedId === product.id ? <CheckCircle2 size={18} /> : <Save size={18} />}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
