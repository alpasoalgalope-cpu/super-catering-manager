// Types for the Online Sales Module (Tienda Online + Mercado Pago)

export interface OnlineCustomer {
  id: string
  email: string
  full_name: string
  phone: string | null
  dni: string | null
  city: string | null
  notes: string | null
  total_orders: number
  total_spent: number
  first_order_at: string | null
  last_order_at: string | null
  created_at: string
  updated_at: string
}

export interface OnlineStoreEvent {
  id: string
  event_master_id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  banner_image_url: string | null
  is_active: boolean
  sales_deadline: string | null
  available_dates: string[]

  // Combos
  combo_trad_enabled: boolean
  combo_trad_price: number
  combo_trad_name: string
  combo_trad_desc: string | null

  combo_veg_enabled: boolean
  combo_veg_price: number
  combo_veg_name: string
  combo_veg_desc: string | null

  combo_sintacc_enabled: boolean
  combo_sintacc_price: number
  combo_sintacc_name: string
  combo_sintacc_desc: string | null

  combo_vegan_enabled: boolean
  combo_vegan_price: number
  combo_vegan_name: string
  combo_vegan_desc: string | null

  commercial_rule_id: string | null
  created_at: string
  updated_at: string

  // Joins
  events_master?: {
    id: string
    event_date: string
    show_name: string
    status: string
    venues?: { name: string } | null
  }
}

export interface OnlineOrder {
  id: string
  store_event_id: string
  customer_id: string
  travel_date: string
  bus_identifier: string | null

  qty_tradicional: number
  qty_vegetariano: number
  qty_sintacc: number
  qty_vegano: number

  price_trad_unit: number
  price_veg_unit: number
  price_sintacc_unit: number
  price_vegan_unit: number

  total_amount: number

  mp_preference_id: string | null
  mp_payment_id: string | null
  mp_status: string | null
  mp_detail: string | null

  status: 'pending_payment' | 'paid' | 'cancelled' | 'refunded'

  synced_to_header_id: string | null
  synced_at: string | null

  created_at: string
  updated_at: string

  // Joins
  online_customers?: OnlineCustomer
  online_store_events?: OnlineStoreEvent
}

// Helper types for forms
export interface ComboSelection {
  tradicional: number
  vegetariano: number
  sintacc: number
  vegano: number
}

export interface OrderFormData {
  full_name: string
  email: string
  phone: string
  travel_date: string
  bus_identifier: string
  combos: ComboSelection
}

// Summary types for dashboard
export interface OnlineOrdersSummary {
  total_orders: number
  total_paid: number
  total_pending: number
  total_cancelled: number
  total_revenue: number
  total_trad: number
  total_veg: number
  total_sintacc: number
  total_vegan: number
  orders_by_date: Record<string, number>
  orders_by_bus: Record<string, number>
}
