"use server"

import { createClient } from "@/lib/supabase/server"
import { OnlineStoreEvent, OnlineOrder, OnlineCustomer, OnlineOrdersSummary } from "@/types/online-sales"

// ============================================================
// STORE EVENTS
// ============================================================

export async function createStoreEventAction(data: {
  event_master_id: string
  slug: string
  title: string
  subtitle?: string
  description?: string
  banner_image_url?: string
  available_dates: string[]
  sales_deadline?: string
  combo_trad_enabled?: boolean
  combo_trad_price: number
  combo_trad_name?: string
  combo_trad_desc?: string
  combo_veg_enabled?: boolean
  combo_veg_price: number
  combo_veg_name?: string
  combo_veg_desc?: string
  combo_sintacc_enabled?: boolean
  combo_sintacc_price: number
  combo_sintacc_name?: string
  combo_sintacc_desc?: string
  combo_vegan_enabled?: boolean
  combo_vegan_price?: number
  combo_vegan_name?: string
  combo_vegan_desc?: string
  commercial_rule_id?: string
}) {
  const supabase = await createClient()
  
  // Check if store already exists with this slug
  const { data: existing } = await supabase
    .from("online_store_events")
    .select("*")
    .eq("slug", data.slug)
    .maybeSingle()

  if (existing) {
    const { data: updated, error: uErr } = await supabase
      .from("online_store_events")
      .update({
        ...data,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (uErr) return { success: false, error: uErr.message }
    return { success: true, data: updated }
  }

  const { data: store, error } = await supabase
    .from("online_store_events")
    .insert([{ ...data, is_active: true }])
    .select()
    .single()
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: store }
}

export async function updateStoreEventAction(
  storeId: string,
  data: Partial<OnlineStoreEvent>
) {
  const supabase = await createClient()
  
  const { id, created_at, updated_at, events_master, ...updateData } = data as any
  
  const { data: updated, error } = await supabase
    .from("online_store_events")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", storeId)
    .select("*, events_master(id, event_date, show_name, status, venues(name))")
    .single()
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: updated }
}

export async function toggleStoreActiveAction(storeId: string, isActive: boolean) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("online_store_events")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", storeId)
  
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function getStoreBySlugAction(slug: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("online_store_events")
    .select("*, events_master(id, event_date, show_name, status, venues(name))")
    .eq("slug", slug)
    .eq("is_active", true)
    .single()
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function getStoreEventsAction() {
  const supabase = await createClient()
  
  // Auto-create stores for any confirmed events that don't have one yet
  await autoSyncStoresForConfirmedEventsAction()

  const { data, error } = await supabase
    .from("online_store_events")
    .select("*, events_master(id, event_date, show_name, status, venues(name))")
    .order("created_at", { ascending: false })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: data || [] }
}

function slugify(text: string) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

export async function autoSyncStoresForConfirmedEventsAction() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Fetch confirmed events from today onwards with projections and venue
  const { data: events, error: evErr } = await supabase
    .from("events_master")
    .select("id, event_date, show_name, status, venues(name), event_projections(company_name)")
    .ilike("status", "confirmado")
    .gte("event_date", today)

  if (evErr || !events) return { success: false, error: evErr?.message }

  // 2. Fetch existing stores
  const { data: existingStores } = await supabase
    .from("online_store_events")
    .select("id, event_master_id, slug, title")

  // 3. Fetch commercial rules and clients for price and sale_type lookups
  const [{ data: rules }, { data: clients }] = await Promise.all([
    supabase.from("commercial_rules").select("*"),
    supabase.from("clients").select("id, name, sale_type")
  ])

  const existingSlugs = new Set((existingStores || []).map(s => s.slug))

  let createdCount = 0

  for (const event of events) {
    const venueName = (event as any).venues?.name || ""
    const showName = event.show_name || "Evento"
    const eventDate = event.event_date
    const projections = (event as any).event_projections || []

    const getPricesForCompany = (compName?: string) => {
      const rule = (rules || []).find(r => 
        r.company_name && compName && r.company_name.toLowerCase().trim() === compName.toLowerCase().trim()
      )
      const basePrice = Number(rule?.price_base) || 10000
      const sintaccPrice = Number(rule?.price_sintacc_base) || basePrice || 12000

      return {
        trad: basePrice,
        veg: basePrice,
        vegan: basePrice,
        sintacc: sintaccPrice,
        ruleId: rule?.id || null
      }
    }

    if (projections.length > 0) {
      for (const proj of projections) {
        const company = proj.company_name || ""
        if (!company) continue

        // Check if company has sale_type = 'mayorista' -> Skip online store creation!
        const client = (clients || []).find(c => 
          c.name && c.name.toLowerCase().trim() === company.toLowerCase().trim()
        )
        if (client?.sale_type?.toLowerCase() === 'mayorista') {
          continue
        }

        const rawSlug = `${slugify(showName)}-${slugify(company)}-${eventDate}`
        if (existingSlugs.has(rawSlug)) continue

        const prices = getPricesForCompany(company)

        const storeData = {
          event_master_id: event.id,
          slug: rawSlug,
          title: `${showName} - ${company}`,
          subtitle: venueName ? `Venue: ${venueName}` : "Cena de Regreso",
          description: `Viandas oficiales para el regreso del show ${showName}. Reservá tu combo directamente con tarjeta o dinero en cuenta.`,
          is_active: true,
          available_dates: [eventDate],
          combo_trad_enabled: true,
          combo_trad_price: prices.trad,
          combo_trad_name: "Combo Tradicional + Agua sin Gas",
          combo_trad_desc: "Sándwich Gigante de Jamón y Queso en pan Ciabatta de manteca fresco del día + Agua Mineral.",
          combo_veg_enabled: true,
          combo_veg_price: prices.veg,
          combo_veg_name: "Combo Vegetariano + Agua sin Gas",
          combo_veg_desc: "Sándwich en Ciabatta de Manteca de Queso, Huevo, Lechuga y Tomate + Agua Mineral.",
          combo_sintacc_enabled: true,
          combo_sintacc_price: prices.sintacc,
          combo_sintacc_name: "Combo Sin TACC + Agua sin Gas",
          combo_sintacc_desc: "Árabe de Jamón y Queso envasado al vacío (Apto Celíacos) + Agua Mineral.",
          combo_vegan_enabled: true,
          combo_vegan_price: prices.vegan,
          combo_vegan_name: "Combo Vegano + Agua sin Gas",
          combo_vegan_desc: "Sándwich Vegano en Ciabatta con vegetales asados y aderezos vegetales + Agua Mineral.",
          commercial_rule_id: prices.ruleId
        }

        const { error: insErr } = await supabase.from("online_store_events").insert([storeData])
        if (!insErr) {
          existingSlugs.add(rawSlug)
          createdCount++
        }
      }
    } else {
      const rawSlug = `${slugify(showName)}-${eventDate}`
      if (!existingSlugs.has(rawSlug)) {
        const prices = getPricesForCompany()

        const storeData = {
          event_master_id: event.id,
          slug: rawSlug,
          title: showName,
          subtitle: venueName ? `Venue: ${venueName}` : "Cena de Regreso",
          description: `Viandas oficiales para el regreso del show ${showName}. Reservá tu combo directamente con tarjeta o dinero en cuenta.`,
          is_active: true,
          available_dates: [eventDate],
          combo_trad_enabled: true,
          combo_trad_price: prices.trad,
          combo_trad_name: "Combo Tradicional + Agua sin Gas",
          combo_trad_desc: "Sándwich Gigante de Jamón y Queso en pan Ciabatta de manteca fresco del día + Agua Mineral.",
          combo_veg_enabled: true,
          combo_veg_price: prices.veg,
          combo_veg_name: "Combo Vegetariano + Agua sin Gas",
          combo_veg_desc: "Sándwich en Ciabatta de Manteca de Queso, Huevo, Lechuga y Tomate + Agua Mineral.",
          combo_sintacc_enabled: true,
          combo_sintacc_price: prices.sintacc,
          combo_sintacc_name: "Combo Sin TACC + Agua sin Gas",
          combo_sintacc_desc: "Árabe de Jamón y Queso envasado al vacío (Apto Celíacos) + Agua Mineral.",
          combo_vegan_enabled: true,
          combo_vegan_price: prices.vegan,
          combo_vegan_name: "Combo Vegano + Agua sin Gas",
          combo_vegan_desc: "Sándwich Vegano en Ciabatta con vegetales asados y aderezos vegetales + Agua Mineral.",
          commercial_rule_id: prices.ruleId
        }

        const { error: insErr } = await supabase.from("online_store_events").insert([storeData])
        if (!insErr) {
          existingSlugs.add(rawSlug)
          createdCount++
        }
      }
    }
  }

  return { success: true, createdCount }
}

export async function deleteStoreEventAction(storeId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("online_store_events")
    .delete()
    .eq("id", storeId)
  
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// CUSTOMERS
// ============================================================

export async function upsertCustomerAction(data: {
  email: string
  full_name: string
  phone?: string
}) {
  const supabase = await createClient()
  
  // Try to find existing customer by email
  const { data: existing } = await supabase
    .from("online_customers")
    .select("*")
    .eq("email", data.email.toLowerCase().trim())
    .single()
  
  if (existing) {
    // Update name/phone if provided
    const { error } = await supabase
      .from("online_customers")
      .update({
        full_name: data.full_name,
        phone: data.phone || existing.phone,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
    
    if (error) return { success: false, error: error.message }
    return { success: true, data: { ...existing, full_name: data.full_name, phone: data.phone || existing.phone } }
  }
  
  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from("online_customers")
    .insert([{
      email: data.email.toLowerCase().trim(),
      full_name: data.full_name,
      phone: data.phone || null
    }])
    .select()
    .single()
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: newCustomer }
}

// ============================================================
// ORDERS
// ============================================================

export async function createOrderAction(data: {
  store_event_id: string
  customer_id: string
  travel_date: string
  bus_identifier?: string
  qty_tradicional: number
  qty_vegetariano: number
  qty_sintacc: number
  qty_vegano: number
  price_trad_unit: number
  price_veg_unit: number
  price_sintacc_unit: number
  price_vegan_unit: number
  total_amount: number
}) {
  const supabase = await createClient()
  
  const { data: order, error } = await supabase
    .from("online_orders")
    .insert([{
      ...data,
      status: 'pending_payment',
      mp_status: 'pending'
    }])
    .select()
    .single()
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: order }
}

export async function updateOrderMPAction(
  orderId: string,
  mpData: {
    mp_preference_id?: string
    mp_payment_id?: string
    mp_status?: string
    mp_detail?: string
    status?: string
  }
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("online_orders")
    .update({
      ...mpData,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
  
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function getOrdersByStoreAction(storeEventId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("online_orders")
    .select("*, online_customers(*), online_store_events(title, slug)")
    .eq("store_event_id", storeEventId)
    .order("created_at", { ascending: false })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: data || [] }
}

export async function getAllOnlineOrdersAction() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("online_orders")
    .select("*, online_customers(*), online_store_events(title, slug, event_master_id, events_master(show_name, event_date))")
    .order("created_at", { ascending: false })
    .limit(500)
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: data || [] }
}

export async function getOrdersSummaryAction(storeEventId: string): Promise<{ success: boolean, data?: OnlineOrdersSummary, error?: string }> {
  const supabase = await createClient()
  
  const { data: orders, error } = await supabase
    .from("online_orders")
    .select("*")
    .eq("store_event_id", storeEventId)
  
  if (error) return { success: false, error: error.message }
  
  const paid = (orders || []).filter(o => o.status === 'paid')
  const pending = (orders || []).filter(o => o.status === 'pending_payment')
  const cancelled = (orders || []).filter(o => o.status === 'cancelled' || o.status === 'refunded')
  
  const summary: OnlineOrdersSummary = {
    total_orders: (orders || []).length,
    total_paid: paid.length,
    total_pending: pending.length,
    total_cancelled: cancelled.length,
    total_revenue: paid.reduce((acc, o) => acc + Number(o.total_amount), 0),
    total_trad: paid.reduce((acc, o) => acc + (o.qty_tradicional || 0), 0),
    total_veg: paid.reduce((acc, o) => acc + (o.qty_vegetariano || 0), 0),
    total_sintacc: paid.reduce((acc, o) => acc + (o.qty_sintacc || 0), 0),
    total_vegan: paid.reduce((acc, o) => acc + (o.qty_vegano || 0), 0),
    orders_by_date: {},
    orders_by_bus: {}
  }
  
  paid.forEach(o => {
    const date = o.travel_date
    summary.orders_by_date[date] = (summary.orders_by_date[date] || 0) + 1
    
    const bus = o.bus_identifier || 'Sin especificar'
    summary.orders_by_bus[bus] = (summary.orders_by_bus[bus] || 0) + 1
  })
  
  return { success: true, data: summary }
}

// ============================================================
// CUSTOMERS LIST (for dashboard)
// ============================================================

export async function getAllCustomersAction() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("online_customers")
    .select("*")
    .order("last_order_at", { ascending: false })
    .limit(500)
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: data || [] }
}

export async function getEventsForStoreCreation() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("events_master")
    .select("id, event_date, show_name, status, venues(name)")
    .order("event_date", { ascending: false })
    .limit(50)
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: data || [] }
}

// ============================================================
// AUTO-SYNC PRICES TO FUTURE STORES (> TODAY)
// ============================================================

export async function syncClientPricesToFutureStoresAction(
  companyName: string,
  viandaPrice?: number | null,
  sintaccPrice?: number | null
) {
  try {
    if (!companyName || viandaPrice == null) return { success: false, count: 0 }

    const supabase = await createClient()
    const today = new Date().toISOString().split("T")[0]

    // Fetch all active online store events with their event_master date
    const { data: stores, error } = await supabase
      .from("online_store_events")
      .select("id, slug, title, available_dates, events_master!event_master_id(event_date)")
      .eq("is_active", true)

    if (error || !stores) return { success: false, error: error?.message }

    const compNorm = companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")

    const matchingFutureStoreIds: string[] = []

    stores.forEach((s: any) => {
      const sSlug = (s.slug || "").toLowerCase()
      const sTitle = (s.title || "").toLowerCase()
      const isCompanyMatch = sSlug.includes(compNorm) || sTitle.includes(companyName.toLowerCase())

      if (isCompanyMatch) {
        // Check if event date is strictly in the future (> today)
        const eventDate = s.available_dates?.[0] || s.events_master?.event_date
        if (eventDate && eventDate > today) {
          matchingFutureStoreIds.push(s.id)
        }
      }
    })

    if (matchingFutureStoreIds.length > 0) {
      const base = Number(viandaPrice)
      const st = sintaccPrice != null ? Number(sintaccPrice) : base

      await supabase
        .from("online_store_events")
        .update({
          combo_trad_price: base,
          combo_veg_price: base,
          combo_sintacc_price: st,
          combo_vegan_price: base,
          updated_at: new Date().toISOString()
        })
        .in("id", matchingFutureStoreIds)
    }

    return { success: true, count: matchingFutureStoreIds.length }
  } catch (err: any) {
    console.error("Error syncing client prices to stores:", err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// CANCEL ORDERS
// ============================================================

export async function cancelOnlineOrderAction(orderId: string) {
  try {
    const supabase = await createClient()

    const { data: order, error } = await supabase
      .from("online_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select("*, online_customers(email, full_name), online_store_events(title)")
      .single()

    if (error) throw error

    console.log(`[Notification] Order ${orderId} marked as cancelled for ${order?.online_customers?.email || 'customer'}`)

    return { success: true, data: order }
  } catch (err: any) {
    console.error("Error cancelling order:", err)
    return { success: false, error: err.message }
  }
}

export async function cancelAllPendingOrdersAction() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("online_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("status", "pending_payment")
      .select()

    if (error) throw error

    return { success: true, count: data?.length || 0 }
  } catch (err: any) {
    console.error("Error cancelling all pending orders:", err)
    return { success: false, error: err.message }
  }
}
