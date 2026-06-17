"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface CashConcept {
  id: string
  name: string
  tipo: 'Ingreso' | 'Egreso'
  created_at: string
}

export interface CashSubconcept {
  id: string
  concept_id: string
  name: string
  created_at: string
}

// 1. Obtener todos los conceptos y subconceptos
export async function getCategoriesAction() {
  try {
    const supabase = createClient()

    const { data: concepts, error: cErr } = await supabase
      .from('cash_concepts')
      .select('*')
      .order('name')

    if (cErr) throw cErr

    const { data: subconcepts, error: sErr } = await supabase
      .from('cash_subconcepts')
      .select('*')
      .order('name')

    if (sErr) throw sErr

    return { 
      success: true, 
      concepts: (concepts || []) as CashConcept[], 
      subconcepts: (subconcepts || []) as CashSubconcept[] 
    }
  } catch (err: any) {
    console.error("Error in getCategoriesAction:", err)
    return { success: false, error: err.message || "Error al obtener categorías" }
  }
}

// 2. Crear un concepto nuevo (Rubro)
export async function createConceptAction(name: string, tipo: 'Ingreso' | 'Egreso') {
  try {
    const supabase = createClient()

    if (!name || !name.trim()) {
      throw new Error("El nombre del rubro no puede estar vacío.")
    }

    const { data, error } = await supabase
      .from('cash_concepts')
      .insert({ name: name.trim(), tipo })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/finanzas/categorias')
    revalidatePath('/finanzas')
    revalidatePath('/finanzas/tesoreria')
    return { success: true, data }
  } catch (err: any) {
    console.error("Error in createConceptAction:", err)
    return { success: false, error: err.message || "Error al crear el rubro" }
  }
}

// 3. Editar un concepto existente
export async function updateConceptAction(id: string, name: string) {
  try {
    const supabase = createClient()

    if (!name || !name.trim()) {
      throw new Error("El nombre del rubro no puede estar vacío.")
    }

    const { data, error } = await supabase
      .from('cash_concepts')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Sincronizar también la columna redundante 'concepto' y 'rubro' en cash_movements
    // para mantener consistencia con los reportes
    await supabase
      .from('cash_movements')
      .update({ concepto: name.trim(), rubro: name.trim() })
      .eq('concept_id', id)

    revalidatePath('/finanzas/categorias')
    revalidatePath('/finanzas')
    revalidatePath('/finanzas/tesoreria')
    return { success: true, data }
  } catch (err: any) {
    console.error("Error in updateConceptAction:", err)
    return { success: false, error: err.message || "Error al actualizar el rubro" }
  }
}

// 4. Eliminar un concepto
export async function deleteConceptAction(id: string) {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('cash_concepts')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/finanzas/categorias')
    revalidatePath('/finanzas')
    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in deleteConceptAction:", err)
    return { success: false, error: err.message || "Error al eliminar el rubro" }
  }
}

// 5. Crear un subconcepto nuevo (Concepto de Caja / Subrubro)
export async function createSubconceptAction(conceptId: string, name: string) {
  try {
    const supabase = createClient()

    if (!name || !name.trim()) {
      throw new Error("El nombre de la subcategoría no puede estar vacío.")
    }

    const { data, error } = await supabase
      .from('cash_subconcepts')
      .insert({ concept_id: conceptId, name: name.trim() })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/finanzas/categorias')
    revalidatePath('/finanzas')
    revalidatePath('/finanzas/tesoreria')
    return { success: true, data }
  } catch (err: any) {
    console.error("Error in createSubconceptAction:", err)
    return { success: false, error: err.message || "Error al crear la subcategoría" }
  }
}

// 6. Editar un subconcepto existente
export async function updateSubconceptAction(id: string, name: string) {
  try {
    const supabase = createClient()

    if (!name || !name.trim()) {
      throw new Error("El nombre de la subcategoría no puede estar vacío.")
    }

    const { data, error } = await supabase
      .from('cash_subconcepts')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Sincronizar también la columna redundante 'conc_caja' en cash_movements
    await supabase
      .from('cash_movements')
      .update({ conc_caja: name.trim() })
      .eq('subconcept_id', id)

    revalidatePath('/finanzas/categorias')
    revalidatePath('/finanzas')
    revalidatePath('/finanzas/tesoreria')
    return { success: true, data }
  } catch (err: any) {
    console.error("Error in updateSubconceptAction:", err)
    return { success: false, error: err.message || "Error al actualizar la subcategoría" }
  }
}

// 7. Eliminar un subconcepto
export async function deleteSubconceptAction(id: string) {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('cash_subconcepts')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/finanzas/categorias')
    revalidatePath('/finanzas')
    revalidatePath('/finanzas/tesoreria')
    return { success: true }
  } catch (err: any) {
    console.error("Error in deleteSubconceptAction:", err)
    return { success: false, error: err.message || "Error al eliminar la subcategoría" }
  }
}

// 8. Verificar si una categoría está en uso
export async function checkCategoryInUseAction(id: string, type: 'concept' | 'subconcept') {
  try {
    const supabase = createClient()
    const queryField = type === 'concept' ? 'concept_id' : 'subconcept_id'

    const { count, error } = await supabase
      .from('cash_movements')
      .select('id', { count: 'exact', head: true })
      .eq(queryField, id)

    if (error) throw error

    return { success: true, inUse: (count || 0) > 0, count: count || 0 }
  } catch (err: any) {
    console.error("Error in checkCategoryInUseAction:", err)
    return { success: false, inUse: false, error: err.message || "Error al verificar uso de categoría" }
  }
}
