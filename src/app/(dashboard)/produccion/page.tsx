"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  ChefHat, Printer, Calendar, ChevronRight,
  Calculator, Loader2, Table as TableIcon, Building2, Users
} from "lucide-react"

export default function ProduccionPage() {
  const [eventos, setEventos] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [consolidado, setConsolidado] = useState<any>(null)
  const [eventsForSelectedDate, setEventsForSelectedDate] = useState<any[]>([])

  // Load events from events_master (with fallback to recitales_staging)
  useEffect(() => {
    const fetchEventos = async () => {
      // Try events_master first
      const { data: masterData, error: masterErr } = await supabase
        .from("events_master")
        .select("*, venues(name), event_projections(company_name, projected_pax)")
        .in("status", ["pendiente", "confirmado", "proyectado", "Pendiente", "Confirmado", "Proyectado"])
        .order("event_date", { ascending: true })

      if (!masterErr && masterData && masterData.length > 0) {
        setEventos(masterData.map((e: any) => ({
          ...e,
          _source: 'master',
          venue_name: e.venues?.name || '',
          total_projected_pax: (e.event_projections || []).reduce((acc: number, p: any) => acc + (p.projected_pax || 0), 0),
          companies: (e.event_projections || []).map((p: any) => p.company_name).join(', ')
        })))
      } else {
        // Fallback to recitales_staging
        const { data } = await supabase
          .from("recitales_staging")
          .select("*")
          .in("status", ["pendiente", "confirmado", "proyectado", "Pendiente", "Confirmado", "Proyectado"])
          .order("event_date", { ascending: true })
        setEventos((data || []).map((e: any) => ({ ...e, _source: 'staging', venue_name: e.venue, total_projected_pax: e.pax_projected })))
      }
      setInitialLoading(false)
    }
    fetchEventos()
  }, [])

  // Consolidation logic
  useEffect(() => {
    if (!selectedDate) { setConsolidado(null); setEventsForSelectedDate([]); return }

    const fetchConsolidado = async () => {
      setLoading(true)
      try {
        const eventsForDate = eventos.filter(e => e.event_date === selectedDate)
        setEventsForSelectedDate(eventsForDate)
        
        if (eventsForDate.length === 0) {
           setConsolidado({ total: 0, items: [], specials: {}, companies: [], headerCount: 0 })
           return
        }
        
        const eventIds = eventsForDate.map(e => e.id)

        // Find all sales headers for these events
        const { data: headers, error: hErr } = await supabase
          .from("event_sales_headers")
          .select("id, company, company_name")
          .or(`event_id.in.(${eventIds.join(',')}),event_master_id.in.(${eventIds.join(',')})`)

        if (hErr) throw hErr
        if (!headers || headers.length === 0) {
          setConsolidado({ total: 0, items: [], specials: {}, companies: [], headerCount: 0 })
          return
        }

        const headerIds = headers.map((h: any) => h.id)

        // Fetch all units linked to those headers
        const { data: units, error: uErr } = await supabase
          .from("event_sales_units")
          .select("traditional, vegetarian, vegana, sin_tacc, water_qty, water, special_breakdown, sold_qty, liberated_qty, unit_name")
          .in("header_id", headerIds)

        if (uErr) throw uErr

        // Aggregation
        const specialsMap: Record<string, { qty: number; note: string }[]> = {
          traditional: [], vegetarian: [], vegana: [], sin_tacc: []
        }

        const totals = (units || []).reduce((acc: any, u: any) => {
          if (u.special_breakdown) {
            try {
              const details = JSON.parse(u.special_breakdown)
              if (Array.isArray(details)) {
                details.forEach((d: any) => {
                  if ((Number(d.qty) > 0 || (d.note && d.note.trim() !== "")) && specialsMap[d.type]) {
                    specialsMap[d.type].push({ qty: Number(d.qty) || 0, note: d.note })
                  }
                })
              }
            } catch (e) { /* ignore parse error */ }
          }
          return {
            trad: acc.trad + (Number(u.traditional) || 0),
            veg: acc.veg + (Number(u.vegetarian) || 0),
            vegan: acc.vegan + (Number(u.vegana) || 0),
            st: acc.st + (Number(u.sin_tacc) || 0),
            water: acc.water + (Number(u.water_qty) || Number(u.water) || 0),
            sold: acc.sold + (Number(u.sold_qty) || 0),
            liberated: acc.liberated + (Number(u.liberated_qty) || 0),
          }
        }, { trad: 0, veg: 0, vegan: 0, st: 0, water: 0, sold: 0, liberated: 0 })

        const items = [
          { key: "traditional", label: "TRADICIONAL / CARNE", qty: totals.trad, color: "bg-slate-900" },
          { key: "vegetarian", label: "VEGETARIANA", qty: totals.veg, color: "bg-emerald-600" },
          { key: "vegana", label: "VEGANA", qty: totals.vegan, color: "bg-emerald-500" },
          { key: "sin_tacc", label: "SIN TACC", qty: totals.st, color: "bg-indigo-600" },
          { key: "water", label: "AGUA MINERAL", qty: totals.water, color: "bg-sky-500" },
        ]

        const uniqueCompanies = Array.from(new Set(headers.map((h: any) => h.company_name || h.company).filter(Boolean)))

        setConsolidado({
          total: totals.trad + totals.veg + totals.vegan + totals.st,
          sold: totals.sold,
          liberated: totals.liberated,
          items,
          specials: specialsMap,
          companies: uniqueCompanies,
          headerCount: headers.length
        })
      } catch (err) {
        console.error("Error consolidando producción:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchConsolidado()
  }, [selectedDate, eventos])

  if (initialLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
    </div>
  )

  const uniqueDates = Array.from(new Set(eventos.map(e => e.event_date))).sort()
  const totalProjectedPax = eventsForSelectedDate.reduce((acc, e) => acc + (e.total_projected_pax || e.pax_projected || 0), 0)

  const handlePrint = () => {
    if (!consolidado || !selectedDate) return
    const docFileTitle = `CONSOLIDADO-COCINA-${selectedDate}`
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>${docFileTitle}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; background: white; }
            .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
            .date-title { font-size: 42px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1; }
            .show-info { font-size: 16px; font-weight: 700; color: #64748b; margin-top: 10px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; border-top: 1px solid #eee; padding-top: 10px; }
            .stat-box { text-align: center; }
            .stat-label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
            .stat-value { font-size: 24px; font-weight: 900; }
            .items-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
            .item-card { border: 2px solid #0f172a; border-radius: 15px; padding: 15px; text-align: center; }
            .item-label { font-size: 14px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
            .item-qty { font-size: 56px; font-weight: 900; display: block; margin: 5px 0; line-height: 1; }
            .special-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 10px; margin-top: 10px; text-align: left; }
            .special-item { font-size: 12px; font-weight: 800; color: #92400e; margin-bottom: 2px; }
            .total-banner { grid-column: span 2; background: #0f172a; color: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
            .total-label { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #94a3b8; }
            .total-value { font-size: 56px; font-weight: 900; line-height: 1; }
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; font-style: italic; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <p style="margin:0; font-size:12px; font-weight:900; color:#6366f1; letter-spacing:0.2em; text-transform:uppercase;">Centro de Producción Consolidado</p>
            <h1 class="date-title">${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')}</h1>
            <div class="show-info">
              ${eventsForSelectedDate.map(e => e.show_name + ' @ ' + (e.venue_name || e.venue)).join(' + ')}
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <p class="stat-label">PAX Proyectados</p>
              <p class="stat-value">${totalProjectedPax}</p>
            </div>
            <div class="stat-box">
              <p class="stat-label">Unidades en Venta</p>
              <p class="stat-value">${consolidado.sold + consolidado.liberated}</p>
            </div>
          </div>

          <div class="items-grid">
            ${consolidado.items.map((item:any) => `
              <div class="item-card">
                <span class="item-label">${item.label}</span>
                <span class="item-qty">${item.qty}</span>
                ${(consolidado.specials?.[item.key] || []).length > 0 ? `
                  <div class="special-box">
                    ${consolidado.specials[item.key].map((s:any) => `<div class="special-item">▸ ${s.qty > 0 ? s.qty + 'x ' : ''}"${s.note}"</div>`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}

            <div class="total-banner">
              <div>
                <p class="total-label">Total Producción Comida</p>
                <p style="margin:0; font-size:12px; color:#6366f1; font-weight:bold;">Suma consolidada de todas las empresas</p>
              </div>
              <span class="total-value">${consolidado.total}</span>
            </div>
          </div>

          <div class="footer">
            Generado por Super Catering Manager — ${new Date().toLocaleString('es-AR')} — ${docFileTitle}.pdf
          </div>

          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
          <script>
            window.onload = function() {
              var element = document.body;
              var opt = {
                margin:       10,
                filename:     '${docFileTitle}.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };
              html2pdf().set(opt).from(element).save();
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-10">

      {/* CONTROL PANEL */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <ChefHat size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Centro de Producción</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Plan de Cocina Consolidado</h1>
            <p className="text-sm text-slate-400 mt-1">Agrupado por Evento — suma de TODAS las empresas</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <select
              className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold flex-1 md:w-96 outline-none focus:ring-2 focus:ring-indigo-50 transition"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}>
              <option value="">-- Seleccionar Día de Producción --</option>
              {uniqueDates.map(date => {
                const evs = eventos.filter(e => e.event_date === date)
                const showNames = evs.map(e => e.show_name).join(' + ')
                return (
                  <option key={date} value={date}>
                    {new Date(date + 'T12:00:00').toLocaleDateString('es-AR')} — {showNames}
                  </option>
                )
              })}
            </select>
            <button onClick={handlePrint}
              className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-slate-800 transition shadow-lg">
              <Printer size={24} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
      ) : consolidado ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Date Header */}
          <div className="text-center space-y-3 border-b-4 border-slate-900 pb-8">
            <h2 className="text-6xl md:text-8xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')}
            </h2>
            <div className="flex flex-col justify-center items-center gap-3 mt-6">
              {eventsForSelectedDate.map(e => (
                 <span key={e.id} className="flex items-center gap-2 text-xl font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">
                   <Calendar size={18} /> {e.show_name} <ChevronRight size={18} /> {e.venue_name || e.venues?.name || e.venue}
                 </span>
              ))}
            </div>

            {/* Companies */}
            {consolidado.companies?.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {consolidado.companies.map((c: string) => (
                  <span key={c} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold border border-indigo-200">
                    <Building2 size={12} /> {c}
                  </span>
                ))}
              </div>
            )}

            {/* PAX Summary */}
            <div className="flex justify-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-xs font-black text-slate-400 uppercase">PAX Proyectados (Total)</p>
                <p className="text-3xl font-black text-slate-800">{totalProjectedPax}</p>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-xs font-black text-slate-400 uppercase">Unidades Cargadas</p>
                <p className="text-3xl font-black text-indigo-600">{consolidado.sold + consolidado.liberated}</p>
              </div>
            </div>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {consolidado.items.map((item: any) => {
              const itemSpecials = consolidado.specials?.[item.key] || []
              return (
                <div key={item.label} className="bg-white border-2 border-slate-900 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-xl font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                  <span className={`text-9xl font-black tabular-nums tracking-tighter ${item.qty === 0 ? 'text-slate-200' : 'text-slate-900'}`}>
                    {item.qty}
                  </span>
                  {itemSpecials.length > 0 && (
                    <div className="mt-4 w-full border-t-2 border-dashed border-slate-100 pt-4 flex flex-col gap-2">
                      {itemSpecials.map((s: any, i: number) => (
                        <div key={i} className="flex justify-between items-center bg-amber-50 p-3 rounded-2xl border border-amber-200">
                          {s.qty > 0 && <span className="text-3xl font-black text-amber-600">{s.qty}</span>}
                          <span className={`${s.qty > 0 ? 'text-sm' : 'text-base'} font-black text-amber-900 uppercase italic`}>"{s.note}"</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Total */}
            <div className="md:col-span-2 bg-slate-900 text-white rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="p-6 bg-white/10 rounded-full">
                  <Calculator size={64} />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black uppercase tracking-widest text-slate-400">Total Producción Comida</h3>
                  <p className="text-sm font-bold text-indigo-400">Suma de Todas las Empresas del Evento</p>
                </div>
              </div>
              <span className="text-9xl font-black tracking-tighter">{consolidado.total}</span>
            </div>
          </div>

          <div className="text-center p-10 border-t-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest italic">
              Sistema Super Catering Manager — {new Date().toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-40 space-y-6 bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-200 print:hidden">
          <TableIcon className="mx-auto text-slate-200" size={100} />
          <div>
            <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Esperando Selección</h3>
            <p className="text-slate-400 font-medium">Elegí una fecha para generar la hoja de producción consolidada para todo ese día.</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .max-w-5xl { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
          nav, aside, header, .print\\:hidden { display: none !important; }
          .shadow-sm, .shadow-lg, .shadow-2xl { box-shadow: none !important; }
          .bg-slate-900 { background-color: black !important; -webkit-print-color-adjust: exact; }
          .rounded-\\[3rem\\] { border-radius: 0 !important; border: 4px solid black !important; }
        }
      `}</style>
    </div>
  )
}