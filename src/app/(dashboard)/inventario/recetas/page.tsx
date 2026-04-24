import { supabase } from "@/lib/supabase"
import RecipesModule from "@/components/inventory/RecipesModule"
import { ChefHat } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RecetasPage() {
  // Fetch Rubros
  const { data: rubros } = await supabase
    .from("rubros_comida")
    .select("*")
    .order("nombre")

  // Fetch Recetas with Details
  const { data: recetas } = await supabase
    .from("recetas")
    .select(`
      *,
      rubros_comida(nombre),
      receta_insumos(
        *,
        productos(*)
      )
    `)
    .order("nombre")

  // Fetch Products with latest prices for real-time costing
  // We sub-query to get only products that have at least one price
  const { data: productos } = await supabase
    .from("productos")
    .select("*, proveedores(nombre), familias(nombre), precios_historicos(*)")
    .order("nombre")

  return (
    <div className="p-6 md:p-10 space-y-10 w-full animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-indigo-50">
          <ChefHat size={20} className="text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">Producción</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">Maestro de Recetas</h1>
        <p className="text-slate-500 font-medium max-w-2xl text-xs uppercase tracking-widest leading-relaxed">
          Diseño técnico, desglose de costos y fijación de precios de venta para eventos masivos.
        </p>
      </div>

      <RecipesModule 
        initialRubros={rubros || []} 
        initialRecetas={recetas || []} 
        productos={productos || []} 
      />
    </div>
  )
}
