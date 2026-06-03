import { supabase } from "@/lib/supabase"
import CashFlowReports from "@/components/finances/CashFlowReports"
import { BarChart3 } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function InformesFlujoCajaPage() {
  const { data: movements, error } = await supabase
    .from('cash_movements')
    .select('*')
    .order('fecha', { ascending: true })

  if (error) {
    console.error("Error fetching cash movements for reports:", error)
  }

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
            <BarChart3 size={32} />
          </div>
          Análisis Financiero de Caja
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Reportes de Rentabilidad, Rubros de Gasto y Evolución Mensual
          </p>
          <div className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl self-start tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Última Importación: {formattedLatestImport}
          </div>
        </div>
      </div>

      <CashFlowReports movements={movements || []} />
    </div>
  )
}
