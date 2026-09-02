import { supabase } from "@/lib/supabase"
import EventLogisticsPortal from "@/components/logistics/EventLogisticsPortal"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

interface Props {
  params?: {
    eventId?: string
  }
  searchParams?: {
    eventId?: string
  }
}

export default async function LogisticaEventoPage({ params, searchParams }: Props) {
  const eventId = params?.eventId || searchParams?.eventId

  if (!eventId) {
    notFound()
  }

  // 1. Fetch Event Master Info
  const { data: ev, error: eErr } = await supabase
    .from("events_master")
    .select("id, event_date, show_name, status, venues(name, address, meeting_point), event_projections(company_name, projected_pax), event_bus_assignments(coordinators(name, phone, company))")
    .eq("id", eventId)
    .single()

  if (eErr || !ev) {
    notFound()
  }

  // 2. Fetch all bus_logistics for this event
  const { data: existingBuses } = await supabase
    .from("bus_logistics")
    .select("*")
    .eq("event_master_id", eventId)

  // 3. Fetch Online Store Events and Paid Orders
  const { data: storeEvents } = await supabase
    .from("online_store_events")
    .select("id, slug, title")
    .eq("event_master_id", eventId)

  const storeIds = (storeEvents || []).map(s => s.id)
  let onlineOrders: any[] = []
  if (storeIds.length > 0) {
    const { data: orders } = await supabase
      .from("online_orders")
      .select("*, online_customers(*)")
      .in("store_event_id", storeIds)
      .eq("status", "paid")

    onlineOrders = orders || []
  }

  // 4. Fetch Manual Sales Headers and Units
  const { data: salesHeaders } = await supabase
    .from("event_sales_headers")
    .select("id, company_name, coordinator_name, event_sales_units(*)")
    .eq("event_master_id", eventId)

  // 5. Build Bus items combining Projections, Online Orders and Manual Sales
  const companyMap: Record<string, any> = {}

  // A. Seed from Projections & Existing Buses
  ev.event_projections?.forEach((p: any) => {
    const name = p.company_name?.trim() || "Empresa"
    if (!companyMap[name]) {
      companyMap[name] = {
        id: "temp_" + name,
        event_master_id: eventId,
        company_name: name,
        bus_identifier: "Micro Principal",
        coordinator_name: "",
        coordinator_phone: "",
        location_lat: null,
        location_lng: null,
        location_reference: null,
        status: "en_viaje",
        orders: [],
        breakdown: {
          tradicional: 0,
          vegetariano: 0,
          sintacc: 0,
          vegano: 0,
          water: 0,
          total_delivery_viandas: 0
        }
      }
    }
  })

  // B. Attach Existing Bus Logistics Data (GPS, status, reference)
  existingBuses?.forEach((b: any) => {
    const key = b.company_name?.trim() || "Empresa"
    if (!companyMap[key]) {
      companyMap[key] = {
        ...b,
        orders: [],
        breakdown: {
          tradicional: 0,
          vegetariano: 0,
          sintacc: 0,
          vegano: 0,
          water: 0,
          total_delivery_viandas: 0
        }
      }
    } else {
      companyMap[key] = {
        ...companyMap[key],
        ...b
      }
    }
  })

  // C. Attach Coordinators from Event Bus Assignments if not set
  ev.event_bus_assignments?.forEach((ba: any) => {
    const cObj = Array.isArray(ba.coordinators) ? ba.coordinators[0] : ba.coordinators
    const cCompany = (cObj?.company || '').toLowerCase().trim()
    if (cCompany) {
      const matchComp = Object.keys(companyMap).find(k => {
        const target = k.toLowerCase().trim()
        return target && (target === cCompany || target.includes(cCompany) || cCompany.includes(target))
      })
      if (matchComp && !companyMap[matchComp].coordinator_name) {
        companyMap[matchComp].coordinator_name = cObj.name || ""
        companyMap[matchComp].coordinator_phone = cObj.phone || ""
      }
    }
  })

  // D. Accumulate Online Orders
  onlineOrders.forEach((o: any) => {
    const store = storeEvents?.find(s => s.id === o.store_event_id)
    const title = store?.title || ""
    const parts = title.split("—").map((x: string) => x.trim())
    const compName = parts.length > 1 ? parts[1] : title.split("-").pop()?.trim() || ""

    const targetKey = Object.keys(companyMap).find(k => k.toLowerCase().includes(compName.toLowerCase()) || compName.toLowerCase().includes(k.toLowerCase())) || Object.keys(companyMap)[0]

    if (targetKey && companyMap[targetKey]) {
      companyMap[targetKey].orders.push(o)
      const bk = companyMap[targetKey].breakdown
      const qTrad = Number(o.qty_tradicional) || 0
      const qVeg = Number(o.qty_vegetariano) || 0
      const qSt = Number(o.qty_sintacc) || 0
      const qVn = Number(o.qty_vegano) || 0
      bk.tradicional += qTrad
      bk.vegetariano += qVeg
      bk.sintacc += qSt
      bk.vegano += qVn
      bk.water += (qTrad + qVeg + qSt + qVn)
      bk.total_delivery_viandas += (qTrad + qVeg + qSt + qVn)
    }
  })

  // E. Accumulate Manual Sales Units
  salesHeaders?.forEach((sh: any) => {
    const compName = sh.company_name || ""
    const targetKey = Object.keys(companyMap).find(k => k.toLowerCase().includes(compName.toLowerCase()) || compName.toLowerCase().includes(k.toLowerCase()))

    if (targetKey && companyMap[targetKey]) {
      const units = sh.event_sales_units || []
      units.forEach((u: any) => {
        const bk = companyMap[targetKey].breakdown
        const qTrad = Number(u.traditional) || 0
        const qVeg = Number(u.vegetarian) || 0
        const qSt = Number(u.sin_tacc) || 0
        const qVn = Number(u.vegana) || 0
        const qWater = Number(u.water_qty) || (u.water ? (qTrad + qVeg + qSt + qVn) : 0)

        bk.tradicional += qTrad
        bk.vegetariano += qVeg
        bk.sintacc += qSt
        bk.vegano += qVn
        bk.water += qWater
        bk.total_delivery_viandas += (qTrad + qVeg + qSt + qVn)
      })
    }
  })

  const busesList = Object.values(companyMap)

  return (
    <EventLogisticsPortal
      event={ev}
      summaryData={{}}
      initialBuses={busesList}
    />
  )
}
