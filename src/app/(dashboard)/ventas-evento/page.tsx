import { supabase } from "@/lib/supabase"
import EventSalesForm from "@/components/forms/EventSalesForm"

export const dynamic = "force-dynamic"

export default async function VentasEventoPage({
  searchParams,
}: {
  searchParams: { eventId?: string; company?: string }
}) {
  try {
    // Fetch de datos optimizado (Header/Detail & Rules)
    // Extraemos la data base para el formulario de Ventas (EventSalesForm consultará eventos maestros detallados por sí mismo para no sobrecargar los params)
    const [
      { data: clients },
      { data: commercialRules },
      { data: freeMealRules },
      { data: catalog },
      { data: coordinators },
      { data: vehicles }
    ] = await Promise.all([
      supabase.from("clients").select("*"),
      supabase.from("commercial_rules").select("*"),
      supabase.from("free_meal_rules").select("*"),
      supabase.from("sandwich_catalog").select("*").order("name", { ascending: true }),
      supabase.from("coordinators").select("id, name, company, phone").order("name", { ascending: true }),
      supabase.from("vehicles").select("id, internal_name, plate, brand, client_id").order("internal_name", { ascending: true })
    ])

    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Carga Operativa de Ventas</h1>
            <p className="text-sm text-slate-500 mt-1">Control por unidades con validación de reglas comerciales.</p>
          </div>
        </div>

        <EventSalesForm
          initialEventId={searchParams.eventId}
          initialCompany={searchParams.company}
          clients={clients || []}
          commercialRules={commercialRules || []}
          freeMealRules={freeMealRules || []}
          catalog={catalog || []}
          coordinators={coordinators || []}
          vehicles={vehicles || []}
        />
      </div>
    )
  } catch (err) {
    return <div className="p-10 text-center text-red-500">Error crítico de conexión o base de datos.</div>
  }
}