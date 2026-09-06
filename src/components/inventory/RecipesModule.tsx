"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { Search, ChefHat, Plus, Layers, Package, Trash2, Edit3, X, Calculator, Save, AlertCircle, ChevronRight, Info, Copy, Loader2, ChevronDown, ArrowLeft, ShoppingCart, TrendingUp, BarChart3, LayoutGrid, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { RubroComida, Receta, Producto } from "@/types/inventory"
import { 
  deleteRecetaAction 
} from "@/app/actions/inventory"
import { 
  saveFullRecetaAction,
  updateFullRecetaAction,
  duplicateRecipeAction
} from "@/app/actions/recipes"
import { normalizeCurrencyInput, formatCurrencyAR, formatMoneyAR } from "@/lib/currency"

interface Props {
  initialRubros: RubroComida[]
  initialRecetas: Receta[]
  productos: Producto[]
}

interface PendingIngredient {
  tempId: string
  producto_id: string
  nombre: string
  cantidad: number
  unidad: string
  costoUnitario: number
}

export default function RecipesModule({ initialRubros, initialRecetas, productos }: Props) {
  const [rubros] = useState(initialRubros)
  const [recetas, setRecetas] = useState(initialRecetas)
  
  // Recipe Admin State
  const [selectedRecetaId, setSelectedRecetaId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddReceta, setShowAddReceta] = useState(false)
  const [newReceta, setNewReceta] = useState({ nombre: "", rubro_id: "", es_prod: false, precio: 0 })
  
  // Builder State
  const [isBuilderMode, setIsBuilderMode] = useState(false)
  const [builderData, setBuilderData] = useState({
    id: null as string | null,
    nombre: "",
    rubro_id: "",
    es_prod: false,
    precio: 0
  })
  const [pendingIngredients, setPendingIngredients] = useState<PendingIngredient[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  // Product Selection Helper
  const [activeProductSearch, setActiveProductSearch] = useState<string | null>(null) // row tempId
  const [searchQuery, setSearchQuery] = useState("")

  const selectedReceta = useMemo(() => 
    recetas.find(r => r.id === selectedRecetaId), 
    [recetas, selectedRecetaId]
  )

  const filteredRecetas = recetas.filter(r => 
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Cost Calculation for View Mode
  const totalCost = useMemo(() => {
    if (!selectedReceta?.receta_insumos) return 0
    return selectedReceta.receta_insumos.reduce((acc, insumo) => {
      const prod = productos.find(p => p.id === insumo.producto_id)
      const latestPrice = prod?.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha || 0).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha || 0).getTime())[0]
      const costPerBase = latestPrice?.costo_unidad_base || 0
      return acc + (insumo.cantidad_necesaria * costPerBase)
    }, 0)
  }, [selectedReceta, productos])

  // --- ACTIONS ---

  const openBuilderForNew = () => {
    setBuilderData({ id: null, nombre: "", rubro_id: "", es_prod: false, precio: 0 })
    setPendingIngredients([{ tempId: Math.random().toString(), producto_id: "", nombre: "", cantidad: 0, unidad: "-", costoUnitario: 0 }])
    setIsBuilderMode(true)
    setShowAddReceta(false)
  }

  const openBuilderForEdit = (receta: Receta) => {
    setBuilderData({
      id: receta.id,
      nombre: receta.nombre,
      rubro_id: receta.rubro_id || "",
      es_prod: receta.es_producto_final,
      precio: receta.precio_venta_sugerido
    })
    
    const existing = (receta.receta_insumos || []).map(i => {
      const prod = productos.find(p => p.id === i.producto_id)
      const latestPrice = prod?.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha || 0).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha || 0).getTime())[0]
      return {
        tempId: i.id,
        producto_id: i.producto_id,
        nombre: prod?.nombre || "Desconocido",
        cantidad: i.cantidad_necesaria,
        unidad: prod?.unidad_medida || "-",
        costoUnitario: latestPrice?.costo_unidad_base || 0
      }
    })
    
    setPendingIngredients(existing.length > 0 ? existing : [{ tempId: Math.random().toString(), producto_id: "", nombre: "", cantidad: 0, unidad: "-", costoUnitario: 0 }])
    setIsBuilderMode(true)
  }

  const handleDuplicate = async (recipeId: string) => {
    if (!confirm("¿Deseas duplicar esta receta?")) return
    setIsDuplicating(true)
    const result = await duplicateRecipeAction(recipeId)
    setIsDuplicating(false)

    if (result.success && result.data) {
      // Forzar la apertura del builder con los datos clonados
      // Aseguramos que los insumos estén mapeados correctamente
      const mappedInsumos = result.data.receta_insumos.map((i: any) => {
        const prod = productos.find(p => p.id === i.producto_id)
        const latestPrice = prod?.precios_historicos?.sort((a: any, b: any) => 
          new Date(b.fecha_desde || b.created_at || b.fecha).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha).getTime()
        )[0]
        return {
          tempId: Math.random().toString(),
          producto_id: i.producto_id,
          nombre: prod?.nombre || "Producto Desconocido",
          cantidad: i.cantidad_necesaria,
          unidad: prod?.unidad_medida || "-",
          costoUnitario: latestPrice?.costo_unidad_base || 0
        }
      })

      setBuilderData({
        id: result.data.id,
        nombre: result.data.nombre,
        rubro_id: result.data.rubro_id,
        es_prod: result.data.es_producto_final,
        precio: result.data.precio_venta_sugerido
      })
      setPendingIngredients(mappedInsumos)
      setIsBuilderMode(true)
      setSelectedRecetaId(result.data.id)
    } else {
      alert("Error al duplicar: " + result.error)
    }
  }

  const handleAddRow = () => {
    setPendingIngredients(prev => [
      ...prev, 
      { tempId: Math.random().toString(), producto_id: "", nombre: "", cantidad: 0, unidad: "-", costoUnitario: 0 }
    ])
  }

  const handleRemoveRow = (tempId: string) => {
    setPendingIngredients(prev => prev.filter(p => p.tempId !== tempId))
  }

  const updateRow = (tempId: string, data: Partial<PendingIngredient>) => {
    setPendingIngredients(prev => prev.map(p => p.tempId === tempId ? { ...p, ...data } : p))
  }

  const handleSelectProduct = (tempId: string, prod: Producto) => {
    const latestPrice = prod.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha || 0).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha || 0).getTime())[0]
    updateRow(tempId, {
      producto_id: prod.id,
      nombre: prod.nombre,
      unidad: prod.unidad_medida,
      costoUnitario: latestPrice?.costo_unidad_base || 0
    })
    setActiveProductSearch(null)
    setSearchQuery("")
  }

  const builderTotalCost = useMemo(() => {
    return pendingIngredients.reduce((acc, curr) => {
      const cant = Number(curr.cantidad) || 0
      const cost = Number(curr.costoUnitario) || 0
      return acc + (cant * cost)
    }, 0)
  }, [pendingIngredients])

  const handleAtomicSave = async () => {
    if (!builderData.nombre) {
        alert("La receta debe tener un nombre")
        return
    }
    
    const validIngredients = pendingIngredients.filter(p => p.producto_id && p.cantidad > 0)
    
    setIsSaving(true)
    
    let res
    if (builderData.id) {
        res = await updateFullRecetaAction(
            builderData.id,
            {
                nombre: builderData.nombre,
                rubro_id: builderData.rubro_id,
                es_producto_final: builderData.es_prod,
                precio_venta_sugerido: builderData.precio
            },
            validIngredients.map(i => ({
                producto_id: i.producto_id,
                cantidad_necesaria: i.cantidad
            }))
        )
    } else {
        res = await saveFullRecetaAction(
            {
                nombre: builderData.nombre,
                rubro_id: builderData.rubro_id,
                es_producto_final: builderData.es_prod,
                precio_venta_sugerido: builderData.precio
            },
            validIngredients.map(i => ({
                producto_id: i.producto_id,
                cantidad_necesaria: i.cantidad
            }))
        )
    }

    if (res.success) {
      window.location.reload()
    } else {
      alert("Error al guardar: " + res.error)
      setIsSaving(false)
    }
  }

  const handleDeleteReceta = async (id: string) => {
    if (!confirm("¿Seguro que desea eliminar esta receta?")) return
    const res = await deleteRecetaAction(id)
    if (res.success) {
      setRecetas(prev => prev.filter(r => r.id !== id))
      if (selectedRecetaId === id) setSelectedRecetaId(null)
    }
  }

  const getRecipeTotalCost = (receta: Receta) => {
    if (!receta.receta_insumos) return 0
    return receta.receta_insumos.reduce((acc, insumo) => {
      const prod = productos.find(p => p.id === insumo.producto_id)
      const latestPrice = prod?.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha).getTime())[0]
      const costPerBase = latestPrice?.costo_unidad_base || 0
      return acc + (insumo.cantidad_necesaria * costPerBase)
    }, 0)
  }

  const handleDownloadSingleExcel = (receta: Receta) => {
    try {
      const cost = getRecipeTotalCost(receta)
      const profitability = cost > 0 ? (((receta.precio_venta_sugerido / cost) - 1) * 100).toFixed(0) + "%" : "0%"
      
      const rows = [
        ["FICHA TÉCNICA DE PRODUCCIÓN"],
        [],
        ["Receta:", receta.nombre],
        ["Rubro:", receta.rubros_comida?.nombre || 'Sin Rubro'],
        ["Precio de Venta Sugerido:", formatMoneyAR(receta.precio_venta_sugerido)],
        ["Costo Unitario Base:", formatMoneyAR(cost)],
        ["Rentabilidad Sugerida:", profitability],
        [],
        ["DESGLOSE DE INSUMOS"],
        ["Insumo / Producto", "Unidad", "Cantidad Neta", "Costo Unitario Base", "Costo Parcial"],
      ]
      
      if (receta.receta_insumos && receta.receta_insumos.length > 0) {
        receta.receta_insumos.forEach(insumo => {
          const prod = productos.find(p => p.id === insumo.producto_id)
          const latestPrice = prod?.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha).getTime())[0]
          const uCost = latestPrice?.costo_unidad_base || 0
          const partialCost = insumo.cantidad_necesaria * uCost
          
          rows.push([
            prod?.nombre || "Desconocido",
            prod?.unidad_medida || "-",
            insumo.cantidad_necesaria.toString(),
            formatMoneyAR(uCost),
            formatMoneyAR(partialCost)
          ])
        })
      } else {
        rows.push(["No hay ingredientes cargados en esta receta", "", "", "", ""])
      }
      
      rows.push([])
      rows.push(["TOTAL COSTO", "", "", "", formatMoneyAR(cost)])

      const ws = XLSX.utils.aoa_to_sheet(rows)
      
      ws["!cols"] = [
        { wch: 35 },
        { wch: 10 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 }
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Ficha Técnica")
      XLSX.writeFile(wb, `Ficha_Tecnica_${receta.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`)
    } catch (err) {
      console.error("Error al exportar receta:", err)
      alert("Error al exportar la receta a Excel.")
    }
  }

  const handleDownloadAllExcel = () => {
    try {
      const wb = XLSX.utils.book_new()
      
      // --- SHEET 1: RESUMEN GENERAL ---
      const resumenRows = [
        ["RESUMEN DE RECETAS - ESCANDALLO MASTER"],
        [],
        ["Receta", "Rubro", "Costo Unitario Base", "Precio Venta Sugerido", "Rentabilidad Sugerida"]
      ]
      
      recetas.forEach(receta => {
        const cost = getRecipeTotalCost(receta)
        const profitability = cost > 0 ? (((receta.precio_venta_sugerido / cost) - 1) * 100).toFixed(0) + "%" : "0%"
        resumenRows.push([
          receta.nombre,
          receta.rubros_comida?.nombre || 'Sin Rubro',
          formatMoneyAR(cost),
          formatMoneyAR(receta.precio_venta_sugerido),
          profitability
        ])
      })
      
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
      wsResumen["!cols"] = [
        { wch: 35 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General")

      // --- SHEET 2: DETALLE DE FICHAS ---
      const detalleRows: any[][] = [
        ["DESGLOSE DETALLADO DE TODAS LAS FICHAS TÉCNICAS"],
        []
      ]

      recetas.forEach((receta, index) => {
        const cost = getRecipeTotalCost(receta)
        const profitability = cost > 0 ? (((receta.precio_venta_sugerido / cost) - 1) * 100).toFixed(0) + "%" : "0%"
        
        if (index > 0) {
          detalleRows.push([], [], [])
        }
        
        detalleRows.push(
          [`FICHA TÉCNICA: ${receta.nombre.toUpperCase()}`],
          ["Rubro:", receta.rubros_comida?.nombre || 'Sin Rubro'],
          ["Precio de Venta Sugerido:", formatMoneyAR(receta.precio_venta_sugerido)],
          ["Costo Unitario Base:", formatMoneyAR(cost)],
          ["Rentabilidad Sugerida:", profitability],
          [],
          ["Insumo / Producto", "Unidad", "Cantidad Neta", "Costo Unitario Base", "Costo Parcial"]
        )

        if (receta.receta_insumos && receta.receta_insumos.length > 0) {
          receta.receta_insumos.forEach(insumo => {
            const prod = productos.find(p => p.id === insumo.producto_id)
            const latestPrice = prod?.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha).getTime())[0]
            const uCost = latestPrice?.costo_unidad_base || 0
            const partialCost = insumo.cantidad_necesaria * uCost
            
            detalleRows.push([
              prod?.nombre || "Desconocido",
              prod?.unidad_medida || "-",
              insumo.cantidad_necesaria.toString(),
              formatMoneyAR(uCost),
              formatMoneyAR(partialCost)
            ])
          })
        } else {
          detalleRows.push(["No hay ingredientes cargados en esta receta", "", "", "", ""])
        }
        
        detalleRows.push(["TOTAL COSTO", "", "", "", formatMoneyAR(cost)])
      })

      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows)
      wsDetalle["!cols"] = [
        { wch: 35 },
        { wch: 10 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, wsDetalle, "Fichas Técnicas")

      XLSX.writeFile(wb, `Recetario_Master_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err) {
      console.error("Error al exportar todo:", err)
      alert("Error al exportar el recetario a Excel.")
    }
  }

  // --- VIEWS ---

  if (isBuilderMode) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col animate-in fade-in duration-300">
        <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 md:px-12 shadow-sm z-10">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsBuilderMode(false)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 hover:text-slate-900 transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900 uppercase italic tracking-tight">
                {builderData.id ? 'Editar Escandallo' : 'Nuevo Escandallo Técnico'}
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ficha de Producción en Vivo</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <button 
                onClick={handleAtomicSave}
                disabled={isSaving}
                className="bg-indigo-600 text-white h-12 px-8 rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-3 disabled:opacity-50 active:scale-95"
             >
                {isSaving ? <Calculator className="animate-spin" size={16} /> : <Save size={16} />}
                {builderData.id ? 'Actualizar Ficha' : 'Guardar Ficha Master'}
             </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-2 md:p-3 gap-2 overflow-hidden">
           
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col lg:flex-row items-center gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                 <div className="md:col-span-1.5 space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre de la Receta</label>
                    <input 
                       value={builderData.nombre}
                       onChange={e => setBuilderData({...builderData, nombre: e.target.value})}
                       placeholder="Ej: Salsa Fileto..."
                       className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-900 font-bold uppercase italic text-xs outline-none focus:bg-white focus:border-indigo-500 transition-all"
                    />
                 </div>
                 <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rubro</label>
                    <div className="relative">
                       <select 
                          value={builderData.rubro_id}
                          onChange={e => setBuilderData({...builderData, rubro_id: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-700 font-bold uppercase text-[9px] outline-none appearance-none cursor-pointer focus:bg-white focus:border-indigo-500 transition-all"
                       >
                          <option value="">Sin Clasificar</option>
                          {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                       </select>
                       <ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                 </div>
                 <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Precio Venta</label>
                    <div className="relative">
                       <input 
                          type="text"
                          value={builderData.precio || ""}
                          onChange={e => {
                             const val = e.target.value.replace(/[^0-9,.]/g, '')
                             setBuilderData({...builderData, precio: normalizeCurrencyInput(val)})
                          }}
                          placeholder="0,00"
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-900 font-bold text-xs outline-none focus:bg-white focus:border-indigo-500 transition-all"
                       />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">$</span>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 lg:border-l lg:border-slate-100 lg:pl-4 w-full lg:w-auto">
                 <div className="bg-indigo-50 rounded-lg px-3 py-1 flex flex-col">
                    <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Rentabilidad</span>
                    <span className="text-base font-bold text-indigo-700 italic leading-none mt-0.5">
                       {builderTotalCost > 0 ? (((builderData.precio / builderTotalCost) - 1) * 100).toFixed(0) : 0}%
                    </span>
                 </div>
                 <div className="bg-slate-900 rounded-lg px-3 py-1 flex flex-col min-w-[100px]">
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none">Costo Sug.</span>
                    <span className="text-base font-bold text-white tabular-nums leading-none mt-0.5">
                       {formatMoneyAR(builderTotalCost)}
                    </span>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                 <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                       <ShoppingCart size={14} />
                    </div>
                    <div>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700 leading-none">Mesa de Receteado</span>
                    </div>
                 </div>
                 <button 
                    onClick={handleAddRow}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[8px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                 >
                    <Plus size={10} className="text-indigo-600" /> Nuevo Renglón
                 </button>
              </div>

              <div className="flex-1 overflow-auto p-0 custom-scrollbar">
                 <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                       <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-5 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Insumo</th>
                          <th className="px-4 py-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest w-24">Unidad</th>
                          <th className="px-4 py-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest w-32">Cantidad</th>
                          <th className="px-4 py-3 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest w-32">Costo U.</th>
                          <th className="px-4 py-3 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest w-32">Subtotal</th>
                          <th className="px-5 py-3 text-center w-16"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {pendingIngredients.map((row, index) => (
                          <tr key={row.tempId} className="group hover:bg-slate-50/50 transition-colors">
                             <td className="px-5 py-2">
                                <div className="relative">
                                   <div className="flex items-center gap-2">
                                      <Search className={`transition-colors ${row.producto_id ? 'text-indigo-500' : 'text-slate-300'}`} size={12} />
                                      <input 
                                         className="flex-1 bg-transparent border-none text-[11px] font-bold uppercase italic text-slate-900 placeholder:text-slate-200 outline-none p-0 h-8"
                                         placeholder="Buscar..."
                                         value={activeProductSearch === row.tempId ? searchQuery : row.nombre}
                                         onFocus={() => {
                                           setActiveProductSearch(row.tempId)
                                           setSearchQuery(row.nombre)
                                         }}
                                         onChange={(e) => setSearchQuery(e.target.value)}
                                      />
                                   </div>
                                   
                                   {activeProductSearch === row.tempId && (
                                     <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto p-1 border-t-2 border-t-indigo-600">
                                        {productos.filter(p => p.nombre.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10).map(p => (
                                          <button 
                                            key={p.id}
                                            onClick={() => handleSelectProduct(row.tempId, p)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-left group/item"
                                          >
                                            <div className="flex flex-col">
                                               <span className="text-[10px] font-bold uppercase text-slate-700 italic">{p.nombre}</span>
                                               <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{p.proveedores?.nombre || 'Gral'}</span>
                                            </div>
                                            <ChevronRight size={10} className="text-slate-300" />
                                          </button>
                                        ))}
                                     </div>
                                   )}
                                </div>
                             </td>
                             <td className="px-4 py-2 text-center">
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[8px] font-bold uppercase text-slate-400">
                                   {row.unidad}
                                </span>
                             </td>
                             <td className="px-4 py-2">
                                <input 
                                   type="text"
                                   className="w-full bg-transparent border-b border-slate-100 focus:border-indigo-500 p-1 text-center font-bold text-xs text-slate-700 outline-none transition-all"
                                   value={row.cantidad || ""}
                                   onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9,.]/g, '')
                                      updateRow(row.tempId, { cantidad: normalizeCurrencyInput(val) })
                                   }}
                                />
                             </td>
                             <td className="px-4 py-2 text-right">
                                <span className="text-[10px] font-bold text-slate-300 tabular-nums">{formatMoneyAR(row.costoUnitario)}</span>
                             </td>
                             <td className="px-4 py-2 text-right">
                                <span className="text-xs font-bold text-slate-900 tabular-nums">
                                   {formatMoneyAR(Number(row.cantidad || 0) * Number(row.costoUnitario || 0))}
                                </span>
                             </td>
                             <td className="px-5 py-2 text-center">
                                <button 
                                   onClick={() => handleRemoveRow(row.tempId)}
                                   className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                >
                                   <Trash2 size={12} />
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 
                 <div className="p-4 flex justify-center border-t border-slate-50">
                    <button 
                       onClick={handleAddRow}
                       className="flex items-center gap-2 py-2 px-6 border border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                    >
                       <Plus size={14} className="text-slate-300 group-hover:text-indigo-600" />
                       <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-600">Añadir otro renglón</span>
                    </button>
                 </div>
              </div>

              <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                 <div className="flex gap-6">
                    <div className="flex flex-col">
                       <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400 leading-none">Items</span>
                       <span className="text-xs font-bold text-slate-700">{pendingIngredients.filter(p => p.producto_id).length}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400 leading-none">Peso/Vol</span>
                       <span className="text-xs font-bold text-slate-700">
                          {pendingIngredients.reduce((acc, curr) => acc + curr.cantidad, 0).toLocaleString()}
                       </span>
                    </div>
                    <div className="flex flex-col border-l border-slate-200 pl-6">
                       <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400 leading-none">Costo Final</span>
                       <span className="text-lg font-bold text-slate-900 italic tracking-tighter leading-none mt-0.5">
                          {formatMoneyAR(builderTotalCost)}
                       </span>
                    </div>
                 </div>
                 
                 <button 
                    onClick={handleAtomicSave}
                    disabled={isSaving}
                    className="bg-slate-900 text-white h-10 px-6 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-black shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                 >
                    {isSaving ? <Calculator className="animate-spin" size={14} /> : <Save size={14} />}
                    Finalizar Ficha
                 </button>
              </div>
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
      
      <div className="col-span-12 lg:col-span-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 uppercase italic">Recetario Master</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDownloadAllExcel}
                className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition shadow-sm active:scale-95"
                title="Descargar todas las recetas en Excel"
              >
                <Download size={20} />
              </button>
              <button 
                onClick={() => setShowAddReceta(true)}
                className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar receta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition text-xs font-bold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {filteredRecetas.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRecetaId(r.id)}
              className={`w-full group text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${selectedRecetaId === r.id ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100 scale-[1.02]' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${selectedRecetaId === r.id ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                  <Package size={16} />
                </div>
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-tight ${selectedRecetaId === r.id ? 'text-white' : 'text-slate-700'}`}>{r.nombre}</h4>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${selectedRecetaId === r.id ? 'text-indigo-200' : 'text-slate-400'}`}>{r.rubros_comida?.nombre || 'Sin Rubro'}</p>
                </div>
              </div>
              <ChevronRight size={14} className={`${selectedRecetaId === r.id ? 'text-white' : 'text-slate-200'} group-hover:translate-x-1 transition-transform`} />
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden relative">
        {!selectedReceta ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50/50">
            <ChefHat size={80} className="text-slate-200 mb-6" />
            <h3 className="text-2xl font-bold text-slate-300 uppercase tracking-tighter">Selecciona una receta</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Para comenzar con el escandallo y desglose de costos.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="p-10 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full mb-3 inline-block italic">Ficha Técnica de Producción</span>
                <h2 className="text-2xl font-bold text-slate-900 uppercase italic tracking-tight leading-none">{selectedReceta.nombre}</h2>
                <div className="flex gap-3 mt-4">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      <Layers size={14} className="text-slate-300" /> {selectedReceta.rubros_comida?.nombre || 'Sin Rubro'}
                    </div>
                    <button 
                      onClick={() => handleDuplicate(selectedReceta.id)}
                      disabled={isDuplicating}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                    >
                      {isDuplicating ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                      Duplicar Base
                    </button>
                    <button 
                      onClick={() => handleDownloadSingleExcel(selectedReceta)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                    >
                      <Download size={14} />
                      Exportar Ficha
                    </button>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                     <Package size={14} className="text-slate-300" /> Venta: {formatMoneyAR(selectedReceta.precio_venta_sugerido)}
                   </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Unitario Base</span>
                <div className="text-3xl font-bold text-slate-900 tracking-tighter italic">
                  {formatMoneyAR(totalCost)}
                </div>
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
              
              {/* Ingredients List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                        <ShoppingCart size={16} className="text-indigo-400" /> Desglose de Insumos
                    </h3>
                    <button 
                      onClick={() => openBuilderForEdit(selectedReceta)}
                      className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-lg shadow-emerald-100 active:scale-95"
                    >
                        <Calculator size={16} /> Refinar Escandallo
                    </button>
                </div>

                <div className="space-y-2">
                  {selectedReceta.receta_insumos?.map(insumo => {
                    const prod = productos.find(p => p.id === insumo.producto_id)
                    const latestPrice = prod?.precios_historicos?.sort((a,b) => new Date(b.fecha_desde || b.created_at || b.fecha).getTime() - new Date(a.fecha_desde || a.created_at || a.fecha).getTime())[0]
                    const partialCost = insumo.cantidad_necesaria * (latestPrice?.costo_unidad_base || 0)
                    
                    return (
                      <div key={insumo.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-slate-100 hover:shadow-sm transition-all group">
                         <div className="flex items-center gap-4 flex-1">
                            <div className="p-2 bg-white rounded-xl text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                               <Package size={16} />
                            </div>
                            <div className="flex-1">
                               <h5 className="text-sm font-bold text-slate-900 uppercase italic tracking-tight">{prod?.nombre}</h5>
                               <p className="text-[8px] font-bold text-slate-400 uppercase">Unidad: {prod?.unidad_medida}</p>
                            </div>
                            <div className="w-32 text-center flex flex-col">
                               <span className="text-[8px] font-bold text-slate-300 uppercase leading-none mb-1">Cant. Neta</span>
                               <div className="text-sm font-bold text-slate-700">{insumo.cantidad_necesaria} {prod?.unidad_medida}</div>
                            </div>
                            <div className="w-32 text-right pr-4 flex flex-col">
                               <span className="text-[8px] font-bold text-indigo-300 uppercase leading-none mb-1">Costo Parcial</span>
                               <div className="text-sm font-bold text-slate-900">{formatMoneyAR(partialCost)}</div>
                            </div>
                         </div>
                      </div>
                    )
                  })}

                  {(!selectedReceta.receta_insumos || selectedReceta.receta_insumos.length === 0) && (
                      <div className="py-12 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center gap-4">
                          <p className="text-sm font-bold text-slate-300 italic uppercase">No hay ingredientes cargados.</p>
                          <button onClick={() => openBuilderForEdit(selectedReceta)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-100">
                              Iniciar Escandallo
                          </button>
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detail Footer */}
            <div className="p-10 border-t border-slate-50 flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Rentabilidad Sugerida</span>
                     <span className="text-sm font-bold text-emerald-600">
                        {totalCost > 0 ? (((selectedReceta.precio_venta_sugerido / totalCost) - 1) * 100).toFixed(0) : 0}%
                     </span>
                  </div>
               </div>
               <button 
                  onClick={() => handleDeleteReceta(selectedRecetaId!)}
                  className="flex items-center gap-2 px-6 py-3 text-rose-500 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-colors"
               >
                  <Trash2 size={16} /> Eliminar Receta
               </button>
            </div>
          </div>
        )}
      </div>

      {showAddReceta && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
             <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                   <h3 className="text-xl font-bold uppercase italic tracking-tight text-slate-900">Crear Nueva Receta</h3>
                   <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Apertura de Ficha Técnica Master</p>
                </div>
                <button onClick={() => setShowAddReceta(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                   <X size={20} />
                </button>
             </div>
             <div className="p-10 space-y-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Descriptivo</label>
                   <input 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase text-sm italic text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      placeholder="Ej: Sandwich de Lomo Premium ST"
                      value={newReceta.nombre}
                      onChange={e => setNewReceta({...newReceta, nombre: e.target.value})}
                   />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rubro Principal</label>
                      <div className="relative">
                        <select 
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase text-xs italic text-slate-700 outline-none appearance-none focus:bg-white focus:border-indigo-500 transition-all"
                          value={newReceta.rubro_id}
                          onChange={e => setNewReceta({...newReceta, rubro_id: e.target.value})}
                        >
                           <option value="">-- Sin Rubro --</option>
                           {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                   </div>
                   <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Precio Venta Sugerido</label>
                       <div className="relative">
                         <input 
                           type="text"
                           className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-base text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                           placeholder="0,00"
                           value={newReceta.precio || ""}
                           onChange={e => {
                              const val = e.target.value.replace(/[^0-9,.]/g, '')
                              setNewReceta({...newReceta, precio: normalizeCurrencyInput(val)})
                           }}
                         />
                         <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">$</span>
                       </div>
                    </div>
                </div>

                <div className="pt-6 flex gap-4">
                   <button 
                      onClick={() => setShowAddReceta(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                   >
                      Cancelar
                   </button>
                   <button 
                      onClick={() => {
                        setBuilderData({ id: null, nombre: newReceta.nombre, rubro_id: newReceta.rubro_id, es_prod: false, precio: newReceta.precio })
                        setPendingIngredients([{ tempId: Math.random().toString(), producto_id: "", nombre: "", cantidad: 0, unidad: "-", costoUnitario: 0 }])
                        setIsBuilderMode(true)
                        setShowAddReceta(false)
                      }}
                      className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                   >
                      Comenzar Receteado
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  )
}

