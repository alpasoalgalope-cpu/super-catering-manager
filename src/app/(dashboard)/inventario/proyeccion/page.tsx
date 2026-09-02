"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getCoordinatorConversionRatesAction } from "@/app/actions/reports"
import { 
  ShoppingCart, Package, TrendingUp, Calendar, 
  MapPin, Loader2, Info, ArrowRight, Scale, 
  ChevronRight, Calculator, PieChart, CheckCircle2,
  Circle, Shield
} from "lucide-react"

// --- Types ---
interface IngredientNeed {
  productId: string
  name: string
  unit: string
  totalQuantity: number
  gramsPerUnit: number
  familyName: string
  stockActual: number
  stockTransito: number
  proveedorId?: string
  proveedorName?: string
}

interface EventSummary {
  id: string
  date: string
  show: string
  totalPax: number
  adjustedPax: number
  details: {
    category: string
    quantity: number
    recipeName: string
    recipeId: string
  }[]
  missingRules?: string[]
}

// --- Helper for consistent key matching ---
function normalizeKey(str: string) {
  return str?.trim().toLowerCase().replace(/\s+/g, ' ') || ""
}

export default function ProyeccionInsumosPage() {
  const [loading, setLoading] = useState(true)
  const [rawData, setRawData] = useState<{
    masters: any[]
    probabilities: any[]
    rules: any[]
    clientList: any[]
    recipes: any[]
    waterProduct: any
    inTransit: any[]
  }>({ masters: [], probabilities: [], rules: [], clientList: [], recipes: [], waterProduct: null, inTransit: [] })
  
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set())
  const [bufferPercentage, setBufferPercentage] = useState(20)
  const [coordinatorRates, setCoordinatorRates] = useState<Record<string, number>>({})
  const [rvClientId, setRvClientId] = useState<string | undefined>(undefined)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const fourteenDaysLater = new Date()
      fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14)
      const endDate = fourteenDaysLater.toISOString().split('T')[0]

      const [
        { data: masters },
        { data: probabilities },
        { data: rules },
        { data: clientList },
        { data: recipes },
        { data: waterProduct },
        { data: inTransit },
        coordinatorRatesRes
      ] = await Promise.all([
        supabase.from("events_master")
          .select("id, event_date, show_name, status, event_projections(company_name, projected_pax), event_bus_assignments(client_id, crew_count, coordinators(id, name, phone, company))")
          .gte("event_date", today)
          .lte("event_date", endDate)
          .neq("status", "cancelado"), // Excluir eventos cancelados
        supabase.from("product_mix_probabilities").select("*"),
        supabase.from("commercial_rules").select("*"),
        supabase.from("clients").select("id, name, conversion_factor"),
        supabase.from("recetas").select(`
          id, nombre,
          receta_insumos(
            producto_id, 
            cantidad_necesaria, 
            productos(
              nombre, 
              unidad_medida, 
              gramos_por_unidad,
              stock_actual,
              proveedor_id,
              familias(nombre),
              proveedores!productos_proveedor_id_fkey(nombre)
            )
          )
        `),
        supabase.from("productos").select("*, familias(nombre), proveedores!productos_proveedor_id_fkey(nombre)").eq("id", "2e452d5b-9d90-47a7-ae2e-134cc55ef7bd").single(),
        supabase.from("vw_stock_en_transito").select("*"),
        getCoordinatorConversionRatesAction()
      ])

      const rates = coordinatorRatesRes.data || {}
      setCoordinatorRates(rates)

      let rvId: string | undefined = undefined
      clientList?.forEach((c: any) => {
        if (c.name?.trim().toLowerCase() === "rv traslados") {
          rvId = c.id
        }
      })
      setRvClientId(rvId)

      setRawData({
        masters: masters || [],
        probabilities: probabilities || [],
        rules: rules || [],
        clientList: clientList || [],
        recipes: recipes || [],
        waterProduct: waterProduct || null,
        inTransit: inTransit || []
      })

      if (masters) setSelectedEventIds(new Set(masters.map(m => m.id)))
      setLoading(false)
    }
    fetchData()
  }, [])

  const maps = useMemo(() => {
    const probMap: Record<string, number> = {}
    rawData.probabilities.forEach(p => probMap[p.category] = Number(p.probability))

    const ruleMap: Record<string, any> = {}
    rawData.rules.forEach(r => {
      const key = normalizeKey(r.company_name)
      if (key) ruleMap[key] = r
    })

    const convMap: Record<string, number> = {}
    rawData.clientList.forEach(c => {
      const key = normalizeKey(c.name)
      if (key) convMap[key] = Number(c.conversion_factor) || 1.0
    })

    const recipeMap: Record<string, any> = {}
    rawData.recipes.forEach(r => recipeMap[r.id] = r)

    const transitMap: Record<string, number> = {}
    rawData.inTransit.forEach(t => transitMap[t.producto_id] = Number(t.total_en_transito))

    return { probMap, ruleMap, convMap, recipeMap, transitMap }
  }, [rawData])

  // --- Real-time Recalculation Engine ---
  const { ingredients, procurementList, events } = useMemo(() => {
    const ingredientsNeed: Record<string, IngredientNeed> = {}
    const eventSummaries: EventSummary[] = []

    rawData.masters.forEach(m => {
      let eventTotalPax = 0
      const isSelected = selectedEventIds.has(m.id)
      const missingRules: string[] = []
      
      // Consolidation Map for the event (category -> total qty)
      const consolidatedDetails: Record<string, { quantity: number, recipeName: string, recipeId: string }> = {}

      // Calculate Crew (Liberados) from bus assignments
      const eventCrewTotal = (m.event_bus_assignments || []).reduce((acc: number, ba: any) => acc + (ba.crew_count || 0), 0)
      if (eventCrewTotal > 0) {
        // We assume crew gets Traditional viandas. 
        // We'll find a rule (any rule for the event) to get the traditional recipe ID, 
        // or just use the first available one.
        const anyComp = m.event_projections?.[0]?.company_name
        const rule = anyComp ? maps.ruleMap[normalizeKey(anyComp)] : null
        const tradRecipeId = rule?.recipe_trad_id || (rawData.rules.length > 0 ? rawData.rules[0].recipe_trad_id : null)
        
        if (tradRecipeId) {
          const recipe = maps.recipeMap[tradRecipeId]
          if (recipe) {
            consolidatedDetails['traditional'] = { 
              quantity: eventCrewTotal, 
              recipeName: recipe.nombre, 
              recipeId: recipe.id 
            }
          }
        }
      }

      // Deduplicate projections
      const seenCompanies = new Set()
      const uniqueProjections = m.event_projections?.filter((p: any) => {
        const key = normalizeKey(p.company_name)
        if (!key || seenCompanies.has(key)) return false
        seenCompanies.add(key)
        return true
      }) || []

      uniqueProjections.forEach((proj: any) => {
        const compKey = normalizeKey(proj.company_name)
        
        let factor = maps.convMap[compKey] || 1.0
        if (compKey === "rv traslados") {
          const rvAssignment = m.event_bus_assignments?.find((ba: any) => {
            if (rvClientId && ba.client_id === rvClientId) return true
            if (ba.coordinators?.company?.trim().toLowerCase() === "rv traslados") return true
            return false
          })
          const coordName = rvAssignment?.coordinators?.name
          if (coordName) {
            const coordRate = coordinatorRates[coordName.trim().toLowerCase()]
            if (coordRate !== undefined && coordRate > 0) {
              factor = coordRate
            }
          }
        }

        const rule = maps.ruleMap[compKey]
        const basePax = Number(proj.projected_pax) || 0
        const adjustedSales = basePax * factor
        
        eventTotalPax += basePax

        if (!rule) {
          missingRules.push(proj.company_name)
          console.warn(`[EXPLOSION] Missing rule for: "${proj.company_name}" (Normalized: "${compKey}")`)
          return
        }

        console.log(`[EXPLOSION] Processing ${proj.company_name}: Pax ${basePax} -> Sales ${adjustedSales.toFixed(1)} (Water: ${rule.includes_water})`)

        const cats = [
          { id: 'traditional', recipeId: rule?.recipe_trad_id },
          { id: 'vegetarian', recipeId: rule?.recipe_veg_id },
          { id: 'vegan', recipeId: rule?.recipe_vegan_id },
          { id: 'sin_tacc', recipeId: rule?.recipe_sintacc_id }
        ]

        cats.forEach(cat => {
          const prob = maps.probMap[cat.id] || 0
          const catPax = adjustedSales * prob
          if (catPax <= 0 || !cat.recipeId) return

          const recipe = maps.recipeMap[cat.recipeId]
          if (!recipe) return

          if (!consolidatedDetails[cat.id]) {
            consolidatedDetails[cat.id] = { quantity: 0, recipeName: recipe.nombre, recipeId: recipe.id }
          }
          consolidatedDetails[cat.id].quantity += catPax
        })

        // Water Logic
        if (rule?.includes_water) {
          const waterProduct = rawData.waterProduct
          if (waterProduct) {
            if (!consolidatedDetails['bebida']) {
              consolidatedDetails['bebida'] = { quantity: 0, recipeName: 'Agua Incluida', recipeId: waterProduct.id }
            }
            consolidatedDetails['bebida'].quantity += adjustedSales
          }
        }
      })

      // Final processing for the event: round everything and sum for the total
      let finalEventAdjPax = 0
      const finalDetails = Object.entries(consolidatedDetails).map(([catId, data]) => {
        const roundedQty = Math.ceil(data.quantity)
        if (catId !== 'bebida') finalEventAdjPax += roundedQty

        // Explode ingredients for selected events
        if (isSelected && catId !== 'bebida') {
          const recipe = maps.recipeMap[data.recipeId]
          recipe?.receta_insumos?.forEach((insumo: any) => {
            const pid = insumo.producto_id
            const totalInsumoQty = insumo.cantidad_necesaria * roundedQty
            
            if (!ingredientsNeed[pid]) {
              ingredientsNeed[pid] = {
                productId: pid,
                name: insumo.productos?.nombre || "Insumo Desconocido",
                unit: insumo.productos?.unidad_medida || "un",
                totalQuantity: 0,
                gramsPerUnit: insumo.productos?.gramos_por_unidad || 0,
                familyName: insumo.productos?.familias?.nombre || "SIN FAMILIA",
                stockActual: Number(insumo.productos?.stock_actual) || 0,
                stockTransito: maps.transitMap[pid] || 0,
                proveedorId: insumo.productos?.proveedor_id,
                proveedorName: insumo.productos?.proveedores?.nombre
              } as any
            }
            ingredientsNeed[pid].totalQuantity += totalInsumoQty
          })
        } else if (isSelected && catId === 'bebida') {
          const waterProduct = (rawData as any).waterProduct
          const pid = waterProduct.id
          if (!ingredientsNeed[pid]) {
            ingredientsNeed[pid] = {
              productId: pid,
              name: waterProduct.nombre,
              unit: waterProduct.unidad_medida,
              totalQuantity: 0,
              gramsPerUnit: waterProduct.gramos_por_unidad || 0,
              familyName: waterProduct.familias?.nombre || "Bebidas",
              stockActual: Number(waterProduct.stock_actual) || 0,
              stockTransito: maps.transitMap[pid] || 0,
              proveedorId: waterProduct.proveedor_id,
              proveedorName: waterProduct.proveedores?.nombre
            } as any
          }
          ingredientsNeed[pid].totalQuantity += roundedQty
        }

        return {
          category: catId,
          quantity: roundedQty,
          recipeName: data.recipeName,
          recipeId: data.recipeId
        }
      })

      eventSummaries.push({
        id: m.id,
        date: m.event_date,
        show: m.show_name,
        totalPax: eventTotalPax,
        adjustedPax: finalEventAdjPax,
        details: finalDetails,
        missingRules: missingRules
      })
    })

    // Sort: Family First, then Name
    const finalIngredients = Object.values(ingredientsNeed).map(ing => {
      const baseRaw = ing.totalQuantity
      const bufferedRaw = baseRaw * (1 + bufferPercentage / 100)
      return {
        ...ing,
        baseQuantity: Math.ceil(baseRaw),
        totalQuantity: Math.ceil(bufferedRaw)
      }
    }).sort((a,b) => {
      if (a.familyName !== b.familyName) return a.familyName.localeCompare(b.familyName)
      return a.name.localeCompare(b.name)
    })

    const procurementList = finalIngredients.map(ing => {
       const availableStock = ing.stockActual + (ing.stockTransito || 0)
       const deficit = ing.totalQuantity - availableStock
       return { ...ing, deficit, availableStock }
    }).filter(ing => ing.deficit > 0)

    return { 
      ingredients: finalIngredients, 
      procurementList,
      events: eventSummaries.sort((a,b) => a.date.localeCompare(b.date)) 
    }
  }, [rawData, maps, selectedEventIds, bufferPercentage])

  const toggleEvent = (id: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const [generatingPOs, setGeneratingPOs] = useState(false)
  const router = useRouter()

  const handleGeneratePOs = async () => {
    setGeneratingPOs(true);

    try {
      const itemsToBuy = procurementList.filter(item => item.deficit > 0);
      if (itemsToBuy.length === 0) {
        alert("No hay déficit de insumos para generar órdenes.");
        setGeneratingPOs(false);
        return;
      }

      // Group by proveedor_id
      const groups: Record<string, typeof itemsToBuy> = {};
      itemsToBuy.forEach(item => {
        const provId = item.proveedorId || 'SIN_PROVEEDOR';
        if (!groups[provId]) groups[provId] = [];
        groups[provId].push(item);
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fechaEsperada = tomorrow.toISOString().split('T')[0];

      // Prepare draft format
      const draftOrders = Object.entries(groups).map(([provId, items]) => {
        return {
          proveedor_id: provId === 'SIN_PROVEEDOR' ? null : provId,
          proveedor_nombre: items[0].proveedorName || 'Sin Proveedor Asignado',
          fecha_esperada: fechaEsperada,
          items: items.map(item => {
            const size = Number(item.gramsPerUnit) > 0 ? Number(item.gramsPerUnit) : 1;
            const requiredBultos = Math.ceil(item.deficit / size);
            
            return {
              producto_id: item.productId,
              nombre: item.name,
              unidad_medida: item.unit,
              bultos: requiredBultos,
              unidadesPorBulto: size,
              costoUnitario: 0,
              costoTotal: 0
            }
          })
        }
      })

      localStorage.setItem("po_drafts", JSON.stringify(draftOrders));
      router.push("/inventario/ordenes-compra/sugeridas");

    } catch (err: any) {
      console.error(err);
      alert("Error al preparar el borrador de órdenes: " + err.message);
      setGeneratingPOs(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-400" size={40} /></div>
  )

  return (
    <div className="min-h-screen bg-slate-100 -m-8 p-8 space-y-10 pb-32">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Calculator size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded text-indigo-700 border border-indigo-100">Simulador de Compras Interactivo</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Proyección de Insumos</h1>
            <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest">Cálculos ajustados con redondeo técnico (Math.ceil)</p>
          </div>
          <div className="bg-slate-900 px-8 py-5 rounded-3xl text-white shadow-2xl flex items-center gap-6">
             <div className="text-center">
                <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1 text-indigo-300">Seleccionados</p>
                <p className="text-2xl font-black tabular-nums">{selectedEventIds.size} <span className="text-[10px] opacity-40 uppercase">Shows</span></p>
             </div>
             <div className="h-10 w-px bg-white/10" />
             <div className="text-center">
                <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1 text-emerald-300">Total Insumos</p>
                <p className="text-2xl font-black tabular-nums">{ingredients.length}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* LEFT: PURCHASE LIST (Consolidated) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* MARGEN DE SEGURIDAD */}
            <div className="bg-white rounded-[2.5rem] border border-emerald-200 shadow-md p-8">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2 italic">
                     <Shield size={18} className="text-emerald-500" /> Colchón de Reserva (Margen)
                  </h3>
                  <span className="text-2xl font-black text-emerald-900">{bufferPercentage}%</span>
               </div>
               <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed mb-4">
                 Agrega un porcentaje extra a la compra bruta sugerida para cubrir eventualidades.
               </p>
               <input 
                 type="range" 
                 min="0" 
                 max="100" 
                 step="5"
                 value={bufferPercentage}
                 onChange={(e) => setBufferPercentage(Number(e.target.value))}
                 className="w-full accent-emerald-500 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
               />
            </div>

            <div className="flex items-center justify-between px-2 pt-4">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Materia Prima Requerida</h2>
              <span className="text-[10px] font-black bg-emerald-500 text-white px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-200">Ceil Optimization Active</span>
            </div>
            
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-md divide-y divide-slate-100 overflow-hidden">
              {ingredients.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                   <Package size={48} className="mx-auto text-slate-200" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Selecciona al menos un show para ver los insumos</p>
                </div>
              ) : (
                ingredients.map((ing, idx) => {
                  const showHeader = idx === 0 || ingredients[idx-1].familyName !== ing.familyName
                  
                  return (
                    <React.Fragment key={ing.productId}>
                      {showHeader && (
                        <div className="bg-slate-50 px-8 py-3 border-y border-slate-100">
                           <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">{ing.familyName}</span>
                        </div>
                      )}
                      <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-slate-100 text-slate-500 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                            <Package size={24} />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-950 uppercase tracking-tight leading-none mb-1">{ing.name}</h4>
                            {ing.gramsPerUnit > 0 && (
                              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                                {Math.ceil(ing.totalQuantity / ing.gramsPerUnit)} BULTOS de {ing.gramsPerUnit.toLocaleString('es-AR')} {ing.unit}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-slate-900 tabular-nums">
                            {ing.totalQuantity.toLocaleString('es-AR')}
                            <span className="text-sm text-slate-400 ml-2 uppercase font-bold">{ing.unit}</span>
                          </p>
                          {bufferPercentage > 0 && (
                            <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-widest">
                               Incluye +{bufferPercentage}% (Neto: {ing.baseQuantity} {ing.unit})
                            </p>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })
              )}
            </div>

            {/* PROCUREMENT ALERTS */}
            {procurementList.filter(ing => ing.deficit > 0).length > 0 && (
              <div className="mt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-rose-600 tracking-tight flex items-center gap-2">
                      <ShoppingCart size={24} /> Compra Mínima Obligatoria
                    </h2>
                    <span className="text-[10px] font-black bg-rose-500 text-white px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-rose-200 mt-2 inline-block">Alerta de Stock</span>
                  </div>
                  
                  <button
                    onClick={handleGeneratePOs}
                    disabled={generatingPOs || procurementList.filter(i => i.deficit > 0).length === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-200 flex items-center gap-2"
                  >
                    {generatingPOs ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                    Generar Órdenes Automáticas
                  </button>
                </div>
                
                <div className="bg-white rounded-[2.5rem] border-2 border-rose-200 shadow-md divide-y divide-rose-50 overflow-hidden">
                    {procurementList.filter(ing => ing.deficit > 0).map((ing, idx, arr) => {
                      const showHeader = idx === 0 || arr[idx-1].familyName !== ing.familyName
                      
                      return (
                        <React.Fragment key={'proc_'+ing.productId}>
                          {showHeader && (
                            <div className="bg-rose-50/50 px-8 py-3 border-y border-rose-100">
                               <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">{ing.familyName}</span>
                            </div>
                          )}
                          <div className="p-6 flex items-center justify-between hover:bg-rose-50/30 transition-colors">
                            <div className="flex items-center gap-5">
                              <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl">
                                <ShoppingCart size={24} />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-slate-950 uppercase tracking-tight leading-none mb-1">{ing.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                                    Stock: {ing.stockActual} {ing.unit}
                                  </span>
                                  {ing.stockTransito > 0 && (
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 border border-amber-200 px-2 py-0.5 rounded animate-pulse">
                                      En Tránsito: +{ing.stockTransito} {ing.unit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
                              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Faltan Comprar</p>
                              <p className="text-2xl font-black text-rose-700 tabular-nums">
                                {ing.deficit.toLocaleString('es-AR')}
                                <span className="text-xs text-rose-500 ml-1 uppercase font-bold">{ing.unit}</span>
                              </p>
                              {ing.gramsPerUnit > 0 && (
                                <p className="text-[10px] font-bold text-rose-600 mt-1 uppercase tracking-widest">
                                  {Math.ceil(ing.deficit / ing.gramsPerUnit)} BULTOS de {ing.gramsPerUnit.toLocaleString('es-AR')} {ing.unit}
                                </p>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    })}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT: SHOW PICKER */}
          <div className="lg:col-span-5 space-y-6">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Shows</h2>
                <div className="flex gap-2">
                   <button 
                    onClick={() => setSelectedEventIds(new Set(rawData.masters.map(m => m.id)))}
                    className="text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                   >Todos</button>
                   <button 
                    onClick={() => setSelectedEventIds(new Set())}
                    className="text-[9px] font-black uppercase text-rose-600 hover:bg-rose-50 px-2 py-1 rounded"
                   >Ninguno</button>
                </div>
             </div>

             <div className="space-y-4">
               {events.map(ev => {
                 const isSelected = selectedEventIds.has(ev.id)
                 const evDate = new Date(ev.date + 'T12:00:00')
                 const day = evDate.getDate()
                 const month = evDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.','')

                 return (
                   <button 
                    key={ev.id} 
                    onClick={() => toggleEvent(ev.id)}
                    className={`w-full text-left bg-white p-6 rounded-[2.5rem] border transition-all duration-300 relative group
                      ${isSelected ? 'border-indigo-500 shadow-xl ring-4 ring-indigo-500/5 translate-x-1' : 'border-slate-200 opacity-40 grayscale scale-[0.98] shadow-sm'}
                    `}
                   >
                     {/* Check Indicator */}
                     <div className={`absolute -top-2 -right-2 p-1.5 rounded-full shadow-lg transition-all
                        ${isSelected ? 'bg-indigo-600 text-white scale-110' : 'bg-slate-200 text-slate-400 scale-90'}
                     `}>
                        {isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                     </div>

                     <div className="flex items-center gap-5">
                        <div className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl border shrink-0 transition-colors
                           ${isSelected ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}
                        `}>
                           <span className="text-2xl font-black text-slate-900 leading-none">{day}</span>
                           <span className={`text-[10px] font-black uppercase mt-1 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>{month}</span>
                        </div>
                        <div className="min-w-0">
                           <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter truncate leading-tight group-hover:text-indigo-600 transition-colors">
                              {ev.show}
                           </h4>
                           <div className="flex flex-wrap gap-2 mt-1">
                              <p className={`text-[11px] font-black uppercase tracking-widest 
                                ${isSelected ? 'text-emerald-600' : 'text-slate-400'}
                              `}>
                                 {ev.adjustedPax} Viandas Estimadas
                              </p>
                              {ev.missingRules && ev.missingRules.length > 0 && isSelected && (
                                <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase animate-pulse">
                                  Regla Faltante: {ev.missingRules.join(', ')}
                                </span>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="mt-6 grid grid-cols-2 gap-3">
                        {ev.details.map((det, idx) => (
                          <div key={idx} className={`p-3 rounded-2xl border flex flex-col justify-center transition-colors
                             ${isSelected ? 'bg-slate-50 border-slate-100' : 'bg-slate-100/50 border-slate-200/50'}
                          `}>
                             <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 
                                ${isSelected ? 'text-indigo-400' : 'text-slate-400'}
                             `}>{det.category}</p>
                             <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-slate-900">{det.quantity}</span>
                                <span className="text-[9px] font-bold text-slate-400 truncate ml-2 italic">{det.recipeName}</span>
                             </div>
                          </div>
                        ))}
                     </div>
                   </button>
                 )
               })}
             </div>
          </div>

        </div>

      </div>
    </div>
  )
}
