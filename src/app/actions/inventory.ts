"use server"

import { supabase } from "@/lib/supabase"
import { ProductFormData } from "@/types/inventory"
import { revalidatePath } from "next/cache"

export async function createProductAction(data: ProductFormData) {
  try {
    // LLamado al RPC para transaccionalidad atómica (Producto + Precio Histórico)
    const { data: productId, error } = await supabase.rpc('crear_producto_con_precio', {
      p_familia_id: data.familia_id,
      p_proveedor_id: data.proveedor_id,
      p_nombre: data.nombre,
      p_unidad_medida: data.unidad_medida,
      p_factor_merma: data.factor_merma / 100,
      p_gramos_por_unidad: data.gramos_por_unidad,
      p_iva_pct: data.iva_pct,
      p_precio_neto: data.precio_neto
    })

    if (error) {
      console.error("Supabase RPC Error:", error)
      throw new Error(error.message)
    }

    const factorMermaNormalized = data.factor_merma / 100
    // Formula: Precio Total / (Cantidad Comprada * Rinde)
    const costoUnidadBase = data.precio_neto / (data.gramos_por_unidad * factorMermaNormalized)

    await supabase
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
        const { error: syncError } = await supabase.from('producto_proveedores').insert(relations)
        if (syncError) console.error("Error syncing producto_proveedores:", syncError)
      }
    }

    // Revalidar caché de servidor de las vistas que listen productos
    revalidatePath("/inventario/productos")
    
    return { success: true, data: productId }
  } catch (err: any) {
    console.error("Action error:", err)
    return { success: false, error: err.message || "Error desconocido al crear producto" }
  }
}

export async function updateProductAction(id: string, data: ProductFormData) {
  try {
    const factorMermaNormalized = data.factor_merma / 100
    
    // 1. Actualizar datos del producto
    const { error: productError } = await supabase
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



    // 2. Lógica de precio: Verificar si el precio cambió para insertar nuevo histórico
    // o si es una corrección del último registro.
    // Por ahora, para simplificar y cumplir con el requisito de "edición operativa",
    // insertamos un nuevo precio si hay cambio, o actualizamos el último si es el mismo día.
    
    // Formula: Precio Total / (Cantidad Comprada * Rinde)
    const costoUnidadBase = data.precio_neto / (data.gramos_por_unidad * factorMermaNormalized)

    // Insertar nuevo histórico (esto mantiene la trazabilidad solicitada)
    const { error: priceError } = await supabase
      .from('precios_historicos')
      .insert([{
        producto_id: id,
        precio_neto: data.precio_neto,
        costo_unidad_base: costoUnidadBase,
        iva_porcentaje: data.iva_pct
      }])

    if (priceError) throw priceError

    // Sincronizar tabla intermedia producto_proveedores
    // 1. Limpiar las relaciones viejas en la tabla intermedia (excepto la del proveedor principal activo)
    const { error: deleteError } = await supabase
      .from('producto_proveedores')
      .delete()
      .eq('producto_id', id)
      .neq('proveedor_id', data.proveedor_id)

    if (deleteError) throw deleteError

    // 2. Insertar las nuevas adicionales
    if (data.proveedores_ids && data.proveedores_ids.length > 0) {
      const additionalIds = data.proveedores_ids.filter(provId => provId !== data.proveedor_id)
      if (additionalIds.length > 0) {
        const relations = additionalIds.map(provId => ({
          producto_id: id,
          proveedor_id: provId
        }))
        const { error: syncError } = await supabase.from('producto_proveedores').insert(relations)
        if (syncError) throw syncError
      }
    }

    revalidatePath("/inventario/productos")
    revalidatePath("/inventario/catalogo")
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


