import { supabase } from "@/lib/supabase"
import CoordinatorList from "@/components/views/CoordinatorList"

export const dynamic = "force-dynamic"

export default async function CoordinadoresPage() {
  const { data: coordinators, error } = await supabase
    .from("coordinators")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    return (
      <div className="p-4 rounded border border-red-200 bg-red-50 text-red-600">
        Error al cargar los coordinadores: {error.message}
      </div>
    )
  }

  return <CoordinatorList initialData={coordinators || []} />
}
