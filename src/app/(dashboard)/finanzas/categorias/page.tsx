import { getCategoriesAction } from "@/app/actions/categorias"
import CategoryDashboard from "@/components/finances/CategoryDashboard"
import { Layers } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function CategoriasFinanzasPage() {
  const res = await getCategoriesAction()
  
  const concepts = res.success ? res.concepts || [] : []
  const subconcepts = res.success ? res.subconcepts || [] : []

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-2xl">
            <Layers size={32} />
          </div>
          Categorías y Rubros de Fondos
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Administración de Rubros principales (Conceptos) y Conceptos de Caja (Subrubros)
          </p>
        </div>
      </div>

      <CategoryDashboard 
        concepts={concepts} 
        subconcepts={subconcepts} 
      />
    </div>
  )
}
