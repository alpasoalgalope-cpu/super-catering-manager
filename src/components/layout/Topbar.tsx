import Link from "next/link"
import { Calculator, CalendarDays, DollarSign, BarChart3, ChefHat, ShoppingCart, Store } from "lucide-react"

export default function Topbar() {
  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 flex items-center justify-between shadow-xs sticky top-0 z-10">
      <div className="flex items-center min-w-0 flex-1 mr-4">
        {/* Favourites Buttons in 1 single clean row */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none flex-nowrap">
          <Link 
            href="/produccion" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-rose-100 hover:bg-rose-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Consolidado Cocina"
          >
            <ChefHat size={13} /> Consolidado Cocina
          </Link>
          <Link 
            href="/inventario/ordenes-compra" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-sky-100 hover:bg-sky-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Órdenes de Compra"
          >
            <ShoppingCart size={13} /> Órdenes de Compra
          </Link>
          <Link 
            href="/informes" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-violet-100 hover:bg-violet-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Central de Informes"
          >
            <BarChart3 size={13} /> Central de Informes
          </Link>
          <Link 
            href="/inventario/proyeccion" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-indigo-100 hover:bg-indigo-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Proyección de Insumos"
          >
            <Calculator size={13} /> Proyección de Insumos
          </Link>
          <Link 
            href="/settings/eventos" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-100 hover:bg-emerald-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Gestión de Eventos"
          >
            <CalendarDays size={13} /> Gestión de Eventos
          </Link>
          <Link 
            href="/ventas-online" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-teal-100 hover:bg-teal-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Ventas Online"
          >
            <Store size={13} /> Ventas Online
          </Link>
          <Link 
            href="/ventas-evento" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-amber-100 hover:bg-amber-100 transition-all shadow-2xs shrink-0 whitespace-nowrap"
            title="Ventas por Evento"
          >
            <DollarSign size={13} /> Ventas por Evento
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center cursor-pointer shadow-2xs">
          <span className="text-sm">🔔</span>
        </button>
        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md shadow-slate-300 select-none">
          AD
        </div>
      </div>
    </header>
  )
}
