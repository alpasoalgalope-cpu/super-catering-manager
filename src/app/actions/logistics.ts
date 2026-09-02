"use server"

import { createClient } from "@/lib/supabase/server"
import { BusLogistic, DispatchLoadSheet, BusDeliveryItem } from "@/types/logistics"
import { optimizeRouteSequence } from "@/lib/routing-engine"
import { revalidatePath } from "next/cache"

const DEFAULT_ORIGIN = { lat: -34.6037, lng: -58.3816 }

/**
 * 1. Fetch Bus info by public access token (for coordinator check-in)
 * Combines both Online Store orders AND Manual Event Sales Units!
 */
export async function getBusByTokenAction(token: string): Promise<{
  success: boolean
  data?: {
    bus: BusLogistic
    breakdown: {
      tradicional: number
      vegetariano: number
      sintacc: number
      vegano: number
      water: number
      total_paid: number
      liberated_viandas: number
      liberated_water: number
      total_delivery_viandas: number
      total_delivery_water: number
    }
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    // 1. Fetch bus logistics record with event details
    const { data: bus, error: bErr } = await supabase
      .from("bus_logistics")
      .select(`
        *,
        events_master!event_master_id (
          id,
          event_date,
          show_name,
          venues (
            name,
            address,
            meeting_point
          )
        )
      `)
      .eq("token_access", token)
      .single()

    if (bErr || !bus) {
      return { success: false, error: "Token de acceso no válido o micro no encontrado." }
    }

    let trad = 0
    let veg = 0
    let stacc = 0
    let vegan = 0
    let manualLib = 0
    let manualWater = 0

    // 2. Fetch Manual Sales Units matching this bus
    const { data: headers } = await supabase
      .from("event_sales_headers")
      .select("id, company_name, event_sales_units(*)")
      .eq("event_master_id", bus.event_master_id)

    const allHeaders: any[] = headers || []
    allHeaders.forEach((h: any) => {
      if (!bus.company_name || h.company_name?.toLowerCase() === bus.company_name.toLowerCase()) {
        (h.event_sales_units || []).forEach((u: any) => {
          const match = !bus.bus_identifier || 
                        u.unit_name?.toLowerCase().includes(bus.bus_identifier.toLowerCase()) ||
                        bus.bus_identifier.toLowerCase().includes(u.unit_name?.toLowerCase()) ||
                        allHeaders.length === 1
          if (match) {
            trad += Number(u.traditional) || 0
            veg += Number(u.vegetarian) || 0
            stacc += Number(u.sin_tacc) || 0
            vegan += Number(u.vegana) || 0
            manualLib += Number(u.liberated_qty) || 0
            manualWater += Number(u.water_qty) || 0
          }
        })
      }
    })

    // 3. Fetch Online Store Orders for this bus
    const { data: orders } = await supabase
      .from("online_orders")
      .select("*")
      .eq("status", "paid")
      .or(`bus_logistic_id.eq.${bus.id},and(travel_date.eq.${bus.events_master?.event_date},bus_identifier.ilike.%${bus.bus_identifier}%)`)

    const activeOrders = orders || []
    let onlineTrad = 0
    let onlineVeg = 0
    let onlineStacc = 0
    let onlineVegan = 0

    activeOrders.forEach(o => {
      onlineTrad += Number(o.qty_tradicional) || 0
      onlineVeg += Number(o.qty_vegetariano) || 0
      onlineStacc += Number(o.qty_sintacc) || 0
      onlineVegan += Number(o.qty_vegano) || 0
    })

    trad += onlineTrad
    veg += onlineVeg
    stacc += onlineStacc
    vegan += onlineVegan

    const totalPaidViandas = trad + veg + stacc + vegan
    const company = (bus.company_name || "").toLowerCase()
    let liberatedViandas = manualLib
    let liberatedWater = 0

    // If no manual liberated, calculate from company rules
    if (liberatedViandas === 0) {
      if (company.includes("rv") || company.includes("proxima") || company.includes("próxima")) {
        liberatedViandas = totalPaidViandas >= 15 ? 3 : totalPaidViandas >= 5 ? 1 : 0
        liberatedWater = totalPaidViandas >= 25 ? 3 : 0
      } else if (company.includes("valbus")) {
        liberatedViandas = totalPaidViandas >= 5 ? 1 : 0
        liberatedWater = totalPaidViandas >= 5 ? 1 : 0
      } else if (company.includes("rock") || company.includes("terco")) {
        liberatedViandas = 2
        liberatedWater = company.includes("terco") ? 0 : 2
      }
    }

    const waterQty = company.includes("terco") 
      ? 0 
      : (manualWater > 0 ? manualWater : (totalPaidViandas + liberatedWater))

    return {
      success: true,
      data: {
        bus,
        breakdown: {
          tradicional: trad,
          vegetariano: veg,
          sintacc: stacc,
          vegano: vegan,
          water: waterQty,
          total_paid: totalPaidViandas,
          liberated_viandas: liberatedViandas,
          liberated_water: liberatedWater,
          total_delivery_viandas: totalPaidViandas + liberatedViandas,
          total_delivery_water: waterQty
        }
      }
    }
  } catch (err: any) {
    console.error("Error in getBusByTokenAction:", err)
    return { success: false, error: err.message || "Error al obtener datos del micro." }
  }
}

/**
 * 2. Check-in action performed by coordinator (sets GPS, status 'estacionado')
 */
export async function checkinBusAction(token: string, data: {
  coordinator_name: string
  coordinator_phone: string
  location_lat: number
  location_lng: number
  location_reference?: string
  pin_confirmation?: string
}) {
  try {
    const supabase = await createClient()

    const { data: updated, error } = await supabase
      .from("bus_logistics")
      .update({
        coordinator_name: data.coordinator_name.trim(),
        coordinator_phone: data.coordinator_phone.trim(),
        location_lat: data.location_lat,
        location_lng: data.location_lng,
        location_reference: data.location_reference?.trim() || null,
        pin_confirmation: data.pin_confirmation || null,
        status: "estacionado",
        checkin_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("token_access", token)
      .select()
      .single()

    if (error) throw error

    revalidatePath(`/coordi/${token}`)
    return { success: true, data: updated }
  } catch (err: any) {
    console.error("Error in checkinBusAction:", err)
    return { success: false, error: err.message || "Error al registrar el check-in." }
  }
}

/**
 * 3. Consolidate Delivery Dispatch Load Sheet & Route for the delivery van
 * Integrates BOTH Manual Sales (event_sales_headers / units) AND Online Store Orders (online_orders)!
 */
export async function getDispatchSummaryAction(eventId: string): Promise<{
  success: boolean
  data?: DispatchLoadSheet
  error?: string
}> {
  try {
    const supabase = await createClient()

    // 1. Fetch Event Master Info
    const { data: ev, error: eErr } = await supabase
      .from("events_master")
      .select("id, event_date, show_name, venues(name, address, meeting_point)")
      .eq("id", eventId)
      .single()

    if (eErr || !ev) {
      return { success: false, error: "Evento maestro no encontrado." }
    }

    // 2. Auto-sync / Ensure bus_logistics exists for this event
    await generateBusTokensForEventAction(eventId)

    // 3. Fetch all bus_logistics records for this event
    const { data: buses } = await supabase
      .from("bus_logistics")
      .select("*")
      .eq("event_master_id", eventId)
      .order("created_at", { ascending: true })

    const busList: BusLogistic[] = buses || []

    // 4. Fetch Manual Sales Headers & Units
    const { data: salesHeaders } = await supabase
      .from("event_sales_headers")
      .select("id, company_name, delivery_point, delivery_time, coordinator_name, event_sales_units(*)")
      .eq("event_master_id", eventId)

    const allSalesHeaders: any[] = salesHeaders || []

    // 5. Fetch Online Orders for this event
    const { data: storeEvents } = await supabase
      .from("online_store_events")
      .select("id")
      .eq("event_master_id", eventId)

    const storeIds = (storeEvents || []).map(s => s.id)

    const { data: onlineOrders } = await supabase
      .from("online_orders")
      .select("*")
      .eq("status", "paid")
      .in("store_event_id", storeIds.length > 0 ? storeIds : ['00000000-0000-0000-0000-000000000000'])

    const allOnlineOrders = onlineOrders || []

    // 6. Calculate breakdown per bus (combining Manual Units + Online Orders)
    const rawStops: BusDeliveryItem[] = busList.map(b => {
      let t = 0
      let v = 0
      let st = 0
      let vg = 0
      let libV = 0
      let manualW = 0
      let ordersCount = 0

      // A. Match Manual Sales Units for this bus
      allSalesHeaders.forEach((h: any) => {
        const isCompanyMatch = !b.company_name || h.company_name?.toLowerCase() === b.company_name.toLowerCase()
        if (isCompanyMatch) {
          (h.event_sales_units || []).forEach((u: any) => {
            const isBusMatch = !u.unit_name || 
                              b.bus_identifier.toLowerCase().includes(u.unit_name.toLowerCase()) ||
                              u.unit_name.toLowerCase().includes(b.bus_identifier.toLowerCase()) ||
                              (busList.length === 1 && isCompanyMatch)
            if (isBusMatch) {
              t += Number(u.traditional) || 0
              v += Number(u.vegetarian) || 0
              st += Number(u.sin_tacc) || 0
              vg += Number(u.vegana) || 0
              libV += Number(u.liberated_qty) || 0
              manualW += Number(u.water_qty) || 0
              ordersCount += 1
            }
          })
        }
      })

      // B. Match Online Store Orders for this bus
      const busOnlineOrders = allOnlineOrders.filter(
        o => o.bus_logistic_id === b.id || 
             (o.bus_identifier && b.bus_identifier && o.bus_identifier.toLowerCase().includes(b.bus_identifier.toLowerCase()))
      )

      busOnlineOrders.forEach(o => {
        t += Number(o.qty_tradicional) || 0
        v += Number(o.qty_vegetariano) || 0
        st += Number(o.qty_sintacc) || 0
        vg += Number(o.qty_vegano) || 0
        ordersCount += 1
      })

      const paidViandas = t + v + st + vg
      const company = (b.company_name || "").toLowerCase()

      // Calculate liberated if not provided manually
      let libW = 0
      if (libV === 0) {
        if (company.includes("rv") || company.includes("proxima") || company.includes("próxima")) {
          libV = paidViandas >= 15 ? 3 : paidViandas >= 5 ? 1 : 0
          libW = paidViandas >= 25 ? 3 : 0
        } else if (company.includes("valbus")) {
          libV = paidViandas >= 5 ? 1 : 0
          libW = paidViandas >= 5 ? 1 : 0
        } else if (company.includes("rock") || company.includes("terco")) {
          libV = 2
          libW = company.includes("terco") ? 0 : 2
        }
      }

      const waterQty = company.includes("terco") 
        ? 0 
        : (manualW > 0 ? manualW : (paidViandas + libW))

      return {
        logistic: b,
        breakdown: {
          tradicional: t,
          vegetariano: v,
          sintacc: st,
          vegano: vg,
          water: waterQty,
          total_paid_viandas: paidViandas,
          liberated_viandas: libV,
          liberated_water: libW,
          total_delivery_viandas: paidViandas + libV,
          total_delivery_water: waterQty
        },
        orders_count: ordersCount
      }
    })

    // 7. SMART FILTERING: Remove phantom/duplicate 0-vianda ghost buses when active buses exist
    const filteredStops = rawStops.filter(stop => {
      if (stop.breakdown.total_delivery_viandas > 0 || stop.orders_count > 0 || stop.logistic.status !== 'en_viaje') {
        return true
      }
      // If 0 viandas, only keep it if there are NO other buses with viandas in the event
      const hasAnyWithSales = rawStops.some(s => s.breakdown.total_delivery_viandas > 0 || s.orders_count > 0)
      return !hasAnyWithSales
    })

    const finalStops = filteredStops.length > 0 ? filteredStops : rawStops

    // 8. Aggregate global totals
    let totalTrad = 0
    let totalVeg = 0
    let totalStacc = 0
    let totalVegan = 0
    let totalLiberatedViandas = 0
    let totalLiberatedWater = 0
    let grandWater = 0
    let enViajeCount = 0
    let estacionadoCount = 0
    let entregadoCount = 0
    let incidenciaCount = 0

    finalStops.forEach(s => {
      const b = s.logistic
      if (b.status === "en_viaje") enViajeCount++
      else if (b.status === "estacionado") estacionadoCount++
      else if (b.status === "entregado") entregadoCount++
      else if (b.status === "incidencia") incidenciaCount++

      totalTrad += s.breakdown.tradicional
      totalVeg += s.breakdown.vegetariano
      totalStacc += s.breakdown.sintacc
      totalVegan += s.breakdown.vegano
      totalLiberatedViandas += s.breakdown.liberated_viandas
      totalLiberatedWater += s.breakdown.liberated_water
      grandWater += s.breakdown.water
    })

    // 9. Apply intelligent route sequencer
    const stopsWithCoords = finalStops.map(s => ({
      ...s,
      id: s.logistic.id,
      location_lat: s.logistic.location_lat ? Number(s.logistic.location_lat) : null,
      location_lng: s.logistic.location_lng ? Number(s.logistic.location_lng) : null
    }))

    const optimized = optimizeRouteSequence(DEFAULT_ORIGIN, stopsWithCoords)

    return {
      success: true,
      data: {
        event: {
          id: ev.id,
          show_name: ev.show_name,
          event_date: ev.event_date,
          venue_name: (ev.venues as any)?.name || "Predio / Estadio",
          meeting_point: (ev.venues as any)?.meeting_point || undefined
        },
        metrics: {
          total_buses: finalStops.length,
          buses_en_viaje: enViajeCount,
          buses_estacionados: estacionadoCount,
          buses_entregados: entregadoCount,
          buses_incidencia: incidenciaCount
        },
        totals: {
          tradicional: totalTrad,
          vegetariano: totalVeg,
          sintacc: totalStacc,
          vegano: totalVegan,
          liberated_viandas: totalLiberatedViandas,
          liberated_water: totalLiberatedWater,
          grand_total_viandas: totalTrad + totalVeg + totalStacc + totalVegan + totalLiberatedViandas,
          grand_total_water: grandWater
        },
        stops: optimized
      }
    }
  } catch (err: any) {
    console.error("Error in getDispatchSummaryAction:", err)
    return { success: false, error: err.message || "Error al obtener resumen de despacho." }
  }
}

/**
 * 4. Confirm Delivery of a Bus (marks 'entregado' + validates PIN if provided)
 */
export async function confirmDeliveryAction(busLogisticId: string, pinProvided?: string) {
  try {
    const supabase = await createClient()

    if (pinProvided) {
      const { data: bus } = await supabase
        .from("bus_logistics")
        .select("pin_confirmation")
        .eq("id", busLogisticId)
        .single()

      if (bus?.pin_confirmation && bus.pin_confirmation.trim() !== pinProvided.trim()) {
        return { success: false, error: "El PIN ingresado no coincide con el del coordinador." }
      }
    }

    const { error } = await supabase
      .from("bus_logistics")
      .update({
        status: "entregado",
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", busLogisticId)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    console.error("Error in confirmDeliveryAction:", err)
    return { success: false, error: err.message || "Error al confirmar entrega." }
  }
}

/**
 * 5. Auto-Generate / Synchronize Bus Logistic Tokens for an Event
 * Extracts unique physical buses from Sales and Planning without creating duplicates.
 */
export async function generateBusTokensForEventAction(eventId: string) {
  try {
    const supabase = await createClient()

    const [salesRes, busRes, ordersRes, evProjRes] = await Promise.all([
      supabase.from("event_sales_headers").select("id, company_name, event_sales_units(unit_name, coordinator_id, coordinators(name, phone))").eq("event_master_id", eventId),
      supabase.from("event_bus_assignments").select("*, vehicles(internal_name, client_id), coordinators(name, phone), clients(name)").eq("event_id", eventId),
      supabase.from("online_orders").select("bus_identifier, online_store_events!inner(event_master_id)").eq("online_store_events.event_master_id", eventId),
      supabase.from("event_projections").select("company_name").eq("event_id", eventId)
    ])

    const existingBusLogistics = await supabase
      .from("bus_logistics")
      .select("id, bus_identifier, company_name")
      .eq("event_master_id", eventId)

    // If buses already exist for this event, we don't need to generate generic duplicates
    if ((existingBusLogistics.data || []).length > 0) {
      return { success: true, count: 0 }
    }

    const busesToInsert: any[] = []
    const seenIdentifiers = new Set<string>()

    // Priority 1: Planning assignments (Gestión de Eventos)
    const assignments = busRes.data || []
    assignments.forEach((a: any) => {
      const vName = a.vehicles?.internal_name || "Micro"
      const company = a.clients?.name || "Empresa"
      const identifier = `${company} - ${vName}`
      if (!seenIdentifiers.has(identifier)) {
        seenIdentifiers.add(identifier)
        busesToInsert.push({
          event_master_id: eventId,
          company_name: company,
          bus_identifier: identifier,
          coordinator_name: a.coordinators?.name || null,
          coordinator_phone: a.coordinators?.phone || null,
          status: "en_viaje",
          pin_confirmation: Math.floor(1000 + Math.random() * 9000).toString(),
          token_access: `token-${eventId.slice(0, 4)}-${Math.random().toString(36).slice(2, 8)}`
        })
      }
    })

    // Priority 2: Manual sales units if not matched yet
    const salesHeaders: any[] = salesRes.data || []
    salesHeaders.forEach((h: any) => {
      const company = h.company_name || "Empresa";
      const units = h.event_sales_units || [];
      units.forEach((u: any) => {
        const uName = u.unit_name?.trim() || "Micro 1";
        const identifier = `${company} - ${uName}`;
        if (!seenIdentifiers.has(identifier) && busesToInsert.length === 0) {
          seenIdentifiers.add(identifier)
          busesToInsert.push({
            event_master_id: eventId,
            company_name: company,
            bus_identifier: identifier,
            coordinator_name: (u.coordinators as any)?.name || null,
            coordinator_phone: (u.coordinators as any)?.phone || null,
            status: "en_viaje",
            pin_confirmation: Math.floor(1000 + Math.random() * 9000).toString(),
            token_access: `token-${eventId.slice(0, 4)}-${Math.random().toString(36).slice(2, 8)}`
          })
        }
      })
    })

    // Priority 3: Fallback from Projections if no planning or sales exist
    if (busesToInsert.length === 0) {
      evProjRes.data?.forEach((p: any) => {
        const c1 = `${p.company_name} - Coche 01`
        busesToInsert.push({
          event_master_id: eventId,
          company_name: p.company_name,
          bus_identifier: c1,
          status: "en_viaje",
          pin_confirmation: Math.floor(1000 + Math.random() * 9000).toString(),
          token_access: `token-${eventId.slice(0, 4)}-${Math.random().toString(36).slice(2, 8)}`
        })
      })
    }

    if (busesToInsert.length > 0) {
      await supabase.from("bus_logistics").insert(busesToInsert)
    }

    return { success: true, count: busesToInsert.length }
  } catch (err: any) {
    console.error("Error in generateBusTokensForEventAction:", err)
    return { success: false, error: err.message }
  }
}

/**
 * 2b. Check-in action performed directly by store slug (creates or updates bus logistics seamlessly)
 */
export async function saveCoordinatorCheckinBySlugAction(data: {
  storeSlug: string
  coordinator_name: string
  coordinator_phone: string
  location_lat: number
  location_lng: number
  location_reference?: string
}) {
  try {
    const supabase = await createClient()

    // 1. Fetch store
    const { data: store, error: sErr } = await supabase
      .from("online_store_events")
      .select("id, event_master_id, title, slug")
      .eq("slug", data.storeSlug)
      .single()

    if (sErr || !store) throw new Error("Tienda de evento no encontrada.")

    const title = store.title || ""
    const parts = title.split("—").map((x: string) => x.trim())
    const companyName = parts.length > 1 ? parts[1] : title.split("-").pop()?.trim() || "Transporte"

    // 2. Check if bus_logistics exists
    const { data: existingBus } = await supabase
      .from("bus_logistics")
      .select("*")
      .eq("event_master_id", store.event_master_id)
      .ilike("company_name", `%${companyName}%`)
      .maybeSingle()

    let busResult: any

    if (existingBus) {
      const { data: updated, error: uErr } = await supabase
        .from("bus_logistics")
        .update({
          coordinator_name: data.coordinator_name.trim(),
          coordinator_phone: data.coordinator_phone.trim(),
          location_lat: data.location_lat,
          location_lng: data.location_lng,
          location_reference: data.location_reference?.trim() || null,
          status: "estacionado",
          checkin_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existingBus.id)
        .select()
        .single()

      if (uErr) throw uErr
      busResult = updated
    } else {
      const tokenAccess = "coord_" + Math.random().toString(36).substring(2, 10)
      const { data: inserted, error: iErr } = await supabase
        .from("bus_logistics")
        .insert([{
          event_master_id: store.event_master_id,
          company_name: companyName,
          bus_identifier: "Micro Principal",
          coordinator_name: data.coordinator_name.trim(),
          coordinator_phone: data.coordinator_phone.trim(),
          location_lat: data.location_lat,
          location_lng: data.location_lng,
          location_reference: data.location_reference?.trim() || null,
          status: "estacionado",
          checkin_at: new Date().toISOString(),
          token_access: tokenAccess
        }])
        .select()
        .single()

      if (iErr) throw iErr
      busResult = inserted
    }

    revalidatePath(`/tienda/${data.storeSlug}/coordinador`)
    return { success: true, data: busResult }
  } catch (err: any) {
    console.error("Error in saveCoordinatorCheckinBySlugAction:", err)
    return { success: false, error: err.message || "Error al registrar el check-in." }
  }
}

export async function updateBusStatusAction(busId: string, status: 'en_viaje' | 'estacionado' | 'entregado' | 'incidencia') {
  try {
    const supabase = await createClient()
    const { data: updated, error } = await supabase
      .from('bus_logistics')
      .update({
        status,
        delivered_at: status === 'entregado' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', busId)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/logistica-evento')
    return { success: true, data: updated }
  } catch (err: any) {
    console.error('Error in updateBusStatusAction:', err)
    return { success: false, error: err.message || 'Error al actualizar estado del micro.' }
  }
}
