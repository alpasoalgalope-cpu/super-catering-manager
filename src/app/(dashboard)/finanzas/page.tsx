import { supabase } from "@/lib/supabase"
import CashFlowLedger from "@/components/finances/CashFlowLedger"
import { DollarSign } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function FinanzasPage() {
  const { data: movements, error } = await supabase
    .from('cash_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .order('fecha', { ascending: false })

  if (error) {
    console.error("Error fetching cash movements:", error)
  }

  // Fetch concepts and subconcepts for the manual registry modal
  const { data: concepts } = await supabase
    .from('cash_concepts')
    .select('*')
    .order('name')

  const { data: subconcepts } = await supabase
    .from('cash_subconcepts')
    .select('*')
    .order('name')

  // Encontrar la fecha de creación más reciente
  const latestImport = movements && movements.length > 0
    ? new Date(Math.max(...movements.map(m => new Date(m.created_at).getTime())))
    : null

  const formattedLatestImport = latestImport
    ? latestImport.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : "Sin importaciones"

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-2xl">
            <DollarSign size={32} />
          </div>
          Libro de Caja y Finanzas
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Sincronización con Maxirest y Auditoría de Movimientos
          </p>
          <div className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl self-start tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Última Importación: {formattedLatestImport}
          </div>
        </div>
      </div>

      <CashFlowLedger 
        movements={movements || []} 
        concepts={concepts || []} 
        subconcepts={subconcepts || []} 
      />
    </div>
  )
}
