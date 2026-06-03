"use client"

import React, { useState, useEffect, useMemo } from "react"
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, AreaChart, Area,
  PieChart, Pie, Cell 
} from "recharts"
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, 
  Calendar, Layers, ArrowUpRight, ArrowDownRight, 
  Percent, FileSpreadsheet, ListOrdered, Award, Zap, UploadCloud, Plus
} from "lucide-react"
import Link from "next/link"

interface CashMovement {
  id: string
  sucursal: string
  mes: string
  fecha: string
  semana: string
  turno: string
  tipo: string
  concepto: string
  cod_cga: string
  conc_caja: string
  detalle: string
  importe: number
  esrecu: string
  oculta: string
  rubro: string
}

interface CashFlowReportsProps {
  movements: CashMovement[]
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6", "#f43f5e", "#14b8a6"]

export default function CashFlowReports({ movements }: CashFlowReportsProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all") 
  const [activeExpenseTab, setActiveExpenseTab] = useState<'concepto' | 'conc_caja'>('concepto')
  const [selectedConceptFilter, setSelectedConceptFilter] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset filter when period changes
  useEffect(() => {
    setSelectedConceptFilter(null)
  }, [selectedPeriod])

  // 1. Obtener la lista única de meses disponibles
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(movements.map(m => m.mes))).filter(Boolean)
    return months.sort((a, b) => a.localeCompare(b))
  }, [movements])

  // 2. Filtrar movimientos según el periodo seleccionado
  const filteredMovements = useMemo(() => {
    if (selectedPeriod === "all") return movements
    return movements.filter(m => m.mes === selectedPeriod)
  }, [movements, selectedPeriod])

  // 3. Totales KPI (Ingresos, Egresos, Saldo, Rentabilidad)
  const kpis = useMemo(() => {
    let ingresos = 0
    let egresos = 0

    filteredMovements.forEach(m => {
      if (m.importe > 0) {
        ingresos += m.importe
      } else {
        egresos += m.importe 
      }
    })

    const saldo = ingresos + egresos
    const rentabilidad = ingresos > 0 ? (saldo / ingresos) * 100 : 0

    return {
      ingresos,
      egresos: Math.abs(egresos),
      saldo,
      rentabilidad
    }
  }, [filteredMovements])

  // 4. Datos Mensuales (para gráfico de barras y tabla histórica)
  const monthlyData = useMemo(() => {
    const groups: Record<string, { mes: string, ingresos: number, egresos: number, saldo: number }> = {}

    availableMonths.forEach(m => {
      groups[m] = { mes: m, ingresos: 0, egresos: 0, saldo: 0 }
    })

    movements.forEach(m => {
      const month = m.mes
      if (!month) return
      if (!groups[month]) {
        groups[month] = { mes: month, ingresos: 0, egresos: 0, saldo: 0 }
      }
      if (m.importe > 0) {
        groups[month].ingresos += m.importe
      } else {
        groups[month].egresos += Math.abs(m.importe)
      }
      groups[month].saldo += m.importe
    })

    return Object.values(groups).sort((a, b) => a.mes.localeCompare(b.mes))
  }, [movements, availableMonths])

  // 5a. Datos por Rubro de Gasto (Mapeado a Concepto)
  const rubrosData = useMemo(() => {
    const groups: Record<string, number> = {}
    let totalGastos = 0

    filteredMovements.forEach(m => {
      if (m.importe < 0) { 
        const rubro = m.concepto || "Sin Concepto"
        const absVal = Math.abs(m.importe)
        groups[rubro] = (groups[rubro] || 0) + absVal
        totalGastos += absVal
      }
    })

    return Object.entries(groups)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalGastos > 0 ? (value / totalGastos) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredMovements])

  // 5b. Datos por Categoría (Mapeado a Concepto de Maxirest)
  const tiposData = useMemo(() => {
    const groups: Record<string, number> = {}
    let totalGastos = 0

    filteredMovements.forEach(m => {
      if (m.importe < 0) { 
        // Usamos m.concepto (columna 7 o similar que trae los nombres de las categorías)
        const tipo = m.concepto || "Sin Clasificar"
        const absVal = Math.abs(m.importe)
        groups[tipo] = (groups[tipo] || 0) + absVal
        totalGastos += absVal
      }
    })

    return Object.entries(groups)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalGastos > 0 ? (value / totalGastos) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredMovements])

  // 6. Evolución del Saldo Acumulado (Línea de tiempo detallada)
  const timelineData = useMemo(() => {
    // Ordenar cronológicamente
    const sorted = [...filteredMovements].sort((a, b) => a.fecha.localeCompare(b.fecha))
    let accum = 0
    
    // Agrupar por fecha para no tener demasiados puntos si hay muchos movimientos el mismo día
    const dailyAccum: Record<string, number> = {}
    sorted.forEach(m => {
      accum += m.importe
      dailyAccum[m.fecha] = accum
    })

    return Object.entries(dailyAccum).map(([fecha, saldo]) => ({
      fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      saldo
    }))
  }, [filteredMovements])

  // 7. Top 5 Mayores Gastos por Concepto de Caja (conc_caja)
  const topExpenses = useMemo(() => {
    const groups: Record<string, number> = {}
    
    filteredMovements.forEach(m => {
      if (m.importe < 0) {
        // Si hay un concepto seleccionado en la Distribución, filtramos por él
        if (selectedConceptFilter && m.concepto !== selectedConceptFilter) {
          return
        }
        const key = m.conc_caja || "Sin Clasificar"
        groups[key] = (groups[key] || 0) + Math.abs(m.importe)
      }
    })

    return Object.entries(groups)
      .map(([name, value]) => ({
        name,
        value
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredMovements, selectedConceptFilter])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(val)
  }

  const exportToExcel = () => {
    try {
      const { utils, writeFile } = require("xlsx")
      
      // Hoja 1: Resumen Mensual
      const dataResumen = monthlyData.map(m => ({
        'Mes': m.mes,
        'Ingresos ($)': m.ingresos,
        'Egresos ($)': m.egresos,
        'Saldo Neto ($)': m.saldo,
        'Margen Rentabilidad (%)': m.ingresos > 0 ? ((m.saldo / m.ingresos) * 100).toFixed(2) : '0.00'
      }))
      const wsResumen = utils.json_to_sheet(dataResumen)
      
      // Hoja 2: Gastos por Rubro (Concepto)
      const dataRubros = rubrosData.map(r => ({
        'Rubro Gasto (Concepto)': r.name,
        'Importe ($)': r.value,
        'Participación (%)': r.percentage.toFixed(2)
      }))
      const wsRubros = utils.json_to_sheet(dataRubros)

      // Hoja 3: Gastos por Tipo (Conc Caja)
      const dataTipos = tiposData.map(t => ({
        'Tipo Gasto (Concepto Caja)': t.name,
        'Importe ($)': t.value,
        'Participación (%)': t.percentage.toFixed(2)
      }))
      const wsTipos = utils.json_to_sheet(dataTipos)

      const wb = utils.book_new()
      utils.book_append_sheet(wb, wsResumen, "Resumen Mensual")
      utils.book_append_sheet(wb, wsRubros, "Gastos por Rubro (Concepto)")
      utils.book_append_sheet(wb, wsTipos, "Gastos por Tipo (Caja)")
      
      writeFile(wb, `Informe_Finanzas_Caja_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err) {
      console.error("Export error:", err)
    }
  }

  if (!mounted) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-pulse text-indigo-500 font-bold uppercase tracking-widest">
          Cargando gráficos interactivos...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-32">
      
      {/* SELECTOR DE PERIODO & EXPORTAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="text-slate-400" size={20} />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Periodo de Análisis:</span>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-50 border-none outline-none font-black text-slate-800 text-xs uppercase px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition"
          >
            <option value="all">Ver Histórico Completo</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link 
            href="/finanzas?manual=true"
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm w-full sm:w-auto justify-center"
          >
            <Plus size={16} />
            Registrar Movimiento
          </Link>

          <Link 
            href="/finanzas"
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm w-full sm:w-auto justify-center"
          >
            <UploadCloud size={16} />
            Importar Datos
          </Link>

          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm w-full sm:w-auto justify-center"
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Ingresos */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit flex items-center justify-center">
            <ArrowUpRight size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Ingresos de Caja</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(kpis.ingresos)}</p>
          <div className="absolute -top-3 -right-3 p-4 opacity-5 text-emerald-600 group-hover:opacity-10 transition">
            <DollarSign size={90} />
          </div>
        </div>

        {/* Egresos */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit flex items-center justify-center">
            <ArrowDownRight size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Egresos / Gastos</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(kpis.egresos)}</p>
          <div className="absolute -top-3 -right-3 p-4 opacity-5 text-rose-600 group-hover:opacity-10 transition">
            <TrendingDown size={90} />
          </div>
        </div>

        {/* Saldo Neto */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className={`p-3 rounded-2xl w-fit flex items-center justify-center ${kpis.saldo >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
            <TrendingUp size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Saldo Neto Operativo</p>
          <p className={`text-2xl font-black mt-1 ${kpis.saldo >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>
            {formatCurrency(kpis.saldo)}
          </p>
          <div className="absolute -top-3 -right-3 p-4 opacity-5 text-indigo-600 group-hover:opacity-10 transition">
            <DollarSign size={90} />
          </div>
        </div>

        {/* Rentabilidad */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl w-fit flex items-center justify-center">
            <Percent size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Eficiencia Financiera</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{kpis.rentabilidad.toFixed(1)}%</p>
          <div className="mt-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {kpis.rentabilidad >= 0 ? "Flujo de caja con superávit" : "Flujo de caja con déficit"}
            </span>
          </div>
          <div className="absolute -top-3 -right-3 p-4 opacity-5 text-fuchsia-600 group-hover:opacity-10 transition">
            <Zap size={90} />
          </div>
        </div>
      </div>

      {/* EVOLUCIÓN HISTÓRICA & ACUMULADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico 1: Evolución Mensual (Ingresos vs Egresos) */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
              <Calendar size={20} className="text-indigo-500" /> Evolución de Caja por Mes
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingresos vs Egresos por periodo</p>
          </div>
          
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="mes" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                  labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                  formatter={(val: any) => [formatCurrency(Number(val)), ""]}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', paddingTop: '15px' }}
                />
                <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="egresos" name="Egresos" fill="#f43f5e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Saldo Acumulado (Timeline) */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" /> Tendencia de Saldo Acumulado
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evolución progresiva de fondos en el periodo seleccionado</p>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="fecha" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                  tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                  labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                  formatter={(val: any) => [formatCurrency(Number(val)), "Saldo Acumulado"]}
                />
                <Area type="monotone" dataKey="saldo" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSaldo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* GASTOS POR CATEGORÍA & TOP GASTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Distribución por Categorías (Gráfico + Barra de Progreso) */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
                <Layers size={20} className="text-amber-500" /> Distribución de Egresos
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Participación en la estructura de egresos</p>
            </div>
            {/* TABS REMOVED: El análisis siempre es sobre conc_caja */}
          </div>

          {(() => {
            const activeData = tiposData;
            return (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                
                {/* Torta circular de Recharts */}
                <div className="h-[200px] md:col-span-2 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {activeData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            onClick={() => setSelectedConceptFilter(prev => prev === entry.name ? null : entry.name)}
                            opacity={selectedConceptFilter === null || selectedConceptFilter === entry.name ? 1 : 0.3}
                            className="cursor-pointer transition-opacity duration-300 outline-none"
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center pointer-events-none select-none">
                    <PieIcon size={24} className="text-slate-300 mx-auto" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      Categorías
                    </span>
                  </div>
                </div>

                {/* Listado de progreso */}
                <div className="md:col-span-3 space-y-3">
                  {activeData.slice(0, 5).map((r, index) => {
                    const isSelected = selectedConceptFilter === r.name;
                    return (
                      <div 
                        key={r.name} 
                        onClick={() => setSelectedConceptFilter(prev => prev === r.name ? null : r.name)}
                        className={`space-y-1 cursor-pointer p-2.5 rounded-2xl transition border ${
                          isSelected 
                            ? 'bg-indigo-50/70 border-indigo-100 shadow-xs' 
                            : 'border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-2 truncate max-w-[180px]" title={r.name}>
                            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            {r.name}
                          </span>
                          <span className="font-black text-slate-900 flex-shrink-0">
                            {formatCurrency(r.value)}{" "}
                            <span className="text-[10px] font-bold text-slate-400 ml-1">({r.percentage.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${r.percentage}%`,
                              backgroundColor: COLORS[index % COLORS.length]
                            }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                  {activeData.length === 0 && (
                    <div className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-widest italic">
                      No hay gastos registrados en este periodo
                    </div>
                  )}
                </div>

              </div>
            );
          })()}
        </div>

        {/* Top 5 Mayores Egresos Single */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
              <ListOrdered size={20} className="text-rose-500" /> Mayores Egresos del Periodo
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Los 5 conceptos de caja con mayor gasto acumulado</p>
          </div>

          {selectedConceptFilter && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl p-3 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">
                  Filtro: {selectedConceptFilter}
                </span>
              </div>
              <button 
                onClick={() => setSelectedConceptFilter(null)}
                className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg shadow-xs transition uppercase"
              >
                Limpiar
              </button>
            </div>
          )}

          <div className="space-y-4">
            {topExpenses.map((m, idx) => (
              <div key={m.name} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition group">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl text-xs font-black">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate uppercase">{m.name}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                    Concepto de Caja • Columna I
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-rose-600">{formatCurrency(m.value)}</span>
                </div>
              </div>
            ))}

            {topExpenses.length === 0 && (
              <div className="text-center text-slate-400 py-12 text-xs font-bold uppercase tracking-widest italic">
                Sin egresos en el periodo
              </div>
            )}
          </div>
        </div>

      </div>

      {/* TABLA DE RESUMEN MENSUAL COMPLETO */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Award size={20} />
            </div>
            Resumen Consolidado Mensual de Fondos
          </h3>
          <Link 
            href="/finanzas"
            className="flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm"
          >
            <ListOrdered size={16} />
            Ver Registros Detallados
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="p-5 pl-8">Periodo</th>
                <th className="p-5 text-emerald-600">Ingresos Totales ($)</th>
                <th className="p-5 text-rose-600">Egresos Totales ($)</th>
                <th className="p-5 text-indigo-600">Saldo Neto ($)</th>
                <th className="p-5 text-right pr-8">Margen sobre Ingresos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {monthlyData.map((m) => {
                const margin = m.ingresos > 0 ? (m.saldo / m.ingresos) * 100 : 0
                return (
                  <tr key={m.mes} className="hover:bg-slate-50/50 transition">
                    <td className="p-5 pl-8 font-black text-slate-900 uppercase">{m.mes}</td>
                    <td className="p-5 font-bold text-emerald-600">{formatCurrency(m.ingresos)}</td>
                    <td className="p-5 font-bold text-rose-600">{formatCurrency(m.egresos)}</td>
                    <td className={`p-5 font-black ${m.saldo >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>
                      {formatCurrency(m.saldo)}
                    </td>
                    <td className="p-5 text-right pr-8 font-black text-slate-800">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${margin >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {margin >= 0 ? "+" : ""}{margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
