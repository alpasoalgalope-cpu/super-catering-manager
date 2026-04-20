"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Bus, Plus, Pencil, Trash2, Loader2, Search,
  AlertCircle, CheckCircle2, Users, Building2, CreditCard
} from "lucide-react"
import FleetModal from "@/components/forms/FleetModal"

// ─── Types ────────────────────────────────────────────────
type Client = { id: string; name: string }
type Vehicle = {
  id: string
  internal_name: string
  plate: string
  brand?: string | null
  vehicle_type: "" | "Micro" | "Trafic"
  capacity: number | null
  client_id: string | null
  clients?: { name: string } | null
}

// ─── Status Badge ─────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  Micro: "bg-slate-100 text-slate-700 border-slate-200",
  Trafic: "bg-purple-100 text-purple-700 border-purple-200",
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterClient, setFilterClient] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | undefined>()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [vRes, cRes] = await Promise.all([
      supabase
        .from("vehicles")
        .select("*, clients(name)")
        .order("internal_name", { ascending: true }),
      supabase
        .from("clients")
        .select("id, name")
        .order("name"),
    ])
    setVehicles(vRes.data || [])
    setClients(cRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    const { error } = await supabase.from("vehicles").delete().eq("id", id)
    setDeleting(null)
    if (error) {
      setMessage({ type: "error", text: error.message })
    } else {
      setMessage({ type: "success", text: `"${name}" eliminado.` })
      setVehicles(prev => prev.filter(v => v.id !== id))
    }
    setTimeout(() => setMessage(null), 3000)
  }

  // ── Filtered list ─────────────────────────────────────────
  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase()
    const matchSearch =
      v.internal_name.toLowerCase().includes(q) ||
      v.plate.toLowerCase().includes(q) ||
      (v.brand ?? "").toLowerCase().includes(q) ||
      (v.clients?.name ?? "").toLowerCase().includes(q)
    const matchClient = filterClient === "" || v.client_id === filterClient
    return matchSearch && matchClient
  })

  // ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">

      {/* ── Header ── */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Bus size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest bg-purple-50 px-2 py-1 rounded">
              ABM de Flota
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Vehículos</h1>
          <p className="text-sm text-slate-400 mt-1">
            {vehicles.length} unidad{vehicles.length !== 1 ? "es" : ""} registrada{vehicles.length !== 1 ? "s" : ""}
            {" · "}
            {vehicles.filter(v => v.vehicle_type === "Micro").length} Micros
            {" · "}
            {vehicles.filter(v => v.vehicle_type === "Trafic").length} Trafics
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setModalOpen(true) }}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
        >
          <Plus size={18} /> Nueva Unidad
        </button>
      </div>

      {/* ── Message ── */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-bold border ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : "bg-rose-50 text-rose-700 border-rose-100"
        }`}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 transition"
            placeholder="Buscar por interno, patente, marca o empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="sm:w-56 py-3 px-4 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-purple-300 transition appearance-none font-medium text-slate-600"
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
        >
          <option value="">Todas las empresas</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-purple-500" size={40} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
          <Bus className="mx-auto text-slate-200 mb-4" size={64} />
          <p className="font-black text-slate-400 uppercase tracking-widest">Sin unidades</p>
          <p className="text-slate-400 text-sm mt-1">
            {search || filterClient ? "Ningún resultado para los filtros." : "Creá la primera unidad con el botón de arriba."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Interno</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Patente</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cap. PAX</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition group">
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-800">{v.internal_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {v.plate}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{v.brand || "—"}</td>
                    <td className="px-6 py-4">
                      {v.vehicle_type ? (
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${TYPE_STYLES[v.vehicle_type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {v.vehicle_type}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {v.capacity ? (
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-slate-400" />
                          <span className="font-black text-slate-700">{v.capacity}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {v.clients?.name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-purple-400" />
                          <span className="text-sm font-medium text-slate-600">{v.clients.name}</span>
                        </div>
                      ) : <span className="text-slate-300 text-sm">Sin asignar</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { setEditing(v as any); setModalOpen(true) }}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.internal_name)}
                          disabled={deleting === v.id}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-40"
                          title="Eliminar"
                        >
                          {deleting === v.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map(v => (
              <div key={v.id} className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-slate-800">{v.internal_name}</p>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">{v.plate}</p>
                  </div>
                  {v.vehicle_type && (
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${TYPE_STYLES[v.vehicle_type] || ""}`}>
                      {v.vehicle_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {v.capacity && <span className="flex items-center gap-1"><Users size={11} /> {v.capacity} PAX</span>}
                  {v.clients?.name && <span className="flex items-center gap-1"><Building2 size={11} className="text-purple-400" /> {v.clients.name}</span>}
                  {v.brand && <span>{v.brand}</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setEditing(v as any); setModalOpen(true) }}
                    className="flex-1 py-2 rounded-xl border border-purple-200 text-purple-600 font-bold text-xs hover:bg-purple-50 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(v.id, v.internal_name)}
                    disabled={deleting === v.id}
                    className="flex-1 py-2 rounded-xl border border-rose-200 text-rose-500 font-bold text-xs hover:bg-rose-50 transition disabled:opacity-40"
                  >
                    {deleting === v.id ? "..." : "Eliminar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Totals bar ── */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total unidades", value: vehicles.length, icon: Bus },
            { label: "Micros", value: vehicles.filter(v => v.vehicle_type === "Micro").length, icon: Bus },
            { label: "Trafics", value: vehicles.filter(v => v.vehicle_type === "Trafic").length, icon: Bus },
            {
              label: "Capacidad total",
              value: vehicles.reduce((a, v) => a + (v.capacity || 0), 0) + " PAX",
              icon: Users
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-1 shadow-sm">
              <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-1">
                <Icon size={10} /> {label}
              </p>
              <p className="text-3xl font-black text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      <FleetModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined) }}
        vehicle={editing}
        clients={clients}
        onSuccess={() => {
          setMessage({ type: "success", text: editing?.id ? "Unidad actualizada." : "Unidad creada." })
          fetchAll()
          setTimeout(() => setMessage(null), 3000)
        }}
      />
    </div>
  )
}
