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

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="font-bold tracking-widest uppercase text-sm italic">Consolidando estados financieros...</p>
    </div>
  )

  // Datos filtrados para las tarjetas KPI
  const currentMonthData = data.find(m => m.month === selectedMonth) || { 
    month: "", monthName: "", ventas: 0, materiaPrima: 0, logistica: 0, extras: 0, comisiones: 0, totalGastos: 0, utilidad: 0 
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
             {data.map(m => (
               <option key={m.month} value={m.month}>{m.monthName}</option>
             ))}
           </select>
        </div>
      </div>

      {error && <div className="p-6 bg-rose-50 border border-rose-100 text-rose-600 rounded-3xl font-bold">{error}</div>}

      {/* KPI Cards (Filtradas por el mes seleccionado) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl w-fit"><Wallet size={20}/></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas {currentMonthData.monthName}</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(currentMonthData.ventas)}</p>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
             <DollarSign size={80} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl w-fit"><Package size={20}/></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Materia Prima</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(currentMonthData.materiaPrima)}</p>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
             <PieChart size={80} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl w-fit"><Truck size={20}/></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logística y Extras</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(currentMonthData.logistica + currentMonthData.extras)}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
              {((currentMonthData.materiaPrima / (currentMonthData.ventas || 1)) * 100).toFixed(1)}% de venta
            </span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Utilidad Operativa</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(currentMonthData.utilidad)}</p>
          <div className="mt-4 flex items-center gap-2">
             <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
               {((currentMonthData.utilidad / (currentMonthData.ventas || 1)) * 100).toFixed(1)}% margen
             </span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-slate-600 transition-colors">Gastos Estructura</p>
          <p className="text-2xl font-black text-slate-400">{formatCurrency(currentMonthData.logistica + currentMonthData.extras + currentMonthData.comisiones)}</p>
          <div className="mt-4 h-1.5 w-full bg-slate-50 rounded-full" />
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
