"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function saveFullRecetaAction(
  recetaData: {
    nombre: string
    rubro_id?: string
    es_producto_final: boolean
    precio_venta_sugerido: number
  },
  ingredientes: {
    producto_id: string
    cantidad_necesaria: number
  }[]
) {
  try {
    // 1. Create Recipe Header
    const { data: receta, error: rErr } = await supabase
      .from('recetas')
      .insert([{
        nombre: recetaData.nombre,
        rubro_id: recetaData.rubro_id || null,
        es_producto_final: recetaData.es_producto_final,
        precio_venta_sugerido: recetaData.precio_venta_sugerido,
        version: "1"
      }])
      .select()
      .single()

    if (rErr) throw rErr
    if (!receta) throw new Error("Failed to create recipe header")

    // 2. Create Ingredients
    if (ingredientes.length > 0) {
      const insumosToInsert = ingredientes.map(ing => ({
        receta_id: receta.id,
        producto_id: ing.producto_id,
        cantidad_necesaria: ing.cantidad_necesaria
      }))

      const { error: iErr } = await supabase
        .from('receta_insumos')
        .insert(insumosToInsert)

      if (iErr) {
        // Rollback? Supabase doesn't have multi-table transactions in JS easily without RPC.
        // For now we assume success or clean up (not ideal but better than nothing).
        // A real atomic save would use an RPC function.
        throw iErr
      }
    }

    revalidatePath("/inventario/recetas")
    return { success: true, data: receta }
  } catch (err: any) {
    console.error("Save Full Receta Error:", err)
    return { success: false, error: err.message }
  }
}

export async function updateFullRecetaAction(
  recetaId: string,
  recetaData: {
    nombre: string
    rubro_id?: string
    es_producto_final: boolean
    precio_venta_sugerido: number
  },
  ingredientes: {
    producto_id: string
    cantidad_necesaria: number
  }[]
) {
  try {
    // 1. Update Header
    const { error: rErr } = await supabase
      .from('recetas')
      .update({
        nombre: recetaData.nombre,
        rubro_id: recetaData.rubro_id || null,
        es_producto_final: recetaData.es_producto_final,
        precio_venta_sugerido: recetaData.precio_venta_sugerido
      })
      .eq('id', recetaId)

    if (rErr) throw rErr

    // 2. Sync Ingredients (Delete old, Insert new)
    // This is the simplest "atomic-like" update pattern without RPC
    const { error: dErr } = await supabase
      .from('receta_insumos')
      .delete()
      .eq('receta_id', recetaId)

    if (dErr) throw dErr

    if (ingredientes.length > 0) {
      const insumosToInsert = ingredientes.map(ing => ({
        receta_id: recetaId,
        producto_id: ing.producto_id,
        cantidad_necesaria: ing.cantidad_necesaria
      }))

      const { error: iErr } = await supabase
        .from('receta_insumos')
        .insert(insumosToInsert)

      if (iErr) throw iErr
    }

    revalidatePath("/inventario/recetas")
    return { success: true }
  } catch (err: any) {
    console.error("Update Full Receta Error:", err)
    return { success: false, error: err.message }
  }
}

export async function duplicateRecipeAction(recipeId: string) {
  try {
    // 1. Fetch original recipe header
    const { data: original, error: fErr } = await supabase
      .from('recetas')
      .select('*')
      .eq('id', recipeId)
      .single()

    if (fErr) throw fErr

    // 2. Fetch original ingredients explicitly
    const { data: ingredients, error: iErrFetch } = await supabase
      .from('receta_insumos')
      .select('*')
      .eq('receta_id', recipeId)

    if (iErrFetch) throw iErrFetch

    // 3. Insert new header
    const { data: newReceta, error: rErr } = await supabase
      .from('recetas')
      .insert([{
        nombre: `COPIA - ${original.nombre}`,
        rubro_id: original.rubro_id,
        es_producto_final: original.es_producto_final,
        precio_venta_sugerido: original.precio_venta_sugerido,
        version: "1"
      }])
      .select()
      .single()

    if (rErr) throw rErr

    // 4. Insert new ingredients (Deep Copy)
    if (ingredients && ingredients.length > 0) {
      const insumosToInsert = ingredients.map((ing: any) => ({
        receta_id: newReceta.id,
        producto_id: ing.producto_id,
        cantidad_necesaria: ing.cantidad_necesaria
      }))

      const { error: iErrInsert } = await supabase
        .from('receta_insumos')
        .insert(insumosToInsert)

      if (iErrInsert) throw iErrInsert
    }

    revalidatePath("/inventario/recetas")
    return { success: true, data: { ...newReceta, receta_insumos: ingredients } }
  } catch (err: any) {
    console.error("Duplicate Recipe Error:", err)
    return { success: false, error: err.message }
  }
}
