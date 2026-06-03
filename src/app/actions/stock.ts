"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

/**
 * Delta-Based Stock Traceability Engine for Caterings
 * 
 * Instead of completely reverting and re-inserting entire stock quantities,
 * this function calculates the difference (delta) between what is currently recorded
 * in the database for the event sale and what is required by the updated quantities.
 * 
 * It then posts a single net adjustment entry per product only if the delta is non-zero.
 */
export async function syncStockForSaleAction(headerId: string) {
  console.log(`[STOCK DELTA ENGINE] Starting sync for Header: ${headerId}...`)

  // 1. Fetch header first to ensure we always have company_name and event_master_id
  const { data: header, error: hErr } = await supabase
    .from('event_sales_headers')
    .select('company_name, event_master_id')
    .eq('id', headerId)
    .maybeSingle()

  if (hErr || !header) {
    console.error("[STOCK DELTA ENGINE] Error fetching header or not found:", hErr, headerId)
    return { success: false, error: hErr?.message || "Header not found" }
  }

  const companyName = header.company_name || "Empresa Desconocida"
  const event_master_id = header.event_master_id
  if (!event_master_id) {
    console.log("[STOCK DELTA ENGINE] No event_master_id found in header. Skipped.")
    return { success: true }
  }

  // 2. Fetch current units associated with this sale header to compute NEW state
  const { data: units, error: uErr } = await supabase
    .from('event_sales_units')
    .select('*')
    .eq('header_id', headerId)
    
  if (uErr) {
    console.error("[STOCK DELTA ENGINE] Error fetching units:", uErr)
    return { success: false, error: uErr.message }
  }

  const activeUnits = units || []

  // 3. Fetch all recipes and ingredients
  const { data: recipes } = await supabase
    .from('recetas')
    .select('id, receta_insumos(producto_id, cantidad_necesaria)')
  
  const recipeMap = new Map()
  recipes?.forEach(r => recipeMap.set(r.id, r.receta_insumos))

  // 4. Fetch commercial rules for fallback
  const { data: rules } = await supabase.from('commercial_rules').select('*')
  const rulesMap: Record<string, any> = {}
  rules?.forEach(r => {
     rulesMap[r.company_name.toLowerCase()] = r
  })

  // 5. Calculate target product NET quantities needed for NEW state
  const targetNetDeltas: Record<string, number> = {}

  activeUnits.forEach(u => {
    const company = companyName.toLowerCase()
    const rule = rulesMap[company]

    const rTrad = u.recipe_trad_id || rule?.recipe_trad_id
    const rVeg = u.recipe_veg_id || rule?.recipe_veg_id
    const rVegan = u.recipe_vegan_id || rule?.recipe_vegan_id
    const rSintacc = u.recipe_sintacc_id || rule?.recipe_sintacc_id

    const processCategory = (qty: number, recipeId: string) => {
      if (qty <= 0 || !recipeId) return
      const insumos = recipeMap.get(recipeId) || []
      insumos.forEach((ins: any) => {
        targetNetDeltas[ins.producto_id] = (targetNetDeltas[ins.producto_id] || 0) + (ins.cantidad_necesaria * qty)
      })
    }

    processCategory(u.traditional, rTrad)
    processCategory(u.vegetarian, rVeg)
    processCategory(u.vegana, rVegan)
    processCategory(u.sin_tacc, rSintacc)
    
    // Water
    if (u.water_qty > 0) {
       const waterId = "2e452d5b-9d90-47a7-ae2e-134cc55ef7bd"
       targetNetDeltas[waterId] = (targetNetDeltas[waterId] || 0) + u.water_qty
    }
  })

  // 6. Fetch previously registered movements for this header using ilike on descripcion
  const { data: existingMovements, error: mErr } = await supabase
    .from('stock_movements')
    .select('producto_id, cantidad')
    .ilike('descripcion', `%Header: ${headerId}%`)

  if (mErr) {
    console.error("[STOCK DELTA ENGINE] Error loading existing movements:", mErr)
    return { success: false, error: mErr.message }
  }

  // Sum up previously recorded quantities per product
  const currentRecorded: Record<string, number> = {}
  existingMovements?.forEach(m => {
    currentRecorded[m.producto_id] = (currentRecorded[m.producto_id] || 0) + Number(m.cantidad)
  })

  // 7. Get union of all involved products (target and existing)
  const allInvolvedProductIds = new Set<string>([
    ...Object.keys(targetNetDeltas),
    ...Object.keys(currentRecorded)
  ])

  // 8. Fetch product yields (factor_merma) and names for involved products
  let products: any[] = []
  if (allInvolvedProductIds.size > 0) {
    const { data: prodData, error: pErr } = await supabase
      .from('productos')
      .select('id, nombre, factor_merma')
      .in('id', Array.from(allInvolvedProductIds))
    
    if (pErr) {
      console.error("[STOCK DELTA ENGINE] Error fetching products:", pErr)
      return { success: false, error: pErr.message }
    }
    products = prodData || []
  }

  const productYields: Record<string, number> = {}
  const productNames: Record<string, string> = {}
  products.forEach(p => {
    productYields[p.id] = p.factor_merma && p.factor_merma > 0 ? p.factor_merma : 1
    productNames[p.id] = p.nombre
  })

  // 9. Compare and build single adjustment movements (deltas)
  const adjustmentMovements: any[] = []

  allInvolvedProductIds.forEach(prodId => {
    const neto = targetNetDeltas[prodId] || 0
    const rinde = productYields[prodId] || 1
    
    // Calculate new total target GROSS needed (as negative number since it is consumption)
    const targetGrossNeeded = neto > 0 ? -Math.ceil(neto / rinde) : 0
    
    // Total already recorded in database
    const recordedGross = currentRecorded[prodId] || 0
    
    // Delta = Target Needed - Already Recorded
    const delta = targetGrossNeeded - recordedGross

    if (delta === 0) return // No change -> Skip!

    const prodName = productNames[prodId] || "Insumo Especial"
    const uppercaseCompany = companyName.toUpperCase()

    console.log(`[STOCK DELTA ENGINE] Product: ${prodName} | Needed: ${targetGrossNeeded} | Recorded: ${recordedGross} | Delta: ${delta}`)

    if (delta > 0) {
      // Positive delta means we need to put stock back (Reversion/Ingreso)
      adjustmentMovements.push({
        producto_id: prodId,
        event_master_id: event_master_id,
        tipo_movimiento: 'INGRESO_AJUSTE_EVENTO',
        cantidad: delta,
        descripcion: `[EMPRESA: ${uppercaseCompany}] Ajuste positivo por diferencia en viandas del evento (Header: ${headerId})`
      })
    } else {
      // Negative delta means we need to deduct more stock (Egreso/Consumo)
      adjustmentMovements.push({
        producto_id: prodId,
        event_master_id: event_master_id,
        tipo_movimiento: 'EGRESO_AJUSTE_EVENTO',
        cantidad: delta,
        descripcion: `[EMPRESA: ${uppercaseCompany}] Ajuste de consumo extra por actualización de viandas (Header: ${headerId})`
      })
    }
  })

  // 10. Bulk Insert adjustments into stock_movements
  if (adjustmentMovements.length > 0) {
    const { error: insertErr } = await supabase
      .from('stock_movements')
      .insert(adjustmentMovements)

    if (insertErr) {
      console.error("[STOCK DELTA ENGINE] Bulk Insert Error:", insertErr)
      return { success: false, error: insertErr.message }
    }
    console.log(`[STOCK DELTA ENGINE] Successfully inserted ${adjustmentMovements.length} adjustment records.`)
  } else {
    console.log("[STOCK DELTA ENGINE] No deviations found. Stock is 100% matched.")
  }

  revalidatePath("/inventario/stock")
  revalidatePath("/inventario/proyeccion")
  return { success: true }
}
