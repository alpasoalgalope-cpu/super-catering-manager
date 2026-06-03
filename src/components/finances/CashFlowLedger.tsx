"use client"

import React, { useState, useRef, useEffect } from "react"
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, DollarSign, RefreshCw, FileSpreadsheet, Plus, X, Trash2 } from "lucide-react"
import * as XLSX from "xlsx"
import { importCashMovements, createCashMovement, createBulkCashMovements } from "@/app/actions/finances"
import { useRouter } from "next/navigation"

export default function CashFlowLedger({ 
  movements,
  concepts = [],
  subconcepts = []
}: { 
  movements: any[];
  concepts?: any[];
  subconcepts?: any[];
}) {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  interface DraftRow {
    key: string;
    fecha: string;
    tipo: string;
    concept_id: string;
    subconcept_id: string;
    detalle: string;
    importe: string;
    turno: string;
  }

  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [isSavingManual, setIsSavingManual] = useState(false)
  
  const [draftRows, setDraftRows] = useState<DraftRow[]>([
    {
      key: Math.random().toString(),
      fecha: new Date().toISOString().split('T')[0],
      tipo: "Egreso",
      concept_id: "",
      subconcept_id: "",
      detalle: "",
      importe: "",
      turno: "Completo"
    }
  ])

  // Auto-open modal if manual=true URL parameter is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('manual') === 'true') {
        setIsManualModalOpen(true)
        // Clean URL parameter without reloading page
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [])

  const addDraftRow = () => {
    setDraftRows(prev => [
      ...prev,
      {
        key: Math.random().toString(),
        fecha: new Date().toISOString().split('T')[0],
        tipo: "Egreso",
        concept_id: "",
        subconcept_id: "",
        detalle: "",
        importe: "",
        turno: "Completo"
      }
    ])
  }

  const removeDraftRow = (key: string) => {
    if (draftRows.length === 1) {
      setDraftRows([
        {
          key: Math.random().toString(),
          fecha: new Date().toISOString().split('T')[0],
          tipo: "Egreso",
          concept_id: "",
          subconcept_id: "",
          detalle: "",
          importe: "",
          turno: "Completo"
        }
      ])
    } else {
      setDraftRows(prev => prev.filter(r => r.key !== key))
    }
  }

  const updateDraftCell = (key: string, field: keyof DraftRow, value: string) => {
    setDraftRows(prev => prev.map(row => {
      if (row.key !== key) return row;
      
      const updated = { ...row, [field]: value };
      
      if (field === 'concept_id') {
        updated.subconcept_id = "";
        const selectedConcept = concepts.find(c => c.id === value);
        if (selectedConcept) {
          updated.tipo = selectedConcept.tipo;
        }
      }
      
      return updated;
    }))
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate rows
    const invalidRow = draftRows.find(r => !r.fecha || !r.concept_id || !r.subconcept_id || !r.importe || Number(r.importe) <= 0)
    if (invalidRow) {
      alert("Por favor, completá todos los campos obligatorios (*) con valores válidos (importe mayor a 0) en todas las filas.")
      return
    }

    setIsSavingManual(true)
    try {
      const payloads = draftRows.map(row => {
        const selectedConcept = concepts.find(c => c.id === row.concept_id)
        const selectedSubconcept = subconcepts.find(s => s.id === row.subconcept_id)
        return {
          fecha: row.fecha,
          tipo: row.tipo,
          concept_id: row.concept_id,
          concepto: selectedConcept?.name || "",
          subconcept_id: row.subconcept_id,
          conc_caja: selectedSubconcept?.name || "",
          detalle: row.detalle,
          importe: Number(row.importe),
          turno: row.turno
        }
      })

      const res = await createBulkCashMovements(payloads)

      if (res.success) {
        setIsManualModalOpen(false)
        // Reset to initial single row
        setDraftRows([
          {
            key: Math.random().toString(),
            fecha: new Date().toISOString().split('T')[0],
            tipo: "Egreso",
            concept_id: "",
            subconcept_id: "",
            detalle: "",
            importe: "",
            turno: "Completo"
          }
        ])
        router.refresh()
      } else {
        alert(res.error || "Error al registrar los movimientos")
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Error inesperado")
    } finally {
      setIsSavingManual(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // 1. Recalcular el rango de celdas real (!ref) para evitar truncamientos por metadatos corruptos de Maxirest
      const cells = Object.keys(worksheet).filter(k => k[0] !== '!');
      let maxRow = 1;
      cells.forEach(cell => {
        const rowNum = parseInt(cell.replace(/[^0-9]/g, ''), 10);
        if (rowNum > maxRow) maxRow = rowNum;
      });
      worksheet['!ref'] = `A1:N${maxRow}`;

      // 2. Escanear dinámicamente las primeras 15 filas buscando la cabecera real por palabras clave
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      let rangeOffset = 0
      for (let i = 0; i < Math.min(sheetRows.length, 15); i++) {
        const rowCells = sheetRows[i] || []
        const hasHeaderKeyword = rowCells.some(c => {
          const s = String(c).toLowerCase().trim();
          return s === 'fecha' || s === 'sucursal' || s === 'mes' || s === 'importe' || s === 'fec';
        });
        if (hasHeaderKeyword) {
          rangeOffset = i
          break
        }
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: rangeOffset, raw: false })

      if (!jsonData || jsonData.length === 0) {
        throw new Error("El archivo parece estar vacío o no tiene el formato correcto.")
      }

      // Enviar al backend
      const res = await importCashMovements(jsonData)
      
      if (res.success) {
        setMessage({ type: 'success', text: res.message || "Importación exitosa." })
        router.refresh() // Recargar datos
      } else {
        throw new Error(res.error)
      }
      
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al procesar el archivo." })
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const [selectedMonth, setSelectedMonth] = useState("TODOS")

  // Obtener meses únicos presentes en los movimientos
  const uniqueMonths = Array.from(new Set(movements.map(m => m.mes).filter(Boolean))).sort()

  const filteredMovements = movements.filter(m => {
    if (selectedMonth === "TODOS") return true
    return m.mes === selectedMonth
  })

  // Calculate totals based on filtered movements
  const totalIngresos = filteredMovements.filter(m => m.importe > 0).reduce((acc, m) => acc + Number(m.importe), 0)
  const totalEgresos = filteredMovements.filter(m => m.importe < 0).reduce((acc, m) => acc + Math.abs(Number(m.importe)), 0)
  const saldo = totalIngresos - totalEgresos

  // Encontrar el lote de importación más reciente y la fecha de datos más reciente
  const maxCreatedAt = movements.length > 0 
    ? Math.max(...movements.map(m => new Date(m.created_at).getTime()))
    : 0

  const maxFechaStr = movements.length > 0
    ? movements.map(m => m.fecha).sort().pop()
    : null

  const maxFechaFormatted = maxFechaStr
    ? new Date(maxFechaStr + 'T12:00:00').toLocaleDateString('es-AR')
    : null

  return (
    <div className="space-y-8">
      {/* Import Zone */}
      <div 
        className={`border-2 border-dashed rounded-[2.5rem] p-10 text-center transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50 shadow-lg' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input 
          type="file" 
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
        />
        
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Procesando y Sincronizando Libro Diario...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="p-6 bg-slate-50 rounded-full text-indigo-400 group-hover:text-indigo-600 transition-colors">
               <FileSpreadsheet size={48} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Importar Movimientos de Maxirest</h3>
              <p className="text-slate-400 text-sm font-semibold mt-2">Arrastra el archivo Excel (.xlsx) o haz clic para subirlo.</p>
              <p className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mt-1">Soporta Cargas Repetidas sin duplicar datos</p>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Month Filter Toolbar */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Filtrar por Período</h4>
          <p className="text-sm font-black text-slate-700 mt-1 uppercase">Visualizando: {selectedMonth === 'TODOS' ? 'Todos los Meses' : selectedMonth}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full sm:w-64 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="TODOS">📅 TODOS LOS MESES</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>📅 {String(m).toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem]">
            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Total Ingresos</span>
            <div className="text-3xl font-black text-emerald-700 tracking-tighter mt-1">${totalIngresos.toLocaleString('es-AR')}</div>
         </div>
         <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem]">
            <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest">Total Egresos</span>
            <div className="text-3xl font-black text-rose-700 tracking-tighter mt-1">${totalEgresos.toLocaleString('es-AR')}</div>
         </div>
         <div className="bg-indigo-900 border border-indigo-800 p-6 rounded-[2rem] text-white">
            <span className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">Saldo de Caja Importado</span>
            <div className="text-3xl font-black text-white tracking-tighter mt-1">${saldo.toLocaleString('es-AR')}</div>
         </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
             <RefreshCw size={16} className="text-indigo-500" /> Historial de Movimientos
           </h3>
           <div className="flex flex-wrap items-center gap-3">
             {maxFechaFormatted && (
               <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                 Último Dato: {maxFechaFormatted}
               </span>
             )}
             <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1.5 rounded-full">{filteredMovements.length} Registros</span>
             
             <button
               onClick={() => setIsManualModalOpen(true)}
               className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
             >
               <Plus size={12} /> Registrar Movimiento
             </button>
           </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Semana</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Concepto</th>
                <th className="px-3 py-3">Conc. Caja</th>
                <th className="px-3 py-3">Detalle</th>
                <th className="px-3 py-3 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMovements.map((mov: any) => {
                const isPos = Number(mov.importe) > 0
                const isLatestBatch = maxCreatedAt > 0 && (maxCreatedAt - new Date(mov.created_at).getTime() < 5000)
                
                return (
                  <tr 
                    key={mov.id} 
                    className={`transition-colors group ${
                      isLatestBatch 
                        ? 'bg-indigo-50/20 hover:bg-indigo-50/40 border-l-4 border-l-indigo-500' 
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="text-[11px] font-black text-slate-800">
                          {new Date(mov.fecha + 'T12:00:00').toLocaleDateString()}
                        </div>
                        {isLatestBatch && (
                          <span className="text-[7px] font-black px-1 py-0.5 bg-indigo-600 text-white rounded uppercase tracking-wider animate-pulse shrink-0">
                            NUEVO
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">{mov.mes}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[11px] font-bold text-slate-600">Sem. {mov.semana || '-'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        String(mov.tipo).toLowerCase().includes('ing') || Number(mov.importe) > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {mov.tipo || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-[11px] font-black uppercase text-slate-800 truncate max-w-[120px]" title={mov.concepto}>{mov.concepto || '-'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[100px] block" title={mov.conc_caja}>{mov.conc_caja || '-'}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[130px] truncate" title={mov.detalle}>
                      <span className="text-[11px] font-medium text-slate-500">{mov.detalle || '-'}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className={`text-xs font-black tracking-tighter ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPos ? '+' : ''}${Number(mov.importe).toLocaleString('es-AR')}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <DollarSign size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay movimientos importados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Movement Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                  <DollarSign size={22} className="text-indigo-500" /> Planilla de Carga Rápida (Estilo Excel)
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Cargá múltiples movimientos de forma horizontal fila por fila</p>
              </div>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="p-2.5 bg-white border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition shadow-xs"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleManualSubmit} className="p-8 space-y-6">
              <div className="overflow-x-auto max-h-[350px] custom-scrollbar border border-slate-100 rounded-2xl">
                <table className="w-full text-left min-w-[900px] border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-3 py-3 w-[15%]">Fecha *</th>
                      <th className="px-3 py-3 w-[10%]">Turno</th>
                      <th className="px-3 py-3 w-[12%]">Tipo</th>
                      <th className="px-3 py-3 w-[18%]">Concepto *</th>
                      <th className="px-3 py-3 w-[18%]">Conc. Caja *</th>
                      <th className="px-3 py-3 w-[17%]">Detalle</th>
                      <th className="px-3 py-3 w-[10%] text-right">Importe ($) *</th>
                      <th className="px-3 py-3 w-[5%] text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {draftRows.map((row) => {
                      const rowSubconcepts = subconcepts.filter(s => s.concept_id === row.concept_id);
                      
                      return (
                        <tr key={row.key} className="hover:bg-slate-50/30 transition-colors">
                          {/* Fecha */}
                          <td className="px-2 py-2">
                            <input 
                              type="date"
                              required
                              value={row.fecha}
                              onChange={(e) => updateDraftCell(row.key, 'fecha', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          
                          {/* Turno */}
                          <td className="px-2 py-2">
                            <select
                              value={row.turno}
                              onChange={(e) => updateDraftCell(row.key, 'turno', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="Sin Turno">Sin Turno</option>
                              <option value="Mañana">Mañana</option>
                              <option value="Tarde">Tarde</option>
                              <option value="Noche">Noche</option>
                              <option value="Completo">Completo</option>
                            </select>
                          </td>
                          
                          {/* Tipo */}
                          <td className="px-2 py-2">
                            <span className={`inline-block text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                              row.tipo === 'Ingreso' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {row.tipo}
                            </span>
                          </td>
                          
                          {/* Concepto */}
                          <td className="px-2 py-2">
                            <select
                              required
                              value={row.concept_id}
                              onChange={(e) => updateDraftCell(row.key, 'concept_id', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="">-- Rubro --</option>
                              {concepts.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* Conc Caja / Subconcepto */}
                          <td className="px-2 py-2">
                            <select
                              required
                              disabled={!row.concept_id}
                              value={row.subconcept_id}
                              onChange={(e) => updateDraftCell(row.key, 'subconcept_id', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">-- Caja --</option>
                              {rowSubconcepts.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* Detalle */}
                          <td className="px-2 py-2">
                            <input 
                              type="text"
                              placeholder="Ej: Pago prov. carnes"
                              value={row.detalle}
                              onChange={(e) => updateDraftCell(row.key, 'detalle', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          
                          {/* Importe */}
                          <td className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-2 text-[10px] font-black text-slate-400">$</span>
                              <input 
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                placeholder="0"
                                value={row.importe}
                                onChange={(e) => updateDraftCell(row.key, 'importe', e.target.value)}
                                className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 text-right outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </td>
                          
                          {/* Accion (Delete) */}
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeDraftRow(row.key)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Eliminar Fila"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Boton Agregar Fila */}
              <div className="flex justify-between items-center bg-slate-50/50 p-4 border border-dashed border-slate-200 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Borrador actual: {draftRows.length} movimientos
                </span>
                <button
                  type="button"
                  onClick={addDraftRow}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm"
                >
                  <Plus size={14} /> Agregar Fila
                </button>
              </div>

              {/* Botones Enviar */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingManual}
                  className="flex-1 px-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingManual ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    `Guardar ${draftRows.length} Movimientos`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
