"use client"

import { useState, useEffect, useCallback } from "react"
import { getRVTrasladosSalesAction, updateRVTrasladosCoordinatorAction } from "@/app/actions/events"
import { Loader2, Check, Search, AlertCircle, Filter, ShieldCheck, RefreshCw, Calendar, Users, DollarSign } from "lucide-react"

interface SaleRow {
  id: string
  event_id: string
  event_name: string
  event_date: string
  coordinator_name: string | null
  coordinator_id: string | null
  pax_projected: number
  total_amount: number
}

interface Coordinator {
  id: string
  name: string
}

export default function RVCoordinatorsAuditPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterMissing, setFilterMissing] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await getRVTrasladosSalesAction()
    if (res.success && res.sales && res.coordinators) {
      setSales(res.sales)
      setCoordinators(res.coordinators)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCoordinatorChange = async (sale: SaleRow, coordId: string) => {
    setUpdatingId(sale.id)
    setSuccessId(null)
    setErrorId(null)

    const selectedCoord = coordinators.find(c => c.id === coordId)
    const coordName = selectedCoord ? selectedCoord.name : null

    const res = await updateRVTrasladosCoordinatorAction(
      sale.id,
      sale.event_id,
      coordId || null,
      coordName
    )

    setUpdatingId(null)
    if (res.success) {
      setSuccessId(sale.id)
      setSales(prev =>
        prev.map(s =>
          s.id === sale.id
            ? { ...s, coordinator_id: coordId || null, coordinator_name: coordName }
            : s
        )
      )
      setTimeout(() => setSuccessId(null), 3000)
    } else {
      setErrorId(sale.id)
      setTimeout(() => setErrorId(null), 4000)
    }
  }

  const filteredSales = sales.filter(s => {
    const matchesSearch =
      s.event_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.coordinator_name || "").toLowerCase().includes(search.toLowerCase())
    
    // Unassigned checks either null ID or placeholder coordinator name (e.g. S/D, N/A, empty)
    const isUnassigned =
      !s.coordinator_id ||
      !s.coordinator_name ||
      s.coordinator_name.toLowerCase().includes("s/d") ||
      s.coordinator_name.toLowerCase().includes("n/a")
      
    const matchesMissing = !filterMissing || isUnassigned

    return matchesSearch && matchesMissing
  })

  // Statistics
  const totalSalesCount = sales.length
  const missingCoordCount = sales.filter(
    s =>
      !s.coordinator_id ||
      !s.coordinator_name ||
      s.coordinator_name.toLowerCase().includes("s/d") ||
      s.coordinator_name.toLowerCase().includes("n/a")
  ).length
  const totalRevenue = sales.reduce((acc, s) => acc + s.total_amount, 0)
  const totalPax = sales.reduce((acc, s) => acc + s.pax_projected, 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="space-y-2 relative">
          <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-widest">
            <ShieldCheck size={16} /> Panel de Auditoría Ad-Hoc
          </div>
          <h1 className="text-3xl font-black tracking-tight">Consolidación de Coordinadores</h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Herramienta especial de único uso para auditar y depurar todas las ventas de la empresa <span className="text-white font-bold">RV Traslados</span>, resolver asignaciones sin definir (S/D) y cerrar el historial.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition border border-slate-700 shadow-sm shrink-0 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Recargar Datos
        </button>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Eventos</p>
            <p className="text-2xl font-black text-slate-900">{totalSalesCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${missingCoordCount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin Definir (S/D)</p>
            <p className="text-2xl font-black text-slate-900">{missingCoordCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-black">PAX Acumulados</p>
            <p className="text-2xl font-black text-slate-900">{totalPax.toLocaleString("es-AR")}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Venta Acumulada</p>
            <p className="text-2xl font-black text-slate-900">${totalRevenue.toLocaleString("es-AR")}</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:max-w-md bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por recital o coordinador..."
            className="bg-transparent border-none outline-none w-full text-sm placeholder-slate-400 text-slate-700"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-bold text-slate-600 hover:text-slate-900 transition">
            <input
              type="checkbox"
              checked={filterMissing}
              onChange={e => setFilterMissing(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            <Filter size={14} className="inline text-slate-400" /> Mostrar solo "Sin Coordinador"
          </label>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider">Cargando histórico de ventas...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="font-black uppercase tracking-widest text-sm">No se encontraron registros</p>
            <p className="text-xs text-slate-400 mt-1">Intenta ajustando los criterios de búsqueda o filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider">Recital / Evento</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">PAX Estimados</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Facturación</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider">Nombre del Excel</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider w-80">Asignar Coordinador Oficial</th>
                  <th className="py-5 px-6 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((s, idx) => {
                  const isSD =
                    !s.coordinator_name ||
                    s.coordinator_name.toLowerCase().includes("s/d") ||
                    s.coordinator_name.toLowerCase().includes("n/a")

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800 text-sm">{s.event_name}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          {s.event_date}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-black text-slate-700 text-sm">
                        {s.pax_projected || '-'}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-emerald-600 text-sm">
                        ${s.total_amount.toLocaleString("es-AR")}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${isSD ? "bg-rose-50 text-rose-600 border border-rose-100 animate-pulse" : "bg-indigo-50 text-indigo-600"}`}>
                          {s.coordinator_name || "Sin Definir (S/D)"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <select
                          className={`w-full p-2 border rounded-xl text-xs font-bold outline-none bg-white transition-all shadow-sm ${isSD ? "border-rose-200 focus:border-rose-400 focus:ring-1 focus:ring-rose-200" : "border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"}`}
                          value={s.coordinator_id || ""}
                          onChange={e => handleCoordinatorChange(s, e.target.value)}
                          disabled={updatingId === s.id}
                        >
                          <option value="">-- Sin Asignar / S/D --</option>
                          {coordinators.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {updatingId === s.id && (
                          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={16} />
                        )}
                        {successId === s.id && (
                          <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-full inline-block animate-bounce shadow-sm">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                        {errorId === s.id && (
                          <span className="text-rose-500 text-[10px] font-bold uppercase tracking-wider animate-shake">Error</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
