import { supabase } from "@/lib/supabase"
import ClientList from "@/components/views/ClientList"

export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    return (
      <div className="p-4 rounded border border-red-200 bg-red-50 text-red-600">
        Error al cargar los clientes: {error.message}
      </div>
    )
  }

  return <ClientList initialData={clients || []} />
}