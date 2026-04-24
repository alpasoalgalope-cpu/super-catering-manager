import { supabase } from "@/lib/supabase"
import RubrosComidaManager from "../../../../components/inventory/RubrosComidaManager"
import { Layers } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RubrosPage() {
  const { data: rubros } = await supabase
    .from("rubros_comida")
    .select("*")
    .order("nombre")

  return (
    <div className="p-6 md:p-10 space-y-10 w-full animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-indigo-50">
          <Layers size={20} className="text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">Categorización</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">Categorías de Cocina</h1>
        <p className="text-slate-500 font-medium max-w-2xl text-xs uppercase tracking-widest leading-relaxed">
          Defina los rubros para organizar su recetario master.
        </p>
      </div>

      <RubrosComidaManager initialRubros={rubros || []} />
    </div>
  )
}
