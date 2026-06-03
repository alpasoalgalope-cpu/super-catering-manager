import Link from "next/link"
import { Calculator, CalendarDays, DollarSign, BarChart3 } from "lucide-react"

export default function Topbar() {
  return (
    <header className="h-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-8 flex items-center justify-between shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-10">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">
            Super Catering <span className="text-indigo-600">Manager</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Gestión operativa y comercial
          </p>
        </div>

        {/* Favourites Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          <Link href="/informes" className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-violet-100 hover:bg-violet-100 transition-all shadow-sm">
            <BarChart3 size={14} /> Central de Informes
          </Link>
          <Link href="/inventario/proyeccion" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm">
            <Calculator size={14} /> Proyección de Insumos
          </Link>
          <Link href="/settings/eventos" className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm">
            <CalendarDays size={14} /> Gestión de Eventos
          </Link>
          <Link href="/ventas-evento" className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100 hover:bg-amber-100 transition-all shadow-sm">
            <DollarSign size={14} /> Ventas por Evento
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center">
          <span className="text-lg">🔔</span>
        </button>
        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-slate-200">
          AD
        </div>
      </div>
    </header>
  )
}