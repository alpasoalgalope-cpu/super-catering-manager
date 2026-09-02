// Types for the Last-Mile Logistics, Coordinator Check-in, and Intelligent Dispatch module

export type BusLogisticStatus = 'en_viaje' | 'estacionado' | 'entregado' | 'incidencia'

export interface BusLogistic {
  id: string
  event_master_id: string
  company_id: string | null
  company_name: string | null
  bus_identifier: string
  coordinator_name: string | null
  coordinator_phone: string | null
  location_lat: number | null
  location_lng: number | null
  location_reference: string | null
  status: BusLogisticStatus
  token_access: string
  pin_confirmation: string | null
  checkin_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string

  // Joins
  events_master?: {
    id: string
    event_date: string
    show_name: string
    venues?: {
      name: string
      address?: string
      meeting_point?: string
    } | null
  }
}

export interface BusViandasBreakdown {
  tradicional: number
  vegetariano: number
  sintacc: number
  vegano: number
  water: number
  total_paid_viandas: number
  liberated_viandas: number
  liberated_water: number
  total_delivery_viandas: number
  total_delivery_water: number
}

export interface BusDeliveryItem {
  logistic: BusLogistic
  breakdown: BusViandasBreakdown
  orders_count: number
  route_order?: number
  distance_meters?: number
  duration_seconds?: number
}

export interface DispatchLoadSheet {
  event: {
    id: string
    show_name: string
    event_date: string
    venue_name: string
    meeting_point?: string
  }
  metrics: {
    total_buses: number
    buses_en_viaje: number
    buses_estacionados: number
    buses_entregados: number
    buses_incidencia: number
  }
  totals: {
    tradicional: number
    vegetariano: number
    sintacc: number
    vegano: number
    liberated_viandas: number
    liberated_water: number
    grand_total_viandas: number
    grand_total_water: number
  }
  stops: BusDeliveryItem[]
}
