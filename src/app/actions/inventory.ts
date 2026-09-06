"use server"

import { supabase } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { ProductFormData } from "@/types/inventory"
import { revalidatePath } from "next/cache"

export async function createProductAction(data: ProductFormData) {
  try {
    const serverSupabase = createClient()
    const factorMermaNormalized = data.factor_merma > 0 ? (data.factor_merma / 100) : 1
    const divisor = (data.unidad_medida === 'un') ? 1 : 1000
    // Formula: (Precio Neto / Divisor) / Rinde
    const costoUnidadBase = (data.precio_neto / divisor) / factorMermaNormalized

    // LLamado al RPC para transaccionalidad atómica (Producto + Precio Histórico)
    const { data: productId, error } = await serverSupabase.rpc('crear_producto_con_precio', {
      p_familia_id: data.familia_id,
      p_proveedor_id: data.proveedor_id,
      p_nombre: data.nombre,
      p_unidad_medida: data.unidad_medida,
      p_factor_merma: factorMermaNormalized,
      p_gramos_por_unidad: data.gramos_por_unidad,
      p_iva_pct: data.iva_pct,
      p_precio_neto: data.precio_neto
    })

    if (error) {
      console.error("Supabase RPC Error:", error)
      throw new Error(error.message)
    }

    await serverSupabase
      .from('precios_historicos')
      .update({ costo_unidad_base: costoUnidadBase })
      .eq('producto_id', productId)
      .eq('activo', true)

    // Insertar proveedores adicionales en producto_proveedores (el trigger se encarga del principal)
    if (data.proveedores_ids && data.proveedores_ids.length > 0) {
      const additionalIds = data.proveedores_ids.filter(id => id !== data.proveedor_id)
      if (additionalIds.length > 0) {
        const relations = additionalIds.map(provId => ({
          producto_id: productId,
          proveedor_id: provId
        }))
        const { error: syncError } = await serverSupabase.from('producto_proveedores').insert(relations)
        if (syncError) console.error("Error syncing producto_proveedores:", syncError)
      }
    }

    // Revalidar caché de servidor de las vistas que listen productos
    revalidatePath("/inventario/productos")
    revalidatePath("/inventario/catalogo")
    revalidatePath("/inventario/recetas")
    
    return { success: true, data: productId }
  } catch (err: any) {
    console.error("Action error:", err)
    return { success: false, error: err.message || "Error desconocido al crear producto" }
  }
}

export async function updateProductAction(id: string, data: ProductFormData) {
  try {
    const serverSupabase = createClient()
    const factorMermaNormalized = data.factor_merma > 0 ? (data.factor_merma / 100) : 1
    const divisor = (data.unidad_medida === 'un') ? 1 : 1000
    // Formula: (Precio Neto / Divisor) / Rinde
    const costoUnidadBase = (data.precio_neto / divisor) / factorMermaNormalized
    
    // 1. Actualizar datos del producto
    const { error: productError } = await serverSupabase
      .from('productos')
      .update({
        familia_id: data.familia_id,
        proveedor_id: data.proveedor_id,
        nombre: data.nombre,
        unidad_medida: data.unidad_medida,
        factor_merma: factorMermaNormalized,
        gramos_por_unidad: data.gramos_por_unidad,
        iva_pct: data.iva_pct
      })
      .eq('id', id)

    if (productError) throw productError

    // 2. Insertar nuevo histórico (mantiene trazabilidad con costo base por gramo/unidad)
    const { error: priceError } = await serverSupabase
      .from('precios_historicos')
      .insert([{
        producto_id: id,
        precio_neto: data.precio_neto,
        costo_unidad_base: costoUnidadBase,
        iva_porcentaje: data.iva_pct
      }])

    if (priceError) throw priceError

    // Sincronizar tabla intermedia producto_proveedores
    const { error: deleteError } = await serverSupabase
      .from('producto_proveedores')
      .delete()
      .eq('producto_id', id)
      .neq('proveedor_id', data.proveedor_id)

    if (deleteError) throw deleteError

    if (data.proveedores_ids && data.proveedores_ids.length > 0) {
      const additionalIds = data.proveedores_ids.filter(provId => provId !== data.proveedor_id)
      if (additionalIds.length > 0) {
        const relations = additionalIds.map(provId => ({
          producto_id: id,
          proveedor_id: provId
        }))
        const { error: syncError } = await serverSupabase.from('producto_proveedores').insert(relations)
        if (syncError) throw syncError
      }
    }

    revalidatePath("/inventario/productos")
    revalidatePath("/inventario/catalogo")
    revalidatePath("/inventario/recetas")
    return { success: true }
  } catch (err: any) {
    console.error("Update Action error:", err)
    return { success: false, error: err.message || "Error al actualizar producto" }
  }
}

export async function deleteProductAction(id: string) {
  try {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/inventario/productos")
    revalidatePath("/inventario/catalogo")
    return { success: true }
  } catch (err: any) {
    console.error("Delete Action error:", err)
    return { success: false, error: err.message || "Error al eliminar producto" }
  }
}

export async function updateProductStockAction(id: string, stock_actual: number, stock_minimo: number) {
  try {
    // 1. Obtener stock actual para guardar como anterior
    const { data: current } = await supabase.from('productos').select('stock_actual').eq('id', id).single()

    const { error } = await supabase
      .from('productos')
      .update({ 
        stock_actual, 
        stock_minimo,
        stock_anterior: current?.stock_actual || 0 
      })
      .eq('id', id)

    if (error) throw error
    revalidatePath("/inventario/stock")
    revalidatePath("/inventario/productos")
    revalidatePath("/inventario/catalogo")
    return { success: true }
  } catch (err: any) {
    console.error("Update Stock Action error:", err)
    return { success: false, error: err.message || "Error al actualizar stock" }
  }
}

export async function createFamiliaAction(nombre: string) {
  try {
    const { data, error } = await supabase
      .from('familias')
      .insert([{ nombre }])
      .select()
      .single()

    if (error) throw error
    revalidatePath("/inventario/familias")
    revalidatePath("/inventario/productos")
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteFamiliaAction(id: string) {
  try {
    const { error } = await supabase.from('familias').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/inventario/familias")
    revalidatePath("/inventario/productos")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function createProveedorAction(nombre: string, contacto?: string) {
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .insert([{ nombre, contacto }])
      .select()
      .single()

    if (error) throw error
    revalidatePath("/inventario/proveedores")
    revalidatePath("/inventario/productos")
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteProveedorAction(id: string) {
  try {
    const { error } = await supabase.from('proveedores').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/inventario/proveedores")
    revalidatePath("/inventario/productos")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// --- RUBROS COMIDA ---
export async function createRubroAction(nombre: string) {
  try {
    const { data, error } = await supabase.from('rubros_comida').insert([{ nombre }]).select().single()
    if (error) throw error
    revalidatePath("/inventario/rubros-comida")
    revalidatePath("/inventario/recetas")
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteRubroAction(id: string) {
  try {
    const { error } = await supabase.from('rubros_comida').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/inventario/rubros-comida")
    revalidatePath("/inventario/recetas")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// --- RECETAS ---
export async function createRecetaAction(data: { nombre: string, rubro_id?: string, es_producto_final: boolean, precio_venta_sugerido: number }) {
  try {
    const { data: receta, error } = await supabase
      .from('recetas')
      .insert([{
        nombre: data.nombre,
        rubro_id: data.rubro_id || null,
        es_producto_final: data.es_producto_final,
        precio_venta_sugerido: data.precio_venta_sugerido,
        version: "1.0"
      }])
      .select()
      .single()

    if (error) throw error
    revalidatePath("/inventario/recetas")
    return { success: true, data: receta }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteRecetaAction(id: string) {
  try {
    const { error } = await supabase.from('recetas').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/inventario/recetas")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// --- INGREDIENTES (RECETA_INSUMOS) ---
export async function addIngredientAction(recetaId: string, productoId: string, cantidad: number) {
  try {
    const { data, error } = await supabase
      .from('receta_insumos')
      .insert([{
        receta_id: recetaId,
        producto_id: productoId,
        cantidad_necesaria: cantidad
      }])
      .select()
      .single()

    if (error) throw error
    revalidatePath("/inventario/recetas")
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function removeIngredientAction(id: string) {
  try {
    const { error } = await supabase.from('receta_insumos').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/inventario/recetas")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// --- SINCRONIZACIÓN Y CORRECCIÓN MASIVA DE COSTOS BASE ---
export async function syncAllProductBaseCostsAction() {
  try {
    const serverSupabase = createClient()
    
    // 1. Obtener todos los productos y sus precios
    const { data: prods, error: pErr } = await serverSupabase
      .from('productos')
      .select('*, precios_historicos(*)')

    if (pErr) throw pErr
    if (!prods) return { success: true, message: "No hay productos" }

    for (const p of prods) {
      let rinde = Number(p.factor_merma) || 1
      if (rinde < 0.05 && rinde > 0) {
        rinde = rinde * 100
        if (rinde > 1.0) rinde = rinde / 100
        await serverSupabase.from('productos').update({ factor_merma: rinde }).eq('id', p.id)
      } else if (rinde > 1.0) {
        rinde = rinde / 100
        await serverSupabase.from('productos').update({ factor_merma: rinde }).eq('id', p.id)
      }

      const divisor = (p.unidad_medida === 'un') ? 1 : 1000

      for (const ph of (p.precios_historicos || [])) {
        let neto = Number(ph.precio_neto) || 0
        
        // Ajuste de valores que estaban en centenas/miles antiguos
        const pName = (p.nombre || '').toLowerCase()
        if (pName.includes('barra danbo') && neto < 100) neto = 8149
        else if (pName.includes('jamon cocido') && neto < 100) neto = 9867
        else if (pName.includes('lechuga') && neto < 100) neto = 3000
        else if (pName.includes('tomate') && neto < 100) neto = 2400
        else if (pName.includes('cheddar') && (neto < 100 || rinde < 0.05)) neto = 6894
        else if (pName.includes('lomo ahumado') && (neto < 100 || rinde < 0.05)) neto = 13729

        let correctBase = 0
        if (p.unidad_medida === 'un') {
          correctBase = neto / (rinde > 0 ? rinde : 1)
        } else {
          correctBase = (neto / divisor) / (rinde > 0 ? rinde : 1)
        }

        await serverSupabase
          .from('precios_historicos')
          .update({
            precio_neto: neto,
            costo_unidad_base: Number(correctBase.toFixed(4))
          })
          .eq('id', ph.id)
      }
    }

    revalidatePath("/inventario/recetas")
    revalidatePath("/inventario/productos")
    revalidatePath("/inventario/catalogo")
    return { success: true }
  } catch (err: any) {
    console.error("Error in syncAllProductBaseCostsAction:", err)
    return { success: false, error: err.message }
  }
}



