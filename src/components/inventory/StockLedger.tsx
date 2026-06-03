"use client"

import React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { 
  ArrowUpRight, ArrowDownRight, Package, Calendar, 
  Search, Filter, Activity, History 
} from "lucide-react"

export default function StockLedger({ movements, productos, events, currentFilters }: any) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  const getMovementColor = (type: string) => {
    if (type.includes('INGRESO')) return 'text-emerald-600 bg-emerald-50 border-emerald-100'
    if (type.includes('MERMA')) return 'text-amber-600 bg-amber-50 border-amber-100'
    if (type.includes('CONSUMO')) return 'text-indigo-600 bg-indigo-50 border-indigo-100'
    return 'text-slate-600 bg-slate-50 border-slate-100'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Filtrar por Producto</label>
          <select 
            value={currentFilters.producto_id || ''}
            onChange={e => updateFilters('producto_id', e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold uppercase border-none focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            <option value="">Todos los productos</option>
            {productos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Filtrar por Evento</label>
          <select 
            value={currentFilters.event_id || ''}
            onChange={e => updateFilters('event_id', e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold uppercase border-none focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            <option value="">Todos los eventos</option>
            {events.map((e: any) => <option key={e.id} value={e.id}>{e.show_name} ({new Date(e.event_date).toLocaleDateString()})</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-6">Fecha / Hora</th>
                <th className="px-4 py-6">Producto</th>
                <th className="px-4 py-6">Movimiento</th>
                <th className="px-4 py-6">Evento / Ref</th>
                <th className="px-4 py-6 text-right">Variación</th>
                <th className="px-8 py-6 text-right">Stock Resultante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {movements.map((mov: any) => (
                <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="text-xs font-black text-slate-800">{new Date(mov.created_at).toLocaleDateString()}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(mov.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="px-4 py-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-xl text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <Package size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-black uppercase tracking-tight text-slate-800">{mov.productos?.nombre}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getMovementColor(mov.tipo_movimiento)}`}>
                      {mov.tipo_movimiento.replace(/_/g, ' ')}
                    </span>
                    <div className="text-[9px] font-bold text-slate-400 mt-2 line-clamp-1 max-w-[200px]" title={mov.descripcion}>
                      {mov.descripcion || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    {mov.events_master ? (
                      <div>
                        <div className="text-xs font-black uppercase text-slate-700">{mov.events_master.show_name}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(mov.events_master.event_date).toLocaleDateString()}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase">-</span>
                    )}
                  </td>
                  <td className="px-4 py-6 text-right">
                    <div className={`text-lg font-black tracking-tighter flex items-center justify-end gap-1 ${mov.cantidad > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {mov.cantidad > 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                      {Math.abs(mov.cantidad)} {mov.productos?.unidad_medida}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="text-xl font-black text-slate-900 tracking-tighter">
                      {mov.stock_resultante} <span className="text-sm font-bold text-slate-400">{mov.productos?.unidad_medida}</span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Previo: {mov.stock_previo}
                    </div>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <History size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay movimientos registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
