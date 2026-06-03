"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function getEventProfitability(eventId: string) {
  try {
    // 1. Fetch logistics_cost and extras_cost from events_master
    const { data: master } = await supabase
      .from('events_master')
      .select('logistics_cost, extras_cost, commissions_cost, status')
      .eq('id', eventId)
      .single()

    const logistics_cost = master ? Number(master.logistics_cost) || 0 : 0
    const extras_cost = master ? Number(master.extras_cost) || 0 : 0
    const commissions_cost = master ? Number(master.commissions_cost) || 0 : 0

    // 1.5 Fetch frozen costs if event is ejecutado
    const { data: frozenCosts } = await supabase
      .from('event_recipe_costs')
      .select('*')
      .eq('event_id', eventId)

    const hasFrozen = frozenCosts && frozenCosts.length > 0

    // 2. Fetch sales headers to get facturación total
    const { data: headers, error: hErr } = await supabase
      .from('event_sales_headers')
      .select('id, total_amount')
      .or(`event_id.eq.${eventId},event_master_id.eq.${eventId}`)
    
    if (hErr) throw hErr

    const facturacion = (headers || []).reduce((acc, h) => acc + (Number(h.total_amount) || 0), 0)
    const headerIds = headers?.map(h => h.id) || []

    let escandalloNeto = 0
    let escandalloBruto = 0
    let totalUnidades = 0

    if (headerIds.length > 0) {
      // 3. Fetch sales units
      const { data: units, error: uErr } = await supabase
        .from('event_sales_units')
        .select('traditional, vegetarian, vegana, sin_tacc, water_qty, water, recipe_trad_id, recipe_veg_id, recipe_vegan_id, recipe_sintacc_id, event_sales_headers(company_name)')
        .in('header_id', headerIds)

      if (uErr) throw uErr

      // 4. If not frozen, we need to calculate recipe costs from scratch
      const recipeCostMap: Record<string, { net: number, gross: number }> = {}
      let waterCostNet = 0
      let waterCostGross = 0

      if (hasFrozen) {
        frozenCosts.forEach(fc => {
          if (fc.recipe_id) {
            recipeCostMap[fc.recipe_id] = { net: Number(fc.cost_net), gross: Number(fc.cost_gross) }
          } else {
            // Water cost is stored without recipe_id (null)
            waterCostNet = Number(fc.cost_net)
            waterCostGross = Number(fc.cost_gross)
          }
        })
      } else {
        // Calculate manually
        const { data: recetas } = await supabase
          .from('recetas')
          .select(`
            id,
            receta_insumos (
              cantidad_necesaria,
              productos (
                iva_pct,
                precios_historicos ( costo_unidad_base, fecha_desde )
              )
            )
          `)

        const { data: waterProd } = await supabase
          .from('productos')
          .select('iva_pct, precios_historicos(costo_unidad_base, fecha_desde)')
          .eq('id', '2e452d5b-9d90-47a7-ae2e-134cc55ef7bd')
          .single()

        const getLatestCost = (hist: any[]) => {
          if (!hist || hist.length === 0) return 0
          const sorted = [...hist].sort((a, b) => new Date(b.fecha_desde).getTime() - new Date(a.fecha_desde).getTime())
          return Number(sorted[0].costo_unidad_base) || 0
        }

        waterCostNet = getLatestCost(waterProd?.precios_historicos || [])
        const waterIva = Number(waterProd?.iva_pct) || 21
        waterCostGross = waterCostNet * (1 + waterIva / 100)

        recetas?.forEach(r => {
          let net = 0
          let gross = 0
          if (r.receta_insumos) {
            for (const ins of r.receta_insumos as any[]) {
              const prod = ins.productos
              const costNet = getLatestCost(prod?.precios_historicos || [])
              const iva = Number(prod?.iva_pct) || 21
              const qty = Number(ins.cantidad_necesaria) || 0
              net += qty * costNet
              gross += qty * costNet * (1 + iva / 100)
            }
          }
          recipeCostMap[r.id] = { net, gross }
        })
      }

      // 5. Calculate total escandallo using the map
      const { data: rules } = await supabase.from('commercial_rules').select('*')
      const rulesMap: Record<string, any> = {}
      rules?.forEach(r => { rulesMap[r.company_name.toLowerCase()] = r })

      if (units) {
        for (const u of units) {
          totalUnidades += (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0)
          const company = (u.event_sales_headers as any)?.company_name?.toLowerCase() || ""
          const rule = rulesMap[company]
          const rTrad = u.recipe_trad_id || rule?.recipe_trad_id
          const rVeg = u.recipe_veg_id || rule?.recipe_veg_id
          const rVegan = u.recipe_vegan_id || rule?.recipe_vegan_id
          const rSintacc = u.recipe_sintacc_id || rule?.recipe_sintacc_id

          if (u.traditional > 0 && rTrad) {
            escandalloNeto += (Number(u.traditional) * (recipeCostMap[rTrad]?.net || 0))
            escandalloBruto += (Number(u.traditional) * (recipeCostMap[rTrad]?.gross || 0))
          }
          if (u.vegetarian > 0 && rVeg) {
            escandalloNeto += (Number(u.vegetarian) * (recipeCostMap[rVeg]?.net || 0))
            escandalloBruto += (Number(u.vegetarian) * (recipeCostMap[rVeg]?.gross || 0))
          }
          if (u.vegana > 0 && rVegan) {
            escandalloNeto += (Number(u.vegana) * (recipeCostMap[rVegan]?.net || 0))
            escandalloBruto += (Number(u.vegana) * (recipeCostMap[rVegan]?.gross || 0))
          }
          if (u.sin_tacc > 0 && rSintacc) {
            escandalloNeto += (Number(u.sin_tacc) * (recipeCostMap[rSintacc]?.net || 0))
            escandalloBruto += (Number(u.sin_tacc) * (recipeCostMap[rSintacc]?.gross || 0))
          }
          const wQty = Number(u.water_qty || u.water || 0)
          escandalloNeto += wQty * waterCostNet
          escandalloBruto += wQty * waterCostGross
        }
      }
    }

    return {
      success: true,
      data: {
        facturacion,
        escandallo: escandalloBruto, // Return Gross as it's more likely what user expects for "Total Expenses"
        escandalloNeto,
        logistics_cost,
        extras_cost,
        commissions_cost,
        totalUnidades,
        rentabilidad: facturacion - escandalloBruto - logistics_cost - extras_cost - commissions_cost
      }
    }
  } catch (err: any) {
    console.error("Error in getEventProfitability:", err)
    return { success: false, error: err.message }
  }
}

export async function updateEventMasterAction(eventId: string, edits: any) {
  try {
    const { error } = await supabase
      .from('events_master')
      .update(edits)
      .eq('id', eventId)

    if (error) throw error

    // If status changed to ejecutado, freeze costs
    if (edits.status?.toLowerCase() === 'ejecutado') {
      await freezeEventCostsAction(eventId)
    }

    // Sync automatic cash flow entries for logistics/extras
    await syncEventCashMovements(eventId)

    revalidatePath("/settings/eventos")
    return { success: true }
  } catch (err: any) {
    console.error("Error updating event master:", err)
    return { success: false, error: err.message }
  }
}

export async function syncEventCashMovements(eventId: string) {
  try {
    // 1. Fetch latest event details
    const { data: event, error: eErr } = await supabase
      .from('events_master')
      .select('event_date, show_name, logistics_cost, extras_cost, status')
      .eq('id', eventId)
      .single()

    if (eErr || !event) {
      console.error("Error fetching event for cash sync:", eErr)
      return
    }

    const eventDate = event.event_date
    const showName = event.show_name || 'Evento S/D'
    const logCost = Number(event.logistics_cost) || 0
    const extCost = Number(event.extras_cost) || 0
    const isEjecutado = event.status?.toLowerCase().includes('ejecutado')

    const logHash = `event-logistics-${eventId}`
    const extHash = `event-extras-${eventId}`

    // Si el evento NO está ejecutado, remover cualquier movimiento automático (solo impacta real al ejecutarse)
    if (!isEjecutado) {
      await supabase.from('cash_movements').delete().in('hash_id', [logHash, extHash])
      return
    }

    // Helper functions inside (reused from finances.ts)
    const getMonthNameFormatted = (dateStr: string) => {
      const date = new Date(dateStr + 'T12:00:00')
      const monthNum = date.getMonth() + 1
      const monthStr = monthNum.toString().padStart(2, '0')
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      return `${monthStr}. ${monthNames[monthNum - 1]}`
    }

    const getWeekNumber = (dateStr: string) => {
      const date = new Date(dateStr + 'T12:00:00')
      const day = date.getDate()
      if (day <= 7) return "1"
      if (day <= 14) return "2"
      if (day <= 21) return "3"
      return "4"
    }

    const mes = getMonthNameFormatted(eventDate)
    const semana = getWeekNumber(eventDate)

    // Sync Logistics Cost to Cash Book
    if (logCost > 0) {
      const logRow = {
        sucursal: 'Galope Bustamante',
        mes,
        fecha: eventDate,
        semana,
        turno: 'T1',
        tipo: 'Egreso',
        concepto: 'Estructura',
        cod_cga: 'EVENTO',
        conc_caja: 'Logística',
        detalle: `Logística: ${showName}`,
        importe: -Math.abs(logCost),
        esrecu: 'N',
        oculta: 'N',
        rubro: 'Gastos',
        hash_id: logHash
      }
      await supabase.from('cash_movements').upsert([logRow], { onConflict: 'hash_id' })
    } else {
      await supabase.from('cash_movements').delete().eq('hash_id', logHash)
    }

    // Sync Extras Cost to Cash Book
    if (extCost > 0) {
      const extRow = {
        sucursal: 'Galope Bustamante',
        mes,
        fecha: eventDate,
        semana,
        turno: 'T1',
        tipo: 'Egreso',
        concepto: 'Estructura',
        cod_cga: 'EVENTO',
        conc_caja: 'Extras',
        detalle: `Extras: ${showName}`,
        importe: -Math.abs(extCost),
        esrecu: 'N',
        oculta: 'N',
        rubro: 'Gastos',
        hash_id: extHash
      }
      await supabase.from('cash_movements').upsert([extRow], { onConflict: 'hash_id' })
    } else {
      await supabase.from('cash_movements').delete().eq('hash_id', extHash)
    }

  } catch (err: any) {
    console.error("Error syncing event cash movements:", err)
  }
}

export async function freezeEventCostsAction(eventId: string) {
  try {
    // 1. Calculate all current recipe costs
    const { data: recetas } = await supabase
      .from('recetas')
      .select(`
        id,
        receta_insumos (
          cantidad_necesaria,
          productos (
            iva_pct,
            precios_historicos ( costo_unidad_base, fecha_desde )
          )
        )
      `)

    const { data: waterProd } = await supabase
      .from('productos')
      .select('iva_pct, precios_historicos(costo_unidad_base, fecha_desde)')
      .eq('id', '2e452d5b-9d90-47a7-ae2e-134cc55ef7bd')
      .single()

    const getLatestCost = (hist: any[]) => {
      if (!hist || hist.length === 0) return 0
      const sorted = [...hist].sort((a, b) => new Date(b.fecha_desde).getTime() - new Date(a.fecha_desde).getTime())
      return Number(sorted[0].costo_unidad_base) || 0
    }

    const waterCostNet = getLatestCost(waterProd?.precios_historicos || [])
    const waterIva = Number(waterProd?.iva_pct) || 21
    const waterCostGross = waterCostNet * (1 + waterIva / 100)

    const frozenRows = []

    // Add recipes
    recetas?.forEach(r => {
      let net = 0
      let gross = 0
      if (r.receta_insumos) {
        for (const ins of r.receta_insumos as any[]) {
          const prod = ins.productos
          const costNet = getLatestCost(prod?.precios_historicos || [])
          const iva = Number(prod?.iva_pct) || 21
          const qty = Number(ins.cantidad_necesaria) || 0
          net += qty * costNet
          gross += qty * costNet * (1 + iva / 100)
        }
      }
      frozenRows.push({
        event_id: eventId,
        recipe_id: r.id,
        cost_net: net,
        cost_gross: gross
      })
    })

    // Add water (recipe_id = null)
    frozenRows.push({
      event_id: eventId,
      recipe_id: null,
      cost_net: waterCostNet,
      cost_gross: waterCostGross
    })

    // 2. Upsert into event_recipe_costs
    const { error } = await supabase
      .from('event_recipe_costs')
      .upsert(frozenRows, { onConflict: 'event_id, recipe_id' })

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error("Error freezing costs:", err)
    return { success: false, error: err.message }
  }
}
