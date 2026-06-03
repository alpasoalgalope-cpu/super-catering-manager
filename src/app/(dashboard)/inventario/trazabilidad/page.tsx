import { supabase } from "@/lib/supabase"
import StockLedger from "@/components/inventory/StockLedger"
import { ArrowLeftRight } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function TrazabilidadPage({
  searchParams,
}: {
  searchParams: { producto_id?: string; event_id?: string; from?: string; to?: string }
}) {
  const { producto_id, event_id, from, to } = searchParams

  // Fetch filters data to populate dropdowns
  const { data: productos } = await supabase.from('productos').select('id, nombre').order('nombre')
  const { data: events } = await supabase
    .from('events_master')
    .select('id, show_name, event_date')
    .eq('status', 'ejecutado')
    .order('event_date', { ascending: false })

  // Build the query
  let query = supabase
    .from('stock_movements')
    .select('*, productos(nombre, unidad_medida), events_master(show_name, event_date)')
    .order('created_at', { ascending: false })

  if (producto_id) query = query.eq('producto_id', producto_id)
  if (event_id) query = query.eq('event_master_id', event_id)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: movements, error } = await query

  if (error) {
    console.error("Error fetching stock movements:", error)
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-3">
          <ArrowLeftRight className="text-indigo-600" size={32} />
          Trazabilidad de Stock
        </h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">
          Auditoría de libro mayor y movimientos de inventario
        </p>
      </div>

      <StockLedger 
        movements={movements || []} 
        productos={productos || []} 
        events={events || []} 
        currentFilters={{ producto_id, event_id, from, to }}
      />
    </div>
  )
}
