"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

/**
 * Registra una merma por desperdicio/vencimiento.
 * Descuenta del stock físico y costea al último precio histórico conocido.
 */
export async function createMermaAction(data: { productoId: string, cantidad: number, motivo: string }) {
  try {
    // 1. Obtener producto y su último costo histórico
    const { data: producto } = await supabase
      .from('productos')
      .select('stock_actual, precios_historicos(costo_unidad_base)')
      .eq('id', data.productoId)
      .single()

    if (!producto) throw new Error("Producto no encontrado")

    const currentStock = Number(producto.stock_actual) || 0
    const hist = producto.precios_historicos || []
    // Suponiendo que el último insertado está al final (o tomamos el último de un array ordenado).
    // Si no está ordenado, un orderBy en la consulta sería ideal. Pero para ser seguros:
    const ultimoCostoBase = hist.length > 0 ? Number(hist[hist.length - 1].costo_unidad_base) : 0
    
    const costoTotal = ultimoCostoBase * data.cantidad

    // 2. Restar Stock
    const { error: updErr } = await supabase
      .from('productos')
      .update({ stock_actual: currentStock - data.cantidad })
      .eq('id', data.productoId)

    if (updErr) throw updErr

    // 3. Registrar Merma
    const { error: insErr } = await supabase
      .from('registro_desperdicios')
      .insert([{
        producto_id: data.productoId,
        cantidad: data.cantidad,
        motivo: data.motivo,
        costo_total: costoTotal
      }])

    if (insErr) throw insErr

    revalidatePath("/inventario/ajustes")
    revalidatePath("/inventario/stock")
    return { success: true }
  } catch (err: any) {
    console.error("Error createMermaAction:", err)
    return { success: false, error: err.message || "Error al registrar merma" }
  }
}

/**
 * Registra el consumo interno del personal (Vianda armada o Insumo suelto).
 */
export async function createConsumoAction(data: { 
  tipoConsumo: 'vianda' | 'suelto', 
  empleadoNombre: string, 
  cantidad: number, 
  itemId: string 
}) {
  try {
    let costoTotal = 0

    if (data.tipoConsumo === 'suelto') {
      // LOGICA SUELTO: Igual que la merma
      const { data: producto } = await supabase
        .from('productos')
        .select('stock_actual, precios_historicos(costo_unidad_base)')
        .eq('id', data.itemId)
        .single()

      if (!producto) throw new Error("Producto no encontrado")

      const hist = producto.precios_historicos || []
      const ultimoCostoBase = hist.length > 0 ? Number(hist[hist.length - 1].costo_unidad_base) : 0
      costoTotal = ultimoCostoBase * data.cantidad

      // Restar stock
      await supabase
        .from('productos')
        .update({ stock_actual: (Number(producto.stock_actual) || 0) - data.cantidad })
        .eq('id', data.itemId)

    } else if (data.tipoConsumo === 'vianda') {
      // LOGICA VIANDA ARMADA
      const { data: receta } = await supabase
        .from('recetas')
        .select(`
          id,
          receta_insumos (
            cantidad_necesaria,
            productos (
              id,
              stock_actual,
              familias ( nombre ),
              precios_historicos ( costo_unidad_base )
            )
          )
        `)
        .eq('id', data.itemId)
        .single()

      if (!receta || !receta.receta_insumos) throw new Error("Receta no encontrada o vacía")

      // Filtrar insumos excluyendo "Papelera"
      const insumosComestibles = receta.receta_insumos.filter((ins: any) => {
        return ins.productos?.familias?.nombre?.toLowerCase() !== 'papelera'
      })

      const updates: any[] = []

      insumosComestibles.forEach((ins: any) => {
        const prod = ins.productos
        if (!prod) return

        const qtyNeeded = ins.cantidad_necesaria * data.cantidad

        // Costeo
        const hist = prod.precios_historicos || []
        const ultimoCostoBase = hist.length > 0 ? Number(hist[hist.length - 1].costo_unidad_base) : 0
        costoTotal += (ultimoCostoBase * qtyNeeded)

        // Preparar Update de Stock
        updates.push({
          id: prod.id,
          stock_actual: (Number(prod.stock_actual) || 0) - qtyNeeded
        })
      })

      // Aplicar descuentos individuales para evitar errores de restricción NOT NULL
      if (updates.length > 0) {
        for (const update of updates) {
          const { error: updErr } = await supabase
            .from('productos')
            .update({ stock_actual: update.stock_actual })
            .eq('id', update.id)
            
          if (updErr) throw updErr
        }
      }
    }

    // Insertar Registro
    const { error: insErr } = await supabase
      .from('registro_consumos_personal')
      .insert([{
        tipo_consumo: data.tipoConsumo,
        empleado_nombre: data.empleadoNombre,
        receta_id: data.tipoConsumo === 'vianda' ? data.itemId : null,
        producto_id: data.tipoConsumo === 'suelto' ? data.itemId : null,
        cantidad: data.cantidad,
        costo_total: costoTotal
      }])

    if (insErr) throw insErr

    revalidatePath("/inventario/ajustes")
    revalidatePath("/inventario/stock")
    return { success: true }
  } catch (err: any) {
    console.error("Error createConsumoAction:", err)
    return { success: false, error: err.message || "Error al registrar consumo" }
  }
}

/**
 * Registra un ingreso de mercadería (Compra).
 * Aumenta el stock físico y actualiza el último precio histórico si se especifica.
 */
export async function createCompraAction(data: { 
  productoId: string, 
  proveedorId?: string, 
  cantidad: number, 
  costoUnidad?: number,
  observaciones?: string
}) {
  try {
    // 1. Obtener stock actual
    const { data: producto } = await supabase
      .from('productos')
      .select('stock_actual, nombre, factor_merma')
      .eq('id', data.productoId)
      .single()

    if (!producto) throw new Error("Producto no encontrado")

    const newStock = (Number(producto.stock_actual) || 0) + data.cantidad

    // 2. Aumentar Stock
    const { error: updErr } = await supabase
      .from('productos')
      .update({ stock_actual: newStock })
      .eq('id', data.productoId)

    if (updErr) throw updErr

    // 3. Si se pasó costo, actualizar precios_historicos factoring rinde/merma
    if (data.costoUnidad && data.costoUnidad > 0) {
       const rinde = Number(producto.factor_merma) || 1.0
       const costoReal = data.costoUnidad / rinde
       
       await supabase.from('precios_historicos').insert([{
          producto_id: data.productoId,
          costo_unidad_base: costoReal,
          fecha: new Date().toISOString()
       }])
    }

    // 4. Registrar Compra
    const { error: insErr } = await supabase
      .from('registro_compras')
      .insert([{
        producto_id: data.productoId,
        proveedor_id: data.proveedorId || null,
        cantidad: data.cantidad,
        costo_unidad: data.costoUnidad || 0,
        total_compra: (data.costoUnidad || 0) * data.cantidad,
        observaciones: data.observaciones || ""
      }])

    if (insErr) {
       console.error("Error inserting registro_compras:", insErr)
    }

    revalidatePath("/inventario/ajustes")
    revalidatePath("/inventario/stock")
    return { success: true }
  } catch (err: any) {
    console.error("Error createCompraAction:", err)
    return { success: false, error: err.message || "Error al registrar compra" }
  }
}

/**
 * Actualiza un ingreso de mercadería (Compra) existente.
 * Ajusta la diferencia de stock físico y actualiza el registro.
 */
export async function updateCompraAction(compraId: string, data: { 
  productoId: string, 
  proveedorId?: string, 
  cantidad: number, 
  costoTotal?: number,
  costoUnidad?: number,
  observaciones?: string
}) {
  try {
    // 1. Obtener registro de compra anterior
    const { data: oldCompra } = await supabase
      .from('registro_compras')
      .select('*')
      .eq('id', compraId)
      .single()

    if (!oldCompra) throw new Error("Registro de compra no encontrado")

    // Si el producto cambió, es más complejo (hay que restar del viejo y sumar al nuevo).
    // Asumiremos por ahora que el producto no cambia o si cambia lo manejamos:
    if (oldCompra.producto_id !== data.productoId) {
      // Revertir stock del viejo
      const { data: oldProd } = await supabase.from('productos').select('stock_actual').eq('id', oldCompra.producto_id).single()
      if (oldProd) {
        await supabase.from('productos').update({ stock_actual: (Number(oldProd.stock_actual) || 0) - oldCompra.cantidad }).eq('id', oldCompra.producto_id)
      }
      // Sumar al nuevo
      const { data: newProd } = await supabase.from('productos').select('stock_actual').eq('id', data.productoId).single()
      if (newProd) {
        await supabase.from('productos').update({ stock_actual: (Number(newProd.stock_actual) || 0) + data.cantidad }).eq('id', data.productoId)
      }
    } else {
      // Mismo producto, aplicar delta
      const delta = data.cantidad - oldCompra.cantidad
      if (delta !== 0) {
        const { data: prod } = await supabase.from('productos').select('stock_actual').eq('id', data.productoId).single()
        if (prod) {
          await supabase.from('productos').update({ stock_actual: (Number(prod.stock_actual) || 0) + delta }).eq('id', data.productoId)
        }
      }
    }

    // 2. Actualizar registro de compra
    const { error: updErr } = await supabase
      .from('registro_compras')
      .update({
        producto_id: data.productoId,
        proveedor_id: data.proveedorId || null,
        cantidad: data.cantidad,
        costo_unidad: data.costoUnidad || 0,
        total_compra: data.costoTotal || 0,
        observaciones: data.observaciones || ""
      })
      .eq('id', compraId)

    if (updErr) throw updErr

    // 3. Si se pasó costo, insertar/actualizar precios_historicos factoring rinde/merma
    if (data.costoUnidad && data.costoUnidad > 0) {
       const { data: prod } = await supabase.from('productos').select('factor_merma').eq('id', data.productoId).single()
       const rinde = Number(prod?.factor_merma) || 1.0
       const costoReal = data.costoUnidad / rinde

       await supabase.from('precios_historicos').insert([{
          producto_id: data.productoId,
          costo_unidad_base: costoReal,
          fecha: new Date().toISOString()
       }])
    }

    revalidatePath("/inventario/ajustes")
    revalidatePath("/inventario/stock")
    return { success: true }
  } catch (err: any) {
    console.error("Error updateCompraAction:", err)
    return { success: false, error: err.message || "Error al actualizar compra" }
  }
}
