"use client"

import React, { useState, useMemo } from "react"
import { 
  Calendar, Users, ShoppingCart, Calculator, 
  ArrowRight, CheckCircle2, AlertCircle, Loader2,
  Filter, Download, Trash2, Package, CheckSquare,
  Square, ChevronDown, ChevronUp, Shield
} from "lucide-react"
import { Receta, Producto } from "@/types/inventory"
import { supabase } from "@/lib/supabase"

interface Props {
  recetas: Receta[]
  productos: Producto[]
}

export default function ProjectionModule({ recetas, productos }: Props) {
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [isEventsExpanded, setIsEventsExpanded] = useState(true)
  const [bufferPercentage, setBufferPercentage] = useState(20)
  
  // Mapping categories to recipes
  const [mappings, setMappings] = useState({
    traditional: "",
    vegetarian: "",
    vegana: "",
    sin_tacc: ""
  })

  // Load events
  React.useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('events_master')
        .select(`
          id, show_name, event_date,
          event_sales_headers (
            id,
            event_sales_units (
              traditional, vegetarian, vegana, sin_tacc
            )
          )
        `)
        .in('status', ['confirmado', 'pendiente', 'Confirmado', 'Pendiente', 'ejecutado', 'Ejecutado'])
        .order('event_date', { ascending: true })
      
      if (data) {
        const summaries = data.map(ev => {
          let trad = 0, veg = 0, vegan = 0, st = 0
          ev.event_sales_headers?.forEach((h: any) => {
            h.event_sales_units?.forEach((u: any) => {
              trad += (u.traditional || 0)
              veg += (u.vegetarian || 0)
              vegan += (u.vegana || 0)
              st += (u.sin_tacc || 0)
            })
          })
          return { ...ev, trad, veg, vegan, st, totalPax: (trad + veg + vegan + st) }
        }).filter(e => e.totalPax > 0) // Solo eventos con carga de viandas
        setEvents(summaries)
      }
      setLoading(false)
    }
    fetchEvents()
  }, [])

  const toggleEvent = (id: string) => {
    setSelectedEventIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAll = () => setSelectedEventIds(events.map(e => e.id))
  const selectNone = () => setSelectedEventIds([])

  // --- THE CALCULATION ENGINE ---
  const projection = useMemo(() => {
    if (selectedEventIds.length === 0) return []
    
    const totalsByCategory = { traditional: 0, vegetarian: 0, vegana: 0, sin_tacc: 0 }
    selectedEventIds.forEach(id => {
      const ev = events.find(e => e.id === id)
      if (ev) {
        totalsByCategory.traditional += ev.trad
        totalsByCategory.vegetarian += ev.veg
        totalsByCategory.vegana += ev.vegan
        totalsByCategory.sin_tacc += ev.st
      }
    })

    const ingredientAggregation: Record<string, { prod: Producto, netQty: number }> = {}
    const categories: ('traditional' | 'vegetarian' | 'vegana' | 'sin_tacc')[] = ['traditional', 'vegetarian', 'vegana', 'sin_tacc']
    
    categories.forEach(cat => {
      const recipeId = (mappings as any)[cat]
      const totalMeals = totalsByCategory[cat]
      if (!recipeId || totalMeals <= 0) return

      const recipe = recetas.find(r => r.id === recipeId)
      recipe?.receta_insumos?.forEach(insumo => {
        const pId = insumo.producto_id
        if (!ingredientAggregation[pId]) {
           const p = productos.find(x => x.id === pId)
           if (p) ingredientAggregation[pId] = { prod: p, netQty: 0 }
        }
        if (ingredientAggregation[pId]) {
          ingredientAggregation[pId].netQty += (insumo.cantidad_necesaria * totalMeals)
        }
      })
    })

    return Object.values(ingredientAggregation).map(item => {
      const rinde = item.prod.factor_merma || 1
      const baseGrossQty = item.netQty / rinde
      const grossQty = baseGrossQty * (1 + bufferPercentage / 100)
      const latestPrice = item.prod.precios_historicos?.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
      const costPerBase = latestPrice?.costo_unidad_base || 0
      
      return {
        id: item.prod.id,
        nombre: item.prod.nombre,
        unidad: item.prod.unidad_medida,
        net: item.netQty,
        gross: grossQty,
        cost: grossQty * costPerBase,
        proveedor: item.prod.proveedores?.nombre
      }
    }).sort((a,b) => b.cost - a.cost)
  }, [selectedEventIds, events, mappings, recetas, productos, bufferPercentage])

  const totalProjectionCost = projection.reduce((acc, item) => acc + item.cost, 0)

  return (
    <div className="space-y-8">
      
      {/* 1. SELECCION DE EVENTOS (GRID AT TOP) */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-800 flex items-center gap-2">
               <Calendar size={20} className="text-indigo-500" /> 1. Seleccione Eventos (Recitales)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Seleccione los eventos para los cuales desea consolidar la compra de insumos.
            </p>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={selectAll} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Seleccionar Todos</button>
             <button onClick={selectNone} className="text-[10px] font-black uppercase text-slate-400 hover:underline">Limpiar</button>
             <button 
                onClick={() => setIsEventsExpanded(!isEventsExpanded)}
                className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400"
             >
                {isEventsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
             </button>
          </div>
        </div>

        {isEventsExpanded && (
          <div className="p-8 bg-white overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
              {loading ? (
                <div className="col-span-full py-10 flex justify-center"><Loader2 size={32} className="animate-spin text-indigo-300" /></div>
              ) : (
                events.map(ev => (
                  <div 
                    key={ev.id}
                    onClick={() => toggleEvent(ev.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-3 relative ${selectedEventIds.includes(ev.id) ? 'bg-indigo-50 border-indigo-400 shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}
                  >
                    <div className="absolute top-4 right-4">
                       {selectedEventIds.includes(ev.id) ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-slate-200" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 leading-tight pr-6">{ev.show_name}</h4>
                      <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <Calendar size={10} /> {new Date(ev.event_date+'T12:00:00').toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-auto pt-3 border-t border-slate-100/50 flex justify-between items-end">
                       <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Viandas Cargadas</span>
                          <span className="text-lg font-black text-slate-900">{ev.totalPax}</span>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2. CONFIGURACION DE RECETAS (MAPPING) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-fit sticky top-6">
            <div className="p-8 border-b border-slate-50 bg-indigo-50/30">
               <h3 className="text-sm font-black uppercase tracking-widest text-indigo-900 flex items-center gap-2 italic">
                 <Calculator size={16} className="text-indigo-600" /> 2. Mapeo de Categorías
               </h3>
            </div>
            <div className="p-10 space-y-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                 Asigne qué **Receta Escandallada** corresponde a cada botón de venta del sistema.
               </p>
               {['traditional', 'vegetarian', 'vegana', 'sin_tacc'].map(cat => (
                 <div key={cat} className="space-y-2">
                   <div className="flex items-center justify-between">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                       {cat === 'traditional' ? 'Menú Tradicional' : cat === 'vegetarian' ? 'Menú Vegetariano' : cat === 'vegana' ? 'Menú Vegano' : 'Menú Sin TACC'}
                     </label>
                   </div>
                   <select 
                     className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition"
                     value={(mappings as any)[cat]}
                     onChange={e => setMappings({...mappings, [cat]: e.target.value})}
                   >
                     <option value="">-- No explotar --</option>
                     {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                   </select>
                 </div>
               ))}
               <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <p className="text-[9px] font-bold text-orange-700 leading-tight">
                    * La explosión considera el **Factor de Merma** para sugerir montos de compra bruta.
                  </p>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
            <div className="p-8 border-b border-slate-50 bg-emerald-50/30">
               <h3 className="text-sm font-black uppercase tracking-widest text-emerald-900 flex items-center gap-2 italic">
                 <Shield size={16} className="text-emerald-600" /> 3. Margen de Seguridad
               </h3>
            </div>
            <div className="p-10 space-y-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                 Colchón adicional a la compra bruta para evitar quiebres de stock en el evento.
               </p>
               <div className="flex items-center justify-between gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={bufferPercentage}
                    onChange={(e) => setBufferPercentage(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-2xl font-black text-emerald-900 w-16 text-right">{bufferPercentage}%</span>
               </div>
            </div>
          </div>
        </div>

        {/* 3. RESULTADOS (EXPLOSION) */}
        <div className="lg:col-span-8 space-y-6">
           {selectedEventIds.length === 0 ? (
             <div className="bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-20 flex flex-col items-center justify-center text-center">
                <Package size={64} className="text-slate-200 mb-6" />
                <h3 className="text-2xl font-black text-slate-300 uppercase italic">Aguardando Selección</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Selecciona eventos arriba para ver el listado de compras.</p>
             </div>
           ) : (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
               {/* Total Banner */}
               <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-[2.5rem] p-10 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">Presupuesto de Compra Proyectado</span>
                    <h2 className="text-5xl font-black tracking-tighter mt-1 italic">${totalProjectionCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</h2>
                    <div className="flex gap-4 mt-4">
                       <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase">{selectedEventIds.length} Recitales</span>
                       <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase">{projection.length} Productos distintos</span>
                    </div>
                  </div>
                  <button className="px-10 py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-3">
                    <Download size={18} /> Exportar Orden de Compra
                  </button>
               </div>

               {/* Projection List */}
               <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="px-10 py-6">Producto Consolidado</th>
                        <th className="px-4 py-6 text-center">Compra Bruta Sugerida</th>
                        <th className="px-10 py-6 text-right">Costo Estimado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {projection.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                               <div className="p-3 bg-slate-100 rounded-2xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                  <Package size={20} />
                               </div>
                               <div>
                                  <span className="text-sm font-black text-slate-800 uppercase italic">{item.nombre}</span>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{item.proveedor} | Neta: {item.net.toFixed(0)} {item.unidad}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <div className="flex flex-col items-center">
                               <div className="text-lg font-black text-indigo-900 tracking-tighter">
                                 {item.gross > 1000 && (item.unidad === 'gr' || item.unidad === 'ml') 
                                   ? `${(item.gross / 1000).toFixed(2)} ${item.unidad === 'gr' ? 'KG' : 'LT'}`
                                   : `${item.gross.toFixed(0)} ${item.unidad}`}
                               </div>
                               <div className="flex gap-1 mt-1">
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">Merma</span>
                                  {bufferPercentage > 0 && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded">+{bufferPercentage}% Margen</span>}
                               </div>
                            </div>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className="text-[16px] font-black text-slate-900">${item.cost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
                             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Costo Histórico</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
             </div>
           )}
        </div>
      </div>

    </div>
  )
}
