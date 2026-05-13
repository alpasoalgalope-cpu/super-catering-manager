"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function processStockForSaleAction(headerId: string, isRevert: boolean = false) {
  // 1. Fetch the units associated with this sale header, plus company name for fallback
  const { data: units, error: uErr } = await supabase
    .from('event_sales_units')
    .select('*, event_sales_headers(company_name)')
    .eq('header_id', headerId)
    
  if (uErr || !units || units.length === 0) {
    console.log("[STOCK ENGINE] No units found or error fetching. ID:", headerId)
    return { success: true }
  }

  // 2. Fetch all recipes and ingredients
  const { data: recipes } = await supabase
    .from('recetas')
    .select('id, receta_insumos(producto_id, cantidad_necesaria)')
  
  const recipeMap = new Map()
  recipes?.forEach(r => recipeMap.set(r.id, r.receta_insumos))

  // 3. Fetch commercial rules for fallback
  const { data: rules } = await supabase.from('commercial_rules').select('*')
  const rulesMap: Record<string, any> = {}
  rules?.forEach(r => {
     rulesMap[r.company_name.toLowerCase()] = r
  })

  // 4. Calculate total product quantities needed
  const productDeltas: Record<string, number> = {}

  units.forEach(u => {
    const company = (u.event_sales_headers as any)?.company_name?.toLowerCase() || ""
    const rule = rulesMap[company]

    const rTrad = u.recipe_trad_id || rule?.recipe_trad_id
    const rVeg = u.recipe_veg_id || rule?.recipe_veg_id
    const rVegan = u.recipe_vegan_id || rule?.recipe_vegan_id
    const rSintacc = u.recipe_sintacc_id || rule?.recipe_sintacc_id

    const processCategory = (qty: number, recipeId: string) => {
      if (qty <= 0 || !recipeId) return
      const insumos = recipeMap.get(recipeId) || []
      insumos.forEach((ins: any) => {
        productDeltas[ins.producto_id] = (productDeltas[ins.producto_id] || 0) + (ins.cantidad_necesaria * qty)
      })
    }

    processCategory(u.traditional, rTrad)
    processCategory(u.vegetarian, rVeg)
    processCategory(u.vegana, rVegan)
    processCategory(u.sin_tacc, rSintacc)
    
    // Water
    if (u.water_qty > 0) {
       const waterId = "2e452d5b-9d90-47a7-ae2e-134cc55ef7bd"
       productDeltas[waterId] = (productDeltas[waterId] || 0) + u.water_qty
    }
  })

  // 4. Fetch current stock for these products
  const productIds = Object.keys(productDeltas)
  if (productIds.length === 0) return { success: true }

  const { data: products } = await supabase
    .from('productos')
    .select('id, stock_actual, nombre')
    .in('id', productIds)

  if (!products) throw new Error("Failed to fetch current stock")

  // 5. Calculate new stock
  const updates = products.map(p => {
    const delta = Math.ceil(productDeltas[p.id]) // Round up mathematically as in projections
    const newStock = isRevert 
      ? Number(p.stock_actual) + delta 
      : Number(p.stock_actual) - delta
      
    console.log(`[STOCK ENGINE] ${isRevert ? 'REVERTING' : 'DEDUCTING'} ${delta} from ${p.nombre}. Old: ${p.stock_actual} -> New: ${newStock}`)
      
    return {
      id: p.id,
      stock_actual: newStock
    }
  })

  // 6. Apply updates individually to avoid "upsert" ambiguity with NOT NULL constraints
  for (const update of updates) {
    const { error: updErr } = await supabase
      .from('productos')
      .update({ 
        stock_actual: update.stock_actual,
        stock_anterior: products.find(p => p.id === update.id)?.stock_actual || 0
      })
      .eq('id', update.id)

    if (updErr) {
      console.error("[STOCK ENGINE] Update Error for product:", update.id, updErr)
      throw new Error(`Failed to update stock for product ${update.id}: ${updErr.message}`)
    }
  }

  revalidatePath("/inventario/stock")
  revalidatePath("/inventario/proyeccion")
  return { success: true }
}
