"use client"

import React, { useState, useEffect } from "react"
import { getFinancialReportsAction, getIngredientPriceEvolutionAction, FinancialReportData } from "@/app/actions/reports"
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from "recharts"
import { 
  DollarSign, TrendingDown, TrendingUp, ArrowLeft, 
  Loader2, PieChart, Wallet, Truck, Package, Activity 
} from "lucide-react"
import Link from "next/link"

export default function FinancialReportsPage() {
  const [data, setData] = useState<FinancialReportData[]>([])
  const [priceData, setPriceData] = useState<Record<string, { productNames: string[], data: any[] }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Mes seleccionado (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  useEffect(() => {
    async function loadFinancial() {
      const res = await getFinancialReportsAction()
      if (res.error) setError(res.error)
      else if (res.data) {
        setData(res.data)
        const now = new Date()
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const exists = res.data.find(d => d.month === currentKey)
        if (exists) setSelectedMonth(currentKey)
        else if (res.data.length > 0) setSelectedMonth(res.data[res.data.length - 1].month)
      }
      setLoading(false)
    }
    loadFinancial()
  }, [])

  useEffect(() => {
    async function loadPrices() {
      if (!selectedMonth) return;
      const pRes = await getIngredientPriceEvolutionAction(selectedMonth)
      if (pRes.data) setPriceData(pRes.data)
    }
    loadPrices()
  }, [selectedMonth])

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)

  const getDeviation = (real: number, teorico: number, isExpense: boolean) => {
    const diff = real - teorico;
    if (teorico === 0) {
      if (real === 0) return null;
      return {
        text: `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`,
        isPositive: isExpense ? false : true
      };
    }
    const pct = (diff / teorico) * 100;
    const isPositive = isExpense ? (diff <= 0) : (diff >= 0);
    return {
      text: `${diff > 0 ? '+' : ''}${formatCurrency(diff)} (${diff > 0 ? '+' : ''}${pct.toFixed(1)}%)`,
      isPositive
    };
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="font-bold tracking-widest uppercase text-sm italic">Consolidando estados financieros...</p>
    </div>
  )

  // Datos filtrados para las tarjetas KPI
  const currentMonthData = selectedMonth === "all"
    ? data.reduce<FinancialReportData>((acc, m) => ({
        month: "all",
        monthName: "Todo el año",
        ventas: acc.ventas + m.ventas,
        materiaPrima: acc.materiaPrima + m.materiaPrima,
        logistica: acc.logistica + m.logistica,
        extras: acc.extras + m.extras,
        comisiones: acc.comisiones + m.comisiones,
        totalGastos: acc.totalGastos + m.totalGastos,
        utilidad: acc.utilidad + m.utilidad,
        ventasReal: acc.ventasReal + m.ventasReal,
        materiaPrimaReal: acc.materiaPrimaReal + m.materiaPrimaReal,
        logisticaReal: acc.logisticaReal + m.logisticaReal,
        extrasReal: acc.extrasReal + m.extrasReal,
        gastosEstructuraReal: acc.gastosEstructuraReal + m.gastosEstructuraReal,
        egrVariosReal: acc.egrVariosReal + m.egrVariosReal,
        totalGastosReal: acc.totalGastosReal + m.totalGastosReal,
        utilidadReal: acc.utilidadReal + m.utilidadReal
      }), {
        month: "all",
        monthName: "Todo el año",
        ventas: 0, materiaPrima: 0, logistica: 0, extras: 0, comisiones: 0, totalGastos: 0, utilidad: 0,
        ventasReal: 0, materiaPrimaReal: 0, logisticaReal: 0, extrasReal: 0, gastosEstructuraReal: 0, egrVariosReal: 0, totalGastosReal: 0, utilidadReal: 0
      })
    : data.find(m => m.month === selectedMonth) || { 
        month: "", monthName: "", ventas: 0, materiaPrima: 0, logistica: 0, extras: 0, comisiones: 0, totalGastos: 0, utilidad: 0, gastosEstructuraReal: 0, materiaPrimaReal: 0, logisticaReal: 0, extrasReal: 0, ventasReal: 0, egrVariosReal: 0, totalGastosReal: 0, utilidadReal: 0
      };

  const priceDataByFamily = priceData || {};
  const families = Object.keys(priceDataByFamily);

  const lineColors = ["#4f46e5", "#e11d48", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#71717a"];

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link href="/informes" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 hover:border-rose-100 transition shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
              Análisis <span className="text-rose-600">Financiero</span>
            </h1>
            <p className="text-slate-500 font-medium italic">Monitor de rentabilidad y salud económica.</p>
          </div>
        </div>

        {/* SELECTOR DE MES */}
        <div className="flex items-center gap-3 bg-white p-2 pl-4 rounded-2xl border border-slate-200 shadow-sm">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodo:</span>
           <select 
             value={selectedMonth} 
             onChange={(e) => setSelectedMonth(e.target.value)}
             className="bg-slate-50 border-none outline-none font-black text-slate-900 text-xs uppercase p-2 rounded-xl cursor-pointer hover:bg-slate-100 transition"
           >
             <option value="all">Todo el año</option>
             {data.map(m => (
               <option key={m.month} value={m.month}>{m.monthName}</option>
             ))}
           </select>
        </div>
      </div>

      {error && <div className="p-6 bg-rose-50 border border-rose-100 text-rose-600 rounded-3xl font-bold">{error}</div>}

      {/* KPI Cards (Filtradas por el mes seleccionado) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Ventas */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl w-fit"><Wallet size={20}/></div>
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Ingresos</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ventas {currentMonthData.monthName}</p>
              
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Real (Caja):</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(currentMonthData.ventasReal)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Teórico:</span>
                  <span className="text-xs font-black text-slate-500">{formatCurrency(currentMonthData.ventas)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desvío */}
          <div className="mt-4 pt-2 border-t border-dashed border-slate-150 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase">Desvío:</span>
            {(() => {
              const dev = getDeviation(currentMonthData.ventasReal, currentMonthData.ventas, false);
              if (!dev) return <span className="text-[9px] font-bold text-slate-400">Sin desvío</span>;
              return (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${dev.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {dev.text}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Materia Prima */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl w-fit"><Package size={20}/></div>
              <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Costo</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Materia Prima</p>
              
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Real (Caja):</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(currentMonthData.materiaPrimaReal)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Teórico:</span>
                  <span className="text-xs font-black text-slate-500">{formatCurrency(currentMonthData.materiaPrima)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desvío */}
          <div className="mt-4 pt-2 border-t border-dashed border-slate-150 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase">Desvío:</span>
            {(() => {
              const dev = getDeviation(currentMonthData.materiaPrimaReal, currentMonthData.materiaPrima, true);
              if (!dev) return <span className="text-[9px] font-bold text-slate-400">Sin desvío</span>;
              return (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${dev.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {dev.text}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Gastos Estructura */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl w-fit"><Truck size={20}/></div>
              <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Fijos</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gastos Estructura</p>
              
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Real (Caja):</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(currentMonthData.gastosEstructuraReal)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Teórico:</span>
                  <span className="text-xs font-black text-slate-500">
                    {formatCurrency(currentMonthData.logistica + currentMonthData.extras + currentMonthData.comisiones)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Desvío */}
          <div className="mt-4 pt-2 border-t border-dashed border-slate-150 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase">Desvío:</span>
            {(() => {
              const teoricoEstructura = currentMonthData.logistica + currentMonthData.extras + currentMonthData.comisiones;
              const dev = getDeviation(currentMonthData.gastosEstructuraReal, teoricoEstructura, true);
              if (!dev) return <span className="text-[9px] font-bold text-slate-400">Sin desvío</span>;
              return (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${dev.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {dev.text}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Egresos Varios */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl w-fit"><Activity size={20}/></div>
              <span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Otros</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Egresos Varios</p>
              
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Real (Caja):</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(currentMonthData.egrVariosReal)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Teórico:</span>
                  <span className="text-xs font-black text-slate-500">$0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desvío */}
          <div className="mt-4 pt-2 border-t border-dashed border-slate-150 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase">Desvío:</span>
            {(() => {
              const dev = getDeviation(currentMonthData.egrVariosReal, 0, true);
              if (!dev) return <span className="text-[9px] font-bold text-slate-400">Sin desvío</span>;
              return (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${dev.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {dev.text}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Utilidad Operativa */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl w-fit"><TrendingUp size={20}/></div>
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Neto</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Utilidad Operativa</p>
              
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Real (Caja):</span>
                    <span className="text-[8px] font-bold text-emerald-500">
                      {((currentMonthData.utilidadReal / (currentMonthData.ventasReal || 1)) * 100).toFixed(1)}% margen
                    </span>
                  </div>
                  <span className="text-xl font-black text-emerald-600">{formatCurrency(currentMonthData.utilidadReal)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Teórico:</span>
                    <span className="text-[8px] font-bold text-slate-400">
                      {((currentMonthData.utilidad / (currentMonthData.ventas || 1)) * 100).toFixed(1)}% margen
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-500">{formatCurrency(currentMonthData.utilidad)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desvío */}
          <div className="mt-4 pt-2 border-t border-dashed border-slate-150 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase">Desvío:</span>
            {(() => {
              const dev = getDeviation(currentMonthData.utilidadReal, currentMonthData.utilidad, false);
              if (!dev) return <span className="text-[9px] font-bold text-slate-400">Sin desvío</span>;
              return (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${dev.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {dev.text}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* SECTION TITLE */}
      <div className="flex items-center gap-4 pt-8">
        <div className="h-px flex-1 bg-slate-200" />
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] italic">Evolución de Costos por Familia</h2>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {families.map((familyName, fIdx) => {
          const { productNames, data: fData } = priceDataByFamily[familyName];
          if (productNames.length === 0) return null;

          return (
            <div key={familyName} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6 hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">{familyName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Variación de costos unitarios</p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-500">{productNames.length} PRODUCTOS</span>
                </div>
              </div>
              
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="displayDate" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} 
                      interval={Math.floor(fData.length / 10)}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} 
                      width={40}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px'}}
                      labelStyle={{fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase'}}
                      itemStyle={{fontSize: '11px', fontWeight: 'bold', padding: '2px 0'}}
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}`, ""]}
                    />
                    <Legend 
                      iconType="circle" 
                      layout="horizontal" 
                      verticalAlign="top" 
                      align="left"
                      wrapperStyle={{paddingBottom: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b'}} 
                    />
                    {productNames.map((p: string, i: number) => (
                      <Line 
                        key={p} 
                        type="stepAfter" 
                        dataKey={p} 
                        name={p}
                        stroke={lineColors[(fIdx + i) % lineColors.length]} 
                        strokeWidth={3} 
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }} 
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  )
}
