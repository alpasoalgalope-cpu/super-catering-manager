"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  Smile, ArrowLeft, Plus, Search, Trash2, Edit2, Loader2, 
  Sparkles, TrendingUp, Percent, MessageSquare, Calendar, 
  MapPin, Building2, HelpCircle, Info
} from "lucide-react"
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend
} from "recharts"
import { 
  getSatisfactionReportsAction, 
  saveSatisfactionAction, 
  deleteSatisfactionAction, 
  getEventSalesSummaryAction,
  SatisfactionReportRow,
  EventSalesSummary
} from "@/app/actions/reports"

export default function SatisfaccionPage() {
  const [reports, setReports] = useState<SatisfactionReportRow[]>([])
  const [salesSummary, setSalesSummary] = useState<EventSalesSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all")

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Modal Form Inputs
  const [selectedEventId, setSelectedEventId] = useState("")
  const [companyMode, setCompanyMode] = useState<"select" | "custom">("select")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [customCompany, setCustomCompany] = useState("")
  const [respExcelente, setRespExcelente] = useState<number | "">(0)
  const [respMuyBueno, setRespMuyBueno] = useState<number | "">(0)
  const [respBueno, setRespBueno] = useState<number | "">(0)
  const [respRegular, setRespRegular] = useState<number | "">(0)
  const [respMalo, setRespMalo] = useState<number | "">(0)

  // Fetch satisfaction data and event summaries on mount
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [reportsRes, salesRes] = await Promise.all([
        getSatisfactionReportsAction(),
        getEventSalesSummaryAction()
      ])

      if (reportsRes.error) {
        setError(reportsRes.error)
      } else if (reportsRes.data) {
        setReports(reportsRes.data)
      }

      if (salesRes.error) {
        console.error("Error loading event sales summary:", salesRes.error)
      } else if (salesRes.data) {
        setSalesSummary(salesRes.data)
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar la información")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered reports list
  const filteredReports = useMemo(() => {
    return reports.filter(row => {
      const lowerSearch = searchTerm.toLowerCase()
      const matchesSearch = 
        row.show_name.toLowerCase().includes(lowerSearch) ||
        row.venue_name.toLowerCase().includes(lowerSearch) ||
        row.company_name.toLowerCase().includes(lowerSearch)

      const matchesCompany = 
        selectedCompanyFilter === "all" || 
        row.company_name.toLowerCase() === selectedCompanyFilter.toLowerCase()

      return matchesSearch && matchesCompany
    })
  }, [reports, searchTerm, selectedCompanyFilter])

  // List of unique companies present in the reports for the filter dropdown
  const uniqueCompanies = useMemo(() => {
    const companies = reports.map(r => r.company_name.trim())
    return Array.from(new Set(companies))
  }, [reports])

  // General Macro Statistics
  const macroStats = useMemo(() => {
    if (reports.length === 0) {
      return {
        avgIndex: 0,
        totalResponses: 0,
        avgResponseRate: 0,
        bestEvent: "Ninguno",
        bestEventIndex: 0,
        totalExcellent: 0,
        totalVeryGood: 0,
        totalGood: 0,
        totalRegular: 0,
        totalBad: 0
      }
    }

    let sumIndex = 0
    let totalResp = 0
    let totalSoldUnits = 0
    let bestEvent = "S/D"
    let bestIndex = -1

    let tExc = 0
    let tVeryGood = 0
    let tGood = 0
    let tReg = 0
    let tBad = 0

    reports.forEach(r => {
      sumIndex += r.indice_satisfaccion
      totalResp += r.total_respuestas
      totalSoldUnits += r.unidades_vendidas

      tExc += r.respuestas_excelente
      tVeryGood += r.respuestas_muy_bueno
      tGood += r.respuestas_bueno
      tReg += r.respuestas_regular
      tBad += r.respuestas_malo

      if (r.indice_satisfaccion > bestIndex) {
        bestIndex = r.indice_satisfaccion
        bestEvent = r.show_name
      }
    })

    const avgIndex = Math.round(sumIndex / reports.length)
    const avgResponseRate = totalSoldUnits > 0 ? Math.round((totalResp / totalSoldUnits) * 100) : 0

    return {
      avgIndex,
      totalResponses: totalResp,
      avgResponseRate,
      bestEvent,
      bestEventIndex: bestIndex,
      totalExcellent: tExc,
      totalVeryGood: tVeryGood,
      totalGood: tGood,
      totalRegular: tReg,
      totalBad: tBad
    }
  }, [reports])

  // Chart Data format
  const chartData = useMemo(() => {
    return [
      { name: "Excelente", votos: macroStats.totalExcellent, color: "#10B981" },
      { name: "Muy Bueno", votos: macroStats.totalVeryGood, color: "#3B82F6" },
      { name: "Bueno / Acep.", votos: macroStats.totalGood, color: "#F59E0B" },
      { name: "Regular", votos: macroStats.totalRegular, color: "#F97316" },
      { name: "Malo", votos: macroStats.totalBad, color: "#EF4444" }
    ]
  }, [macroStats])

  // Selected event details in the modal
  const selectedEventDetails = useMemo(() => {
    return salesSummary.find(s => s.event_master_id === selectedEventId) || null
  }, [selectedEventId, salesSummary])

  // Dynamically calculate units sold for current form selection
  const currentUnitsSold = useMemo(() => {
    if (!selectedEventDetails) return 0
    const companyName = companyMode === "select" ? selectedCompany : customCompany
    const companySales = selectedEventDetails.companies.find(
      c => c.company_name.toLowerCase() === companyName.toLowerCase()
    )
    return companySales ? companySales.sold_qty : 0
  }, [selectedEventDetails, companyMode, selectedCompany, customCompany])

  // Open modal in create mode
  const handleOpenCreate = () => {
    setModalMode("create")
    setEditingId(null)
    setSelectedEventId(salesSummary[0]?.event_master_id || "")
    setCompanyMode("select")
    setSelectedCompany(salesSummary[0]?.companies[0]?.company_name || "RV Traslados")
    setCustomCompany("")
    setRespExcelente(0)
    setRespMuyBueno(0)
    setRespBueno(0)
    setRespRegular(0)
    setRespMalo(0)
    setIsModalOpen(true)
  }

  // Open modal in edit mode
  const handleOpenEdit = (row: SatisfactionReportRow) => {
    setModalMode("edit")
    setEditingId(row.id)
    setSelectedEventId(row.event_master_id)
    
    // Check if the company exists in the sales summary list for this event
    const summary = salesSummary.find(s => s.event_master_id === row.event_master_id)
    const hasCompany = summary?.companies.some(
      c => c.company_name.toLowerCase() === row.company_name.toLowerCase()
    )

    if (hasCompany) {
      setCompanyMode("select")
      setSelectedCompany(row.company_name)
      setCustomCompany("")
    } else {
      setCompanyMode("custom")
      setSelectedCompany("")
      setCustomCompany(row.company_name)
    }

    setRespExcelente(row.respuestas_excelente)
    setRespMuyBueno(row.respuestas_muy_bueno)
    setRespBueno(row.respuestas_bueno)
    setRespRegular(row.respuestas_regular)
    setRespMalo(row.respuestas_malo)
    setIsModalOpen(true)
  }

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEventId) return

    const finalCompany = companyMode === "select" ? selectedCompany : customCompany
    if (!finalCompany.trim()) {
      alert("Por favor ingrese el nombre de la empresa/cliente.")
      return
    }

    setActionLoading(true)
    const res = await saveSatisfactionAction({
      id: editingId || undefined,
      event_master_id: selectedEventId,
      company_name: finalCompany.trim(),
      respuestas_excelente: Number(respExcelente) || 0,
      respuestas_muy_bueno: Number(respMuyBueno) || 0,
      respuestas_bueno: Number(respBueno) || 0,
      respuestas_regular: Number(respRegular) || 0,
      respuestas_malo: Number(respMalo) || 0
    })

    setActionLoading(false)
    if (res.success) {
      setIsModalOpen(false)
      loadData()
    } else {
      alert(res.error || "Ocurrió un error al registrar la satisfacción.")
    }
  }

  // Handle Delete
  const handleDelete = async (id: string, eventName: string, company: string) => {
    if (confirm(`¿Está seguro de que desea eliminar el registro de satisfacción de "${eventName}" para la empresa "${company}"?`)) {
      setActionLoading(true)
      const res = await deleteSatisfactionAction(id)
      setActionLoading(false)
      if (res.success) {
        loadData()
      } else {
        alert(res.error || "Ocurrió un error al eliminar el registro.")
      }
    }
  }

  // When selected event changes in modal, auto-update company dropdown selection
  useEffect(() => {
    if (selectedEventDetails && modalMode === "create") {
      const firstCompany = selectedEventDetails.companies[0]?.company_name || ""
      setSelectedCompany(firstCompany)
      // Automatically default to custom if empty/no companies found
      if (!firstCompany) {
        setCompanyMode("custom")
        setCustomCompany("RV Traslados")
      } else {
        setCompanyMode("select")
      }
    }
  }, [selectedEventId, selectedEventDetails, modalMode])

  // Helper for pill color according to satisfaction level
  const getQualityColor = (index: number) => {
    if (index >= 85) return { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Excelente" }
    if (index >= 70) return { bg: "bg-blue-50 text-blue-700 border-blue-100", label: "Muy Bueno" }
    if (index >= 55) return { bg: "bg-amber-50 text-amber-700 border-amber-100", label: "Bueno" }
    if (index >= 40) return { bg: "bg-orange-50 text-orange-700 border-orange-100", label: "Regular" }
    return { bg: "bg-rose-50 text-rose-700 border-rose-100", label: "Crítico" }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12 pb-32">
      
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-8">
        <div className="space-y-2">
          <Link href="/informes" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition">
            <ArrowLeft size={14} /> Volver a Informes
          </Link>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Smile className="text-amber-500" size={36} /> Central de <span className="text-indigo-600">Satisfacción</span>
          </h1>
          <p className="text-slate-500 font-medium">Historial y tasa de respuesta sobre encuestas de satisfacción de viandas por show.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white font-black uppercase text-xs tracking-wider px-5 py-3 rounded-2xl hover:bg-indigo-700 active:scale-95 transition shadow-lg shadow-indigo-100"
        >
          <Plus size={16} /> Subir Datos Viejos / Nueva Encuesta
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-24 space-y-4">
          <Loader2 className="animate-spin text-indigo-600" size={48} />
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Cargando satisfacción de clientes...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl text-sm font-bold flex items-center gap-4">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-black text-base uppercase">Error de Servidor</p>
            <p className="text-rose-600 font-medium mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* STATS OVERVIEW - Vista Macro */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Global Satisfaction Index */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Calidad Percibida</span>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic">Índice Global</h3>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Smile size={20} />
                </div>
              </div>
              <div className="my-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-slate-900 tracking-tight">{macroStats.avgIndex}%</span>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${getQualityColor(macroStats.avgIndex).bg}`}>
                    {getQualityColor(macroStats.avgIndex).label}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" 
                    style={{ width: `${macroStats.avgIndex}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Promedio ponderado global: Exc (100%), M.Bueno (80%), Bueno (60%), Reg (40%), Malo (10%).
              </p>
            </div>

            {/* Card 2: Average Response Rate */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nivel de Feedback</span>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic">Tasa de Respuesta</h3>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Percent size={20} />
                </div>
              </div>
              <div className="my-4">
                <span className="text-5xl font-black text-slate-900 tracking-tight">{macroStats.avgResponseRate}%</span>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Respuestas recibidas vs viandas vendidas totales.
                </p>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Cruza respuestas con las facturas cargadas en el sistema para calcular efectividad.
              </p>
            </div>

            {/* Card 3: Total Votes */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Muestreo Total</span>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic">Encuestas Totales</h3>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <MessageSquare size={20} />
                </div>
              </div>
              <div className="my-4">
                <span className="text-5xl font-black text-slate-900 tracking-tight">{macroStats.totalResponses}</span>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Opiniones procesadas en el histórico.
                </p>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Muestra consolidada de todos los shows auditados en el sistema.
              </p>
            </div>

            {/* Card 4: Best Show */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Máximo Histórico</span>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic">Show Destacado</h3>
                </div>
                <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl">
                  <Sparkles size={20} />
                </div>
              </div>
              <div className="my-4 space-y-1">
                <p className="text-xl font-black text-slate-800 truncate uppercase italic">{macroStats.bestEvent}</p>
                <div className="flex items-center gap-1.5 text-emerald-600 font-black text-sm">
                  <TrendingUp size={16} /> {macroStats.bestEventIndex}% satisfacción
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                El evento de mayor calidad y mejor reputación de vianda registrado.
              </p>
            </div>
          </div>

          {/* DISTRIBUTION CHART - Distribución Global de Calificaciones */}
          {reports.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Graphic Card */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" size={22} /> Distribución Global de Calificaciones
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Conteo total acumulado de respuestas por categoría</p>
                </div>

                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} fontWeight="bold" tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} fontWeight="bold" tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: '#F8FAFC' }}
                        contentStyle={{ 
                          backgroundColor: '#FFF', 
                          borderRadius: '16px', 
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Bar dataKey="votos" radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Score weights card */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 rounded-[2rem] text-white flex flex-col justify-between shadow-xl">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block">Explicativo de Fórmulas</span>
                    <h3 className="text-2xl font-black uppercase italic tracking-tight">Índice Ponderado</h3>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                      El Módulo de Satisfacción evalúa la vianda bajo un criterio de satisfacción ponderado de 0 a 100%:
                    </p>

                    <div className="space-y-2 border-t border-indigo-900/50 pt-4">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Excelente</span>
                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md text-[10px]">100 Puntos</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Muy Bueno</span>
                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md text-[10px]">80 Puntos</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Bueno / Aceptable</span>
                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md text-[10px]">60 Puntos</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Regular</span>
                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md text-[10px]">40 Puntos</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Malo</span>
                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md text-[10px]">10 Puntos</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-900/30 border border-indigo-800/40 p-4 rounded-2xl flex gap-3 items-start mt-6">
                  <Info className="text-indigo-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-[10px] text-indigo-200 font-semibold leading-normal">
                    La tasa de respuesta mide la representatividad. Si se encuestan 10 personas pero se vendieron 100 viandas, la tasa será de 10%.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIAL GENERAL POR EVENTO */}
          <div className="space-y-6">
            
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                  <Calendar size={18} />
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Historial Detallado de Calidad</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Text search */}
                <div className="relative flex-1 md:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Buscar show, venue, empresa..." 
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition w-full md:w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Company filter dropdown */}
                <select 
                  className="bg-white border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                  value={selectedCompanyFilter}
                  onChange={e => setSelectedCompanyFilter(e.target.value)}
                >
                  <option value="all">Todas las Empresas</option>
                  {uniqueCompanies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                {filteredReports.length === 0 ? (
                  <div className="p-20 text-center space-y-3">
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No se encontraron encuestas registradas</p>
                    <p className="text-slate-300 font-semibold text-xs">Cargue datos viejos usando el botón en el encabezado.</p>
                  </div>
                ) : (
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <th className="p-4 pl-8">Fecha / Show</th>
                        <th className="p-4">Venue</th>
                        <th className="p-4">Empresa</th>
                        <th className="p-4 text-center">Respuestas / Ventas</th>
                        <th className="p-4 text-center">Tasa Respuesta</th>
                        <th className="p-4">Segmentación de Opinión</th>
                        <th className="p-4 text-center">Calidad Ponderada</th>
                        <th className="p-4 pr-8 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {filteredReports.map((row) => {
                        const satisfactionPill = getQualityColor(row.indice_satisfaccion)
                        
                        // Total breakdown segments for horizontal bar
                        const total = row.total_respuestas || 1
                        const pctExc = (row.respuestas_excelente / total) * 100
                        const pctMbu = (row.respuestas_muy_bueno / total) * 100
                        const pctBue = (row.respuestas_bueno / total) * 100
                        const pctReg = (row.respuestas_regular / total) * 100
                        const pctMal = (row.respuestas_malo / total) * 100

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 pl-8 max-w-[280px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">
                                  {new Date(row.event_date + 'T12:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })}
                                </span>
                                <span className="font-black text-slate-900 uppercase italic truncate">{row.show_name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                                <MapPin size={12} className="text-slate-400" /> {row.venue_name}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                <Building2 size={10} /> {row.company_name}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-600">
                              {row.total_respuestas} <span className="text-slate-300 mx-1">/</span> <span className="text-slate-400 font-semibold">{row.unidades_vendidas || "S/D"}</span>
                            </td>
                            <td className="p-4 text-center">
                              {row.unidades_vendidas > 0 ? (
                                <span className="font-black text-slate-800">{row.tasa_respuesta}%</span>
                              ) : (
                                <span className="text-slate-300 font-medium">0% (Sin Ventas)</span>
                              )}
                            </td>
                            <td className="p-4 w-[200px] min-w-[200px]">
                              {row.total_respuestas > 0 ? (
                                <div className="space-y-1">
                                  {/* Multi-segmented progress bar */}
                                  <div className="w-full bg-slate-100 h-2 rounded-full flex overflow-hidden">
                                    <div style={{ width: `${pctExc}%` }} className="bg-emerald-500" title={`Excelente: ${row.respuestas_excelente}`} />
                                    <div style={{ width: `${pctMbu}%` }} className="bg-blue-500" title={`Muy Bueno: ${row.respuestas_muy_bueno}`} />
                                    <div style={{ width: `${pctBue}%` }} className="bg-amber-500" title={`Bueno: ${row.respuestas_bueno}`} />
                                    <div style={{ width: `${pctReg}%` }} className="bg-orange-500" title={`Regular: ${row.respuestas_regular}`} />
                                    <div style={{ width: `${pctMal}%` }} className="bg-rose-500" title={`Malo: ${row.respuestas_malo}`} />
                                  </div>
                                  {/* Detailed breakdown in miniature numbers */}
                                  <div className="flex gap-2 justify-between text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                    <span>E: {row.respuestas_excelente}</span>
                                    <span>MB: {row.respuestas_muy_bueno}</span>
                                    <span>B: {row.respuestas_bueno}</span>
                                    <span>R: {row.respuestas_regular}</span>
                                    <span>M: {row.respuestas_malo}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-medium">Sin datos</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center border font-black text-sm px-3 py-1 rounded-xl shadow-sm ${satisfactionPill.bg}`}>
                                {row.indice_satisfaccion}%
                              </span>
                            </td>
                            <td className="p-4 pr-8 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button 
                                  onClick={() => handleOpenEdit(row)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
                                  title="Editar"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(row.id, row.show_name, row.company_name)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition"
                                  title="Eliminar"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* POPUP MODAL FOR UPLOAD / EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
            
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                  <Sparkles className="text-amber-500" size={20} /> {modalMode === "create" ? "Subir Datos de Satisfacción" : "Editar Encuesta de Satisfacción"}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Vincular calificaciones a un show del sistema</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition font-black text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-6 flex-1">
              
              {/* Event dropdown selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" /> 1. Seleccionar Show Ejecutado
                </label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold p-3.5 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  required
                >
                  <option value="" disabled>Seleccione un show...</option>
                  {salesSummary.map(s => (
                    <option key={s.event_master_id} value={s.event_master_id}>
                      {new Date(s.event_date + 'T12:00:00').toLocaleDateString('es-AR')} - {s.show_name} ({s.venue_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Selection details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={14} className="text-slate-400" /> 2. Empresa / Cliente
                  </label>
                  
                  {/* Select Mode Switcher */}
                  <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-[9px] font-black uppercase">
                    <button 
                      type="button"
                      className={`px-2 py-1 rounded ${companyMode === "select" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                      onClick={() => setCompanyMode("select")}
                    >
                      Buscar en Ventas
                    </button>
                    <button 
                      type="button"
                      className={`px-2 py-1 rounded ${companyMode === "custom" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                      onClick={() => setCompanyMode("custom")}
                    >
                      Escribir Otro
                    </button>
                  </div>
                </div>

                {companyMode === "select" ? (
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold p-3.5 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                    value={selectedCompany}
                    onChange={e => setSelectedCompany(e.target.value)}
                    required
                  >
                    <option value="" disabled>Seleccione empresa...</option>
                    {selectedEventDetails?.companies.map(c => (
                      <option key={c.company_name} value={c.company_name}>
                        {c.company_name} ({c.sold_qty} viandas vendidas)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text"
                    placeholder="Ej: RV Traslados"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold p-3.5 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                    value={customCompany}
                    onChange={e => setCustomCompany(e.target.value)}
                    required
                  />
                )}

                {/* Sold units micro-feedback */}
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2.5 text-[10px] text-slate-500 font-semibold leading-normal">
                  <Info className="text-slate-400 shrink-0" size={14} />
                  <span>
                    {currentUnitsSold > 0 ? (
                      <>Se registran <strong className="text-indigo-600">{currentUnitsSold} unidades vendidas</strong> para este cliente. La tasa de respuesta será calculada dinámicamente.</>
                    ) : (
                      <>No se registran ventas para este cliente en el show seleccionado. La tasa de respuesta figurará como <strong className="text-amber-600">0% (Sin Ventas)</strong>.</>
                    )}
                  </span>
                </div>
              </div>

              {/* OPINIONS COUNTER SCORING */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Smile size={14} className="text-amber-500" /> 3. Cantidad de Opiniones Recibidas
                </label>

                <div className="grid grid-cols-2 gap-4">
                  {/* Excelente */}
                  <div className="space-y-1 bg-emerald-50/20 border border-emerald-100/50 p-3.5 rounded-2xl">
                    <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Excelente
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-emerald-100 text-center"
                      value={respExcelente}
                      onChange={e => {
                        const val = e.target.value;
                        setRespExcelente(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                    />
                  </div>

                  {/* Muy Bueno */}
                  <div className="space-y-1 bg-blue-50/20 border border-blue-100/50 p-3.5 rounded-2xl">
                    <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Muy Bueno
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-blue-100 text-center"
                      value={respMuyBueno}
                      onChange={e => {
                        const val = e.target.value;
                        setRespMuyBueno(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                    />
                  </div>

                  {/* Bueno */}
                  <div className="space-y-1 bg-amber-50/20 border border-amber-100/50 p-3.5 rounded-2xl">
                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Bueno / Acep.
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-amber-100 text-center"
                      value={respBueno}
                      onChange={e => {
                        const val = e.target.value;
                        setRespBueno(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                    />
                  </div>

                  {/* Regular */}
                  <div className="space-y-1 bg-orange-50/20 border border-orange-100/50 p-3.5 rounded-2xl">
                    <label className="text-[10px] font-black text-orange-700 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500" /> Regular
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-orange-100 text-center"
                      value={respRegular}
                      onChange={e => {
                        const val = e.target.value;
                        setRespRegular(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Malo */}
                  <div className="space-y-1 bg-rose-50/20 border border-rose-100/50 p-3.5 rounded-2xl">
                    <label className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Malo
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-rose-100 text-center"
                      value={respMalo}
                      onChange={e => {
                        const val = e.target.value;
                        setRespMalo(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                    />
                  </div>

                  {/* Instant calculation summary within the form */}
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col justify-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pre-Cálculo de Calidad</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black text-slate-800">
                        {(() => {
                          const valExc = Number(respExcelente) || 0
                          const valMuy = Number(respMuyBueno) || 0
                          const valBue = Number(respBueno) || 0
                          const valReg = Number(respRegular) || 0
                          const valMal = Number(respMalo) || 0
                          const tot = valExc + valMuy + valBue + valReg + valMal
                          if (tot === 0) return 0
                          return Math.round(
                            ((valExc * 100) + (valMuy * 80) + (valBue * 60) + (valReg * 40) + (valMal * 10)) / tot
                          )
                        })()}%
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Satisfacción</span>
                    </div>
                    <span className="text-[8px] text-slate-400 font-semibold mt-0.5">
                      Votos totales: {Number(respExcelente) + Number(respMuyBueno) + Number(respBueno) + Number(respRegular) + Number(respMalo)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal footer / Actions */}
              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-500 hover:bg-slate-50 active:scale-95 transition"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition flex items-center gap-2 shadow-lg shadow-indigo-100"
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="animate-spin" size={14} />}
                  {modalMode === "create" ? "Guardar Encuesta" : "Actualizar Encuesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
