import Link from "next/link"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type EventsPageProps = {
  searchParams?: {
    company?: string
    venue?: string
    status?: string
    order?: string
  }
}

function formatCurrency(value: number | null) {
  if (value == null) return "-"
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const companyFilter = searchParams?.company ?? ""
  const venueFilter = searchParams?.venue ?? ""
  const statusFilter = searchParams?.status ?? ""
  const order = searchParams?.order === "asc" ? "asc" : "desc"

  let query = supabase
    .from("recitales_staging")
    .select(`
      id,
      event_date,
      coordinator,
      company,
      show_name,
      venue,
      status,
      pax_projected,
      sold_units,
      conversion_rate,
      sales_amount
    `)

  if (companyFilter) {
    query = query.eq("company", companyFilter)
  }

  if (venueFilter) {
    query = query.eq("venue", venueFilter)
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter)
  }

  const { data: events, error } = await query
    .order("event_date", { ascending: order === "asc" })
    .limit(200)

  const { data: companiesData } = await supabase
    .from("recitales_staging")
    .select("company")

  const { data: venuesData } = await supabase
    .from("recitales_staging")
    .select("venue")

  const { data: statusesData } = await supabase
    .from("recitales_staging")
    .select("status")

  const companies = Array.from(
    new Set((companiesData ?? []).map((row) => row.company).filter(Boolean))
  ).sort()

  const venues = Array.from(
    new Set((venuesData ?? []).map((row) => row.venue).filter(Boolean))
  ).sort()

  const statuses = Array.from(
    new Set((statusesData ?? []).map((row) => row.status).filter(Boolean))
  ).sort()

  if (error) {
    return <div>Error al cargar eventos: {error.message}</div>
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Gestión de eventos</h1>

      <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label htmlFor="company" className="text-sm mb-1">
            Empresa
          </label>
          <select
            id="company"
            name="company"
            defaultValue={companyFilter}
            className="border rounded px-3 py-2 min-w-[180px]"
          >
            <option value="">Todas</option>
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="venue" className="text-sm mb-1">
            Venue
          </label>
          <select
            id="venue"
            name="venue"
            defaultValue={venueFilter}
            className="border rounded px-3 py-2 min-w-[180px]"
          >
            <option value="">Todos</option>
            {venues.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="status" className="text-sm mb-1">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="border rounded px-3 py-2 min-w-[180px]"
          >
            <option value="">Todos</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="order" className="text-sm mb-1">
            Orden fecha
          </label>
          <select
            id="order"
            name="order"
            defaultValue={order}
            className="border rounded px-3 py-2 min-w-[140px]"
          >
            <option value="desc">Más nuevos</option>
            <option value="asc">Más viejos</option>
          </select>
        </div>

        <button
          type="submit"
          className="border rounded px-4 py-2 hover:bg-slate-100"
        >
          Filtrar
        </button>

        <Link
          href="/events"
          className="border rounded px-4 py-2 hover:bg-slate-100"
        >
          Limpiar
        </Link>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left p-2 border-b">Fecha</th>
            <th className="text-left p-2 border-b">Coordi</th>
            <th className="text-left p-2 border-b">Empresa</th>
            <th className="text-left p-2 border-b">Recital</th>
            <th className="text-left p-2 border-b">Venue</th>
            <th className="text-left p-2 border-b">Estado</th>
            <th className="text-left p-2 border-b">PAX Proy.</th>
            <th className="text-left p-2 border-b">Vendidos</th>
            <th className="text-left p-2 border-b">Conversión</th>
            <th className="text-left p-2 border-b">Facturación</th>
            <th className="text-left p-2 border-b">Ver más</th>
          </tr>
        </thead>
        <tbody>
          {events?.map((event) => (
            <tr key={event.id}>
              <td className="p-2 border-b">
                {event.event_date
                  ? new Date(event.event_date).toLocaleDateString("es-AR")
                  : "-"}
              </td>
              <td className="p-2 border-b">{event.coordinator ?? "-"}</td>
              <td className="p-2 border-b">{event.company ?? "-"}</td>
              <td className="p-2 border-b">{event.show_name ?? "-"}</td>
              <td className="p-2 border-b">{event.venue ?? "-"}</td>
              <td className="p-2 border-b">
                <span
                  className={
                    event.status === "Ejecutado"
                      ? "text-green-600 font-semibold"
                      : "text-orange-600 font-semibold"
                  }
                >
                  {event.status ?? "-"}
                </span>
              </td>
              <td className="p-2 border-b">{event.pax_projected ?? "-"}</td>
              <td className="p-2 border-b">{event.sold_units ?? "-"}</td>
              <td className="p-2 border-b">
                {event.conversion_rate != null
                  ? `${(event.conversion_rate * 100).toFixed(1)}%`
                  : "-"}
              </td>
              <td className="p-2 border-b">
                {formatCurrency(event.sales_amount)}
              </td>
              <td className="p-2 border-b">
                <Link
                  href={`/events/${event.id}`}
                  className="text-blue-600 hover:underline"
                >
                  Ver más
                </Link>
              </td>
            </tr>
          ))}

          {!events?.length && (
            <tr>
              <td colSpan={11} className="p-4 text-center text-slate-500">
                No hay eventos para esos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}