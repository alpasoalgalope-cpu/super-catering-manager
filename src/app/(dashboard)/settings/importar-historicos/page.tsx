"use client"

import React, { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { 
  ArrowLeft, FileSpreadsheet, Loader2, CheckCircle2, 
  AlertCircle, AlertTriangle, UploadCloud, Calendar 
} from "lucide-react"
import { importHistoricalEventsAction } from "@/app/actions/importadorHistorico"

export default function ImportarHistoricosPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [defaultYear, setDefaultYear] = useState<number>(2026)
  const [rows, setRows] = useState<any[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [rangeOffset, setRangeOffset] = useState<number>(0)

  // Helper para verificar campos requeridos en el cliente
  const checkRowValidity = (row: any) => {
    const findValue = (r: any, keywords: string[]): any => {
      const keys = Object.keys(r)
      for (const kw of keywords) {
        const matchedKey = keys.find(k => k.toLowerCase().replace(/\s+/g, '').includes(kw.toLowerCase().replace(/\s+/g, '')))
        if (matchedKey !== undefined) {
          return r[matchedKey]
        }
      }
      return null
    }

    const fecha = findValue(row, ['fecha', 'fec'])
    const recital = findValue(row, ['recital', 'show', 'evento'])
    const venue = findValue(row, ['venue', 'lugar', 'predio'])
    const empresa = findValue(row, ['empresa', 'cliente'])
    const coordi = findValue(row, ['coordi', 'coordinador', 'coodi', 'coordinadores'])

    const missing = []
    if (!fecha) missing.push("Fecha")
    if (!recital) missing.push("Recital")
    if (!venue) missing.push("Venue")
    if (!empresa) missing.push("Empresa")

    return {
      isValid: missing.length === 0,
      missing,
      fecha,
      recital,
      venue,
      empresa,
      coordi
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0])
    }
  }

  const processFile = async (file: File) => {
    setLoading(true)
    setMessage(null)
    setRows([])
    setRangeOffset(0)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // Recalcular rango de celdas real
      const cells = Object.keys(worksheet).filter(k => k[0] !== '!')
      let maxRow = 1
      cells.forEach(cell => {
        const rowNum = parseInt(cell.replace(/[^0-9]/g, ''), 10)
        if (rowNum > maxRow) maxRow = rowNum
      })
      worksheet['!ref'] = `A1:AG${maxRow}` // Soporta hasta columna AG

      // Buscar cabecera dinámica
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      let currentOffset = 0
      for (let i = 0; i < Math.min(sheetRows.length, 15); i++) {
        const rowCells = sheetRows[i] || []
        const hasHeaderKeyword = rowCells.some(c => {
          const s = String(c).toLowerCase().trim()
          return s === 'fecha' || s === 'recital' || s === 'venue' || s === 'empresa' || s === 'fec'
        })
        if (hasHeaderKeyword) {
          currentOffset = i
          break
        }
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: currentOffset, raw: false })
      if (!jsonData || jsonData.length === 0) {
        throw new Error("El archivo está vacío o no se pudieron identificar las columnas requeridas (Fecha, Recital, Venue, Empresa).")
      }

      setRangeOffset(currentOffset)
      setRows(jsonData)
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al procesar el archivo Excel." })
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setImporting(true)
    setMessage(null)
    try {
      const validRows = rows.filter(r => checkRowValidity(r).isValid)
      if (validRows.length === 0) {
        throw new Error("No hay filas válidas para importar. Verifica que tengan cargados los campos Fecha, Recital, Venue y Empresa.")
      }

      const res = await importHistoricalEventsAction(rows, defaultYear)
      if (res.success) {
        setMessage({
          type: 'success',
          text: `¡Importación exitosa! Se cargaron ${res.importedCount} eventos correctamente.`
        })
        setRows([]) // Limpiar vista previa tras éxito
        router.refresh()
      } else {
        throw new Error(res.error || "Ocurrió un error desconocido durante la inserción.")
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setImporting(false)
    }
  }

  // Análisis rápido del lote
  const analyzedRows = rows.map(r => ({ row: r, ...checkRowValidity(r) }))
  const totalCount = rows.length
  const validCount = analyzedRows.filter(r => r.isValid).length
  const invalidCount = totalCount - validCount

  return (
    <div className="min-h-screen bg-slate-50/50 -m-8 p-8 space-y-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <Link href="/settings" className="inline-flex items-center gap-1 text-xs font-black uppercase text-indigo-600 tracking-widest hover:underline mb-2">
              <ArrowLeft size={12} /> Volver a Configuración
            </Link>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Importador de Eventos Históricos</h1>
            <p className="text-sm text-slate-500">Carga y registra en lote eventos previos desde un archivo Excel.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl w-full sm:w-auto">
            <Calendar className="text-slate-400" size={18} />
            <div>
              <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest">Año por Defecto</label>
              <input 
                type="number" 
                value={defaultYear} 
                onChange={(e) => setDefaultYear(parseInt(e.target.value, 10) || 2026)} 
                className="w-20 bg-transparent font-black text-slate-700 outline-none text-sm"
                min={2000}
                max={2100}
              />
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        {/* UPLOAD DRAG ZONE */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-4 group ${
            dragActive 
              ? 'border-indigo-500 bg-indigo-50/50' 
              : 'border-slate-300 hover:border-indigo-400 bg-white'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />

          {loading ? (
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="animate-spin text-indigo-500" size={48} />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analizando archivo Excel...</p>
            </div>
          ) : (
            <>
              <div className="p-6 bg-slate-50 rounded-full text-indigo-400 group-hover:text-indigo-600 transition-colors">
                <UploadCloud size={48} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Subir Excel de Históricos</h3>
                <p className="text-slate-400 text-sm font-semibold mt-2">Arrastra el archivo Excel (.xlsx) aquí o haz clic para seleccionarlo.</p>
                <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1">El sistema omitirá duplicados de Fecha + Recital + Lugar.</p>
              </div>
            </>
          )}
        </div>

        {/* LIVE PREVIEW AND SUBMIT */}
        {rows.length > 0 && (
          <div className="space-y-6">
            
            {/* Lote Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-100 border border-slate-200 p-6 rounded-[2rem]">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Filas Detectadas</span>
                <div className="text-3xl font-black text-slate-700 mt-1">{totalCount}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem]">
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Filas Válidas</span>
                <div className="text-3xl font-black text-emerald-700 mt-1">{validCount}</div>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem]">
                <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Filas con Errores</span>
                <div className="text-3xl font-black text-amber-700 mt-1">{invalidCount}</div>
              </div>
            </div>

            {/* PREVIEW TABLE CARD */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Vista Previa de Datos (Primeras 15 Filas)</h3>
                <button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg text-white ${
                    importing || validCount === 0
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {importing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Importando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirmar e Importar ({validCount} Eventos)
                    </>
                  )}
                </button>
              </div>

              {invalidCount > 0 && (
                <div className="p-5 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs space-y-3 shadow-sm">
                  <div className="flex items-start gap-2.5 font-bold text-sm text-rose-700">
                    <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
                    <span>Atención: Se detectaron {invalidCount} filas que no cumplen los requisitos mínimos y serán omitidas de la importación:</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                    {analyzedRows.map((ar, idx) => {
                      if (ar.isValid) return null
                      const excelRow = idx + rangeOffset + 2
                      const identifyText = [
                        ar.fecha ? `Fecha: ${ar.fecha}` : null,
                        ar.recital ? `Recital: ${ar.recital}` : null,
                        ar.empresa ? `Empresa: ${ar.empresa}` : null
                      ].filter(Boolean).join(" | ") || "Fila sin datos identificables"

                      return (
                        <div key={idx} className="bg-white border border-rose-100 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-xs">
                          <div>
                            <span className="inline-block px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold mr-2">
                              Fila {excelRow} (Excel)
                            </span>
                            <span className="text-slate-500 font-medium">{identifyText}</span>
                          </div>
                          <div className="text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100/50">
                            Falta: {ar.missing.join(", ")}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-rose-600/80 font-bold uppercase tracking-widest mt-1">
                    ⚠️ Asegúrate de rellenar estos campos obligatorios en el archivo original si deseas que sean importados.
                  </p>
                </div>
              )}


              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 font-black text-slate-500 uppercase tracking-wider">Estado de Fila</th>
                      <th className="p-3 font-black text-slate-500 uppercase tracking-wider">Fecha</th>
                      <th className="p-3 font-black text-slate-500 uppercase tracking-wider">Artista / Recital</th>
                      <th className="p-3 font-black text-slate-500 uppercase tracking-wider">Venue / Lugar</th>
                      <th className="p-3 font-black text-slate-500 uppercase tracking-wider">Empresa / Cliente</th>
                      <th className="p-3 font-black text-slate-500 uppercase tracking-wider">Coordinador(es)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzedRows.slice(0, 15).map((ar, idx) => {
                      const { isValid, missing, fecha, recital, venue, empresa, coordi } = ar
                      return (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3">
                            {isValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                <CheckCircle2 size={10} /> Listo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider" title={`Faltan: ${missing.join(', ')}`}>
                                <AlertCircle size={10} /> Inválido
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-slate-700">{fecha || "-"}</td>
                          <td className="p-3 font-bold text-slate-800">{recital || "-"}</td>
                          <td className="p-3 font-bold text-slate-700">{venue || "-"}</td>
                          <td className="p-3 font-bold text-slate-700">{empresa || "-"}</td>
                          <td className="p-3 text-slate-500">{coordi || "-"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalCount > 15 && (
                <p className="text-center text-slate-400 text-xs font-semibold">
                  ... y {totalCount - 15} filas más.
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
