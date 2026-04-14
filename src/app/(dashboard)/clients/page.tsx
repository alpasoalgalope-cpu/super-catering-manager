import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Clientes</h1>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b">Nombre</th>
            <th className="text-left p-2 border-b">Email</th>
            <th className="text-left p-2 border-b">Teléfono</th>
            <th className="text-left p-2 border-b">Último Evento</th>
            <th className="text-left p-2 border-b">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {clients?.map((c) => (
            <tr key={c.id}>
              <td className="p-2 border-b">{c.name ?? "-"}</td>
              <td className="p-2 border-b">{c.email ?? "-"}</td>
              <td className="p-2 border-b">{c.phone ?? "-"}</td>
              <td className="p-2 border-b">-</td>
              <td className="p-2 border-b">Editar</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}