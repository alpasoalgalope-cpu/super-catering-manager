import { supabase } from '@/lib/supabase'
import OnlineSalesDashboard from '@/components/online-sales/OnlineSalesDashboard'
import { autoSyncStoresForConfirmedEventsAction } from '@/app/actions/online-sales'

export const dynamic = 'force-dynamic'

export default async function VentasOnlinePage() {
  // Auto-sync stores for any confirmed events from today onwards
  await autoSyncStoresForConfirmedEventsAction()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: stores }, { data: upcomingEvents }, { data: allEvents }, { data: orders }, { data: rules }] = await Promise.all([
    supabase
      .from('online_store_events')
      .select('*, events_master(id, event_date, show_name, status, venues(name))')
      .order('created_at', { ascending: false }),
    supabase
      .from('events_master')
      .select('id, event_date, show_name, status, venues(name), event_projections(id, company_name, projected_pax)')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(100),
    supabase
      .from('events_master')
      .select('id, event_date, show_name, status, venues(name), event_projections(id, company_name, projected_pax)')
      .order('event_date', { ascending: true })
      .limit(100),
    supabase
      .from('online_orders')
      .select('*, online_customers(*), online_store_events(title, slug, event_master_id, events_master(show_name, event_date))')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('commercial_rules')
      .select('*')
  ])

  // Prefer upcoming events; fallback to all events if none upcoming
  const finalEvents = (upcomingEvents && upcomingEvents.length > 0) ? upcomingEvents : (allEvents || [])

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black italic uppercase tracking-tight text-slate-900">
          Ventas Online
        </h1>
        <p className="text-slate-500 mt-2">
          Gestión de tiendas, pedidos y clientes
        </p>
      </div>

      <OnlineSalesDashboard 
        initialStores={stores || []} 
        initialOrders={orders || []} 
        initialEvents={finalEvents} 
        rules={rules || []}
      />
    </div>
  )
}
