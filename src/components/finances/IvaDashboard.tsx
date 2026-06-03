"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  UploadCloud, CheckCircle2, AlertCircle, Loader2, DollarSign, 
  RefreshCw, FileSpreadsheet, Lock, Unlock, Trash2, Search, 
  ArrowUpRight, ArrowDownLeft, Scale, Calendar, Check, X, Info,
  Package, ChevronRight, FileCheck, Layers
} from "lucide-react"
import * as XLSX from "xlsx"
import { 
  importAFIPComprobantes, 
  getIVABalance, 
  closeIVALiquidation, 
  reopenIVALiquidation, 
  updateIVAPayment, 
  clearComprobantesPeriodo, 
  getComprobantesPeriodo, 
  deleteComprobante,
  getRemitosPendientes,
  conciliarRemitosConFactura
} from "@/app/actions/iva"
import { useRouter } from "next/navigation"

interface IvaDashboardProps {
  initialPeriod: string
  initialBalance: any
  initialComprobantes: any[]
}

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
]

export default function IvaDashboard({ initialPeriod, initialBalance, initialComprobantes }: IvaDashboardProps) {
  const router = useRouter()
  const [period, setPeriod] = useState(initialPeriod)
  const [year, setYear] = useState(initialPeriod.split("-")[0])
  const [month, setMonth] = useState(initialPeriod.split("-")[1])
  
  // Data State
  const [balance, setBalance] = useState(initialBalance)
  const [comprobantes, setComprobantes] = useState(initialComprobantes)
  const [loadingData, setLoadingData] = useState(false)

  // Upload States
  const [loadingEmitidos, setLoadingEmitidos] = useState(false)
  const [loadingRecibidos, setLoadingRecibidos] = useState(false)
  const [isDragEmitidos, setIsDragEmitidos] = useState(false)
  const [isDragRecibidos, setIsDragRecibidos] = useState(false)
  
  // Dialogs & Messaging
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showConfirmReopen, setShowConfirmReopen] = useState(false)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [confirmingAction, setConfirmingAction] = useState(false)
  
  // Form overrides / inputs
  const [retenciones, setRetenciones] = useState(Number(initialBalance?.retenciones_percepciones_del_mes || 0))
  const [saldoTecnicoManual, setSaldoTecnicoManual] = useState(Number(initialBalance?.saldo_anterior_manual || 0))
  const [saldoLibreDispManual, setSaldoLibreDispManual] = useState(Number(initialBalance?.saldo_libre_disp_anterior_trasladado || 0))
  const [isSavingBorrador, setIsSavingBorrador] = useState(false)
  const [isClosingLiquid, setIsClosingLiquid] = useState(false)
  
  // Payment tracking
  const [isPagado, setIsPagado] = useState(!!initialBalance?.pagado)
  const [fechaPago, setFechaPago] = useState(initialBalance?.fecha_pago || "")

  // Grid filter & search
  const [search, setSearch] = useState("")
  const [tabFilter, setTabFilter] = useState<"todo" | "emitido" | "recibido">("todo")

  // Reconciliation tab states
  const [activeTab, setActiveTab] = useState<'comprobantes' | 'remitos'>('comprobantes')
  const [remitosPendientes, setRemitosPendientes] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [selectedRemitoIds, setSelectedRemitoIds] = useState<string[]>([])
  const [selectedAFIPComprobanteId, setSelectedAFIPComprobanteId] = useState<string>("")
  const [loadingRemitos, setLoadingRemitos] = useState(false)
  const [reconciling, setReconciling] = useState(false)

  const fileInputEmitidosRef = useRef<HTMLInputElement>(null)
  const fileInputRecibidosRef = useRef<HTMLInputElement>(null)

  // Sync year and month dropdown changes into main period state
  useEffect(() => {
    const newPeriod = `${year}-${month}`
    if (newPeriod !== period) {
      setPeriod(newPeriod)
      fetchDataForPeriod(newPeriod)
    }
  }, [year, month])

  // Fetch updated data from database when period changes
  const fetchDataForPeriod = async (targetPeriod: string) => {
    setLoadingData(true)
    setMessage(null)
    try {
      const balRes = await getIVABalance(targetPeriod)
      const compsRes = await getComprobantesPeriodo(targetPeriod, search, tabFilter)
      
      if (balRes.success) {
        setBalance(balRes.data)
        setRetenciones(Number(balRes.data?.retenciones_percepciones_del_mes || 0))
        setSaldoTecnicoManual(Number(balRes.data?.saldo_anterior_manual || 0))
        setSaldoLibreDispManual(Number(balRes.data?.saldo_libre_disp_anterior_trasladado || 0))
        setIsPagado(!!balRes.data?.pagado)
        setFechaPago(balRes.data?.fecha_pago || "")
      }
      if (compsRes.success) {
        setComprobantes(compsRes.data || [])
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: "Error al actualizar los datos del período." })
    } finally {
      setLoadingData(false)
    }
  }

  // Refetch list when search or tab filter changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchComprobantesOnly()
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [search, tabFilter])

  const fetchComprobantesOnly = async () => {
    const compsRes = await getComprobantesPeriodo(period, search, tabFilter)
    if (compsRes.success) {
      setComprobantes(compsRes.data || [])
    }
  }

  // Fetch pending remitos when activeTab is changed
  const fetchPendingRemitos = async () => {
    setLoadingRemitos(true)
    try {
      const res = await getRemitosPendientes()
      if (res.success) {
        setRemitosPendientes(res.data || [])
      }
    } catch (err) {
      console.error("Error fetching remitos:", err)
    } finally {
      setLoadingRemitos(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'remitos') {
      fetchPendingRemitos()
      setSelectedRemitoIds([])
      setSelectedAFIPComprobanteId("")
      setSelectedSupplierId("")
    }
  }, [activeTab])

  // Extract unique suppliers with pending remitos
  const suppliersWithRemitos = React.useMemo(() => {
    const map: any = {}
    remitosPendientes.forEach(r => {
      const prov = r.proveedores
      if (prov && !map[prov.id]) {
        map[prov.id] = { id: prov.id, nombre: prov.nombre, count: 0 }
      }
      if (prov) map[prov.id].count++
    })
    return Object.values(map) as any[]
  }, [remitosPendientes])

  // Filter remitos for the selected supplier
  const filteredRemitos = React.useMemo(() => {
    if (!selectedSupplierId) return []
    return remitosPendientes.filter(r => r.proveedores?.id === selectedSupplierId)
  }, [selectedSupplierId, remitosPendientes])

  // Find imported AFIP received invoices for the selected supplier name
  const matchedAfipComprobantes = React.useMemo(() => {
    if (!selectedSupplierId) return []
    const supplier = suppliersWithRemitos.find((s: any) => s.id === selectedSupplierId)
    if (!supplier) return []
    
    // Fuzzy search supplier name in AFIP imported invoices for received purchases
    return comprobantes.filter(c => 
      c.tipo_flujo === 'recibido' && 
      c.denominacion_contraparte.toLowerCase().includes(supplier.nombre.toLowerCase())
    )
  }, [selectedSupplierId, suppliersWithRemitos, comprobantes])

  // Calculate sum of selected remitos
  const sumRemitos = React.useMemo(() => {
    let sum = 0
    selectedRemitoIds.forEach(id => {
      const remito = remitosPendientes.find(r => r.id === id)
      if (remito) sum += Number(remito.costo_total) || 0
    })
    return sum
  }, [selectedRemitoIds, remitosPendientes])

  // Calculate selected AFIP Invoice price and deviation
  const selectedAfipInvoice = React.useMemo(() => {
    return comprobantes.find(c => c.id === selectedAFIPComprobanteId)
  }, [selectedAFIPComprobanteId, comprobantes])

  const afipTotal = selectedAfipInvoice ? Number(selectedAfipInvoice.imp_total) : 0
  const deviation = afipTotal > 0 ? afipTotal - sumRemitos : 0

  const handleReconcile = async () => {
    if (selectedRemitoIds.length === 0 || !selectedAFIPComprobanteId) {
      alert("Por favor, selecciona al menos un remito y una factura de AFIP.")
      return
    }

    setReconciling(true)
    setMessage(null)
    try {
      const res = await conciliarRemitosConFactura(selectedRemitoIds, selectedAFIPComprobanteId, deviation)
      if (res.success) {
        setMessage({ type: 'success', text: res.message || "Remitos conciliados con éxito." })
        setActiveTab('comprobantes')
        fetchDataForPeriod(period)
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al realizar la conciliación." })
    } finally {
      setReconciling(false)
    }
  }

  // Handle Excel parsing and upload
  const handleExcelUpload = async (file: File, tipo: 'emitido' | 'recibido') => {
    if (tipo === 'emitido') setLoadingEmitidos(true)
    else setLoadingRecibidos(true)
    
    setMessage(null)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // AFIP Excel spreadsheets typically contain a metadata/title row on line 1, before the actual headers.
      // We scan the first few rows to dynamically detect where the real header row (which has many columns) starts.
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      let rangeOffset = 0
      for (let i = 0; i < Math.min(sheetRows.length, 5); i++) {
        const rowCells = sheetRows[i] || []
        const filledCells = rowCells.filter(c => c !== undefined && c !== null && String(c).trim() !== "")
        // A typical AFIP table header row has at least 10+ columns. We look for a row with at least 5 filled cells.
        if (filledCells.length >= 5) {
          rangeOffset = i
          break
        }
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: rangeOffset, raw: true })

      if (!jsonData || jsonData.length === 0) {
        throw new Error("El archivo está vacío o no contiene el formato AFIP correcto.")
      }

      const res = await importAFIPComprobantes(jsonData, tipo)
      if (res.success) {
        setMessage({ type: 'success', text: res.message || "Importación completada." })
        fetchDataForPeriod(period)
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al procesar la planilla Excel." })
    } finally {
      if (tipo === 'emitido') {
        setLoadingEmitidos(false)
        if (fileInputEmitidosRef.current) fileInputEmitidosRef.current.value = ''
      } else {
        setLoadingRecibidos(false)
        if (fileInputRecibidosRef.current) fileInputRecibidosRef.current.value = ''
      }
    }
  }

  // Draft Save or Close Liquidación
  const handleSaveOrCloseLiquidation = async (cerrar: boolean) => {
    if (cerrar) setIsClosingLiquid(true)
    else setIsSavingBorrador(true)

    try {
      const res = await closeIVALiquidation(
        period, 
        retenciones, 
        saldoTecnicoManual, 
        saldoLibreDispManual,
        cerrar
      )

      if (res.success) {
        setMessage({ type: 'success', text: res.message || "Operación realizada con éxito." })
        fetchDataForPeriod(period)
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al guardar la liquidación." })
    } finally {
      setIsClosingLiquid(false)
      setIsSavingBorrador(false)
    }
  }

  // Reopen period
  const handleReopen = async () => {
    setConfirmingAction(true)
    try {
      const res = await reopenIVALiquidation(period)
      if (res.success) {
        setMessage({ type: 'success', text: res.message || "Operación realizada con éxito." })
        setShowConfirmReopen(false)
        fetchDataForPeriod(period)
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al reabrir la liquidación." })
    } finally {
      setConfirmingAction(false)
    }
  }

  // Clear all data for current month
  const handleClearPeriod = async () => {
    setConfirmingAction(true)
    try {
      const res = await clearComprobantesPeriodo(period)
      if (res.success) {
        setMessage({ type: 'success', text: res.message || "Operación realizada con éxito." })
        setShowConfirmClear(false)
        fetchDataForPeriod(period)
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || "Error al vaciar los datos." })
    } finally {
      setConfirmingAction(false)
    }
  }

  // Delete individual invoice
  const handleDeleteInvoice = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este comprobante?")) {
      try {
        const res = await deleteComprobante(id, period)
        if (res.success) {
          setMessage({ type: 'success', text: res.message || "Operación realizada con éxito." })
          fetchDataForPeriod(period)
        } else {
          throw new Error(res.error)
        }
      } catch (err: any) {
        console.error(err)
        setMessage({ type: 'error', text: err.message || "Error al borrar el comprobante." })
      }
    }
  }

  // Register payment update
  const handlePaymentToggle = async (checked: boolean) => {
    setIsPagado(checked)
    const todayStr = new Date().toISOString().split("T")[0]
    const pDate = checked ? todayStr : null
    setFechaPago(pDate || "")
    await updateIVAPayment(period, checked, pDate)
    fetchDataForPeriod(period)
  }

  const handlePaymentDateChange = async (dateStr: string) => {
    setFechaPago(dateStr)
    await updateIVAPayment(period, isPagado, dateStr || null)
  }

  const formattedPeriodLabel = () => {
    const selectedMonth = MONTHS.find(m => m.value === month)
    return `${selectedMonth?.label || ""} ${year}`
  }

  return (
    <div className="space-y-8 pb-20 relative">
      
      {/* 1. Header Bar */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Scale size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
              Conciliación y Liquidación de IVA
            </h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
              Descargas AFIP de Comprobantes Emitidos vs Recibidos
            </p>
          </div>
        </div>

        {/* Period Selector Controls */}
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center bg-slate-50 border border-slate-200/60 p-2 rounded-2xl">
            <Calendar size={16} className="text-slate-400 ml-2 mr-2" />
            <select 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent border-0 font-bold text-slate-700 text-sm focus:ring-0 cursor-pointer outline-none"
            >
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            
            <select 
              value={year} 
              onChange={(e) => setYear(e.target.value)}
              className="bg-transparent border-0 font-bold text-slate-700 text-sm focus:ring-0 cursor-pointer outline-none ml-2 border-l border-slate-200 pl-2"
            >
              {["2024", "2025", "2026", "2027"].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button 
            onClick={() => fetchDataForPeriod(period)}
            className="p-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-2xl transition-all"
            title="Refrescar datos"
            disabled={loadingData}
          >
            <RefreshCw size={16} className={loadingData ? "animate-spin" : ""} />
          </button>

          {balance?.cerrado ? (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 font-black text-[10px] uppercase tracking-wider shadow-sm">
              <Lock size={12} /> Liquidación Cerrada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border border-amber-100 rounded-full text-amber-700 font-black text-[10px] uppercase tracking-wider shadow-sm">
              <Unlock size={12} /> Período Abierto
            </span>
          )}
        </div>
      </div>

      {/* Message Notifications */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 font-bold text-sm animate-in fade-in duration-300 ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
            : 'bg-rose-50 text-rose-700 border border-rose-100'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Premium Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Débito Fiscal */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group hover:border-sky-200 transition-all">
          <div className="absolute top-4 right-6 p-2 bg-sky-50 text-sky-500 rounded-xl">
            <ArrowUpRight size={18} />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">IVA Débito Fiscal (Ventas)</span>
          <div className="text-3xl font-black text-slate-800 tracking-tighter mt-2">
            ${(balance?.debito_fiscal_puro || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl w-fit">
            <FileSpreadsheet size={12} className="text-sky-500" />
            {balance?.counts?.emitidos || 0} comprobantes emitidos
          </div>
        </div>

        {/* Card 2: Crédito Fiscal */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="absolute top-4 right-6 p-2 bg-emerald-50 text-emerald-500 rounded-xl">
            <ArrowDownLeft size={18} />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">IVA Crédito Fiscal (Compras)</span>
          <div className="text-3xl font-black text-slate-800 tracking-tighter mt-2">
            ${(balance?.credito_fiscal_puro || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl w-fit">
            <FileSpreadsheet size={12} className="text-emerald-500" />
            {balance?.counts?.recibidos || 0} comprobantes recibidos
          </div>
        </div>

        {/* Card 3: Saldos Anteriores */}
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
          <div className="absolute top-4 right-6 p-2 bg-indigo-50 text-indigo-500 rounded-xl">
            <Info size={16} />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Saldos Anteriores Arrastrados</span>
          <div className="text-sm font-bold text-slate-700 tracking-tight mt-3 space-y-1.5">
            <div className="flex justify-between border-b border-slate-50 pb-1">
              <span className="text-slate-400">Saldo Técnico:</span>
              <span className="font-black text-slate-800">${(balance?.saldo_tecnico_anterior_trasladado || 0).toLocaleString('es-AR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Libre Disp:</span>
              <span className="font-black text-indigo-600">${(balance?.saldo_libre_disp_anterior_trasladado || 0).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Posición Final */}
        {balance?.saldo_a_pagar > 0 ? (
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden">
            <div className="absolute top-4 right-6 p-2 bg-rose-500 text-white rounded-xl">
              <DollarSign size={18} />
            </div>
            <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">IVA a Pagar (Fisco)</span>
            <div className="text-3xl font-black text-rose-700 tracking-tighter mt-2">
              ${(balance?.saldo_a_pagar || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <span className="inline-block mt-4 text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-100/50 px-3 py-1 rounded-full">
              Requiere Transferencia VEP
            </span>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden">
            <div className="absolute top-4 right-6 p-2 bg-emerald-500 text-white rounded-xl">
              <Scale size={18} />
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Saldo Remanente a Favor</span>
            <div className="text-2xl font-black text-emerald-700 tracking-tighter mt-2">
              Téc: ${(balance?.saldo_tecnico_contribuyente_remanente || 0).toLocaleString('es-AR')}
            </div>
            <div className="text-[11px] font-bold text-indigo-700 mt-1">
              Libre Disp: ${(balance?.saldo_libre_disp_remanente || 0).toLocaleString('es-AR')}
            </div>
          </div>
        )}

      </div>

      {/* 3. Drag & Drop File Uploads */}
      {!balance?.cerrado && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Upload Emitidos (Ventas) */}
          <div 
            className={`border-2 border-dashed rounded-[2rem] p-8 text-center transition-all ${
              isDragEmitidos ? 'border-sky-500 bg-sky-50/50 shadow-md animate-pulse' : 'border-slate-200 bg-white hover:border-sky-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragEmitidos(true); }}
            onDragLeave={() => setIsDragEmitidos(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragEmitidos(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleExcelUpload(e.dataTransfer.files[0], 'emitido');
              }
            }}
          >
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              className="hidden" 
              ref={fileInputEmitidosRef}
              onChange={(e) => e.target.files && handleExcelUpload(e.target.files[0], 'emitido')}
            />
            
            {loadingEmitidos ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <Loader2 size={36} className="animate-spin text-sky-500" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Normalizando y mapeando facturas emitidas...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 cursor-pointer py-2" onClick={() => fileInputEmitidosRef.current?.click()}>
                <div className="p-4 bg-sky-50 rounded-full text-sky-500">
                  <UploadCloud size={32} />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Comprobantes Emitidos (Ventas)</h4>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Arrastra el Excel de AFIP o haz clic para subirlo.</p>
                  <p className="text-sky-500 font-black text-[9px] uppercase tracking-wider mt-2 bg-sky-50 px-2 py-0.5 rounded-full inline-block">
                    Upsert Inteligente sin Duplicación
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Recibidos (Compras) */}
          <div 
            className={`border-2 border-dashed rounded-[2rem] p-8 text-center transition-all ${
              isDragRecibidos ? 'border-emerald-500 bg-emerald-50/50 shadow-md animate-pulse' : 'border-slate-200 bg-white hover:border-emerald-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragRecibidos(true); }}
            onDragLeave={() => setIsDragRecibidos(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragRecibidos(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleExcelUpload(e.dataTransfer.files[0], 'recibido');
              }
            }}
          >
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              className="hidden" 
              ref={fileInputRecibidosRef}
              onChange={(e) => e.target.files && handleExcelUpload(e.target.files[0], 'recibido')}
            />
            
            {loadingRecibidos ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <Loader2 size={36} className="animate-spin text-emerald-500" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Normalizando y aplicando signo a notas de crédito...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 cursor-pointer py-2" onClick={() => fileInputRecibidosRef.current?.click()}>
                <div className="p-4 bg-emerald-50 rounded-full text-emerald-500">
                  <UploadCloud size={32} />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Comprobantes Recibidos (Compras)</h4>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Arrastra el Excel de AFIP o haz clic para subirlo.</p>
                  <p className="text-emerald-500 font-black text-[9px] uppercase tracking-wider mt-2 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                    Mapeo Automático de Proveedores y Signo
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Liquidation Form & Closing Controls Panel */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2">
          {balance?.cerrado ? <Lock size={16} className="text-indigo-600" /> : <Unlock size={16} className="text-amber-500" />}
          Panel de Cierre y Liquidación — {formattedPeriodLabel()}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column A: User variables inputs (retenciones, manual initial balances) */}
          <div className="space-y-5 lg:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-8">
            <div className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
              Ingreso de Parámetros Impositivos
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Retenciones/Percepciones del mes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Retenciones y Percepciones del Mes ($)
                </label>
                <input 
                  type="number"
                  disabled={balance?.cerrado}
                  value={retenciones}
                  onChange={(e) => setRetenciones(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-50/50 border border-slate-200/60 rounded-xl px-4 py-2.5 font-bold text-slate-700 text-sm focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Saldo Técnico manual override */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Saldo Técnico Anterior Inicial ($) <span className="text-[9px] text-amber-500 font-bold lowercase tracking-normal">(sobreescribe traslado)</span>
                </label>
                <input 
                  type="number"
                  disabled={balance?.cerrado}
                  value={saldoTecnicoManual}
                  onChange={(e) => setSaldoTecnicoManual(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-50/50 border border-slate-200/60 rounded-xl px-4 py-2.5 font-bold text-slate-700 text-sm focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Saldo Libre Disp manual override */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Saldo Libre Disponibilidad Anterior Inicial ($)
                </label>
                <input 
                  type="number"
                  disabled={balance?.cerrado}
                  value={saldoLibreDispManual}
                  onChange={(e) => setSaldoLibreDispManual(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-50/50 border border-slate-200/60 rounded-xl px-4 py-2.5 font-bold text-slate-700 text-sm focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Calculations preview of algorithm */}
            {!balance?.cerrado && (
              <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-4 mt-6 text-xs space-y-2">
                <p className="font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={14} /> Simulación Doble Párrafo (Borrador)
                </p>
                <div className="grid grid-cols-2 gap-y-1.5 font-semibold text-slate-600 pt-1">
                  <span>Capa 1: Débito ($ {balance?.debito_fiscal_puro}) - Crédito ($ {balance?.credito_fiscal_puro}) - Arrastre Téc. ($ {saldoTecnicoManual || balance?.saldo_tecnico_anterior_trasladado})</span>
                  <span className="text-right font-bold text-slate-700">
                    Posición Técnico: ${((balance?.debito_fiscal_puro || 0) - (balance?.credito_fiscal_puro || 0) - (saldoTecnicoManual || balance?.saldo_tecnico_anterior_trasladado || 0)).toLocaleString('es-AR')}
                  </span>
                  <span>Capa 2: Fisco Técnico ($ {balance?.saldo_tecnico_fisco}) - Libre Disp. ($ {saldoLibreDispManual || balance?.saldo_libre_disp_anterior_trasladado}) - Retenciones ($ {retenciones})</span>
                  <span className="text-right font-bold text-indigo-700">
                    A Pagar Previsto: ${(balance?.saldo_a_pagar || 0).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Column B: Period locking and payment logging triggers */}
          <div className="flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Acciones de Estado
              </div>

              {!balance?.cerrado ? (
                // Open period controls
                <div className="space-y-3">
                  <button 
                    onClick={() => handleSaveOrCloseLiquidation(false)}
                    disabled={isSavingBorrador || isClosingLiquid}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    {isSavingBorrador ? <Loader2 size={14} className="animate-spin" /> : null}
                    Guardar Borrador
                  </button>
                  <button 
                    onClick={() => handleSaveOrCloseLiquidation(true)}
                    disabled={isSavingBorrador || isClosingLiquid}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/10 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isClosingLiquid ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    Cerrar Liquidación
                  </button>
                  <button 
                    onClick={() => setShowConfirmClear(true)}
                    className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    Limpiar Comprobantes
                  </button>
                </div>
              ) : (
                // Closed period controls
                <div className="space-y-5">
                  
                  {/* Payment tracking sub-panel */}
                  {balance?.saldo_a_pagar > 0 ? (
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">¿Impuesto Pagado?</span>
                        <input 
                          type="checkbox"
                          checked={isPagado}
                          onChange={(e) => handlePaymentToggle(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      
                      {isPagado && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha de Pago</label>
                          <input 
                            type="date"
                            value={fechaPago}
                            onChange={(e) => handlePaymentDateChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-[11px] font-bold text-emerald-700">
                      Este período dio saldo a favor del contribuyente, no hay impuesto a pagar en VEP.
                    </div>
                  )}

                  <button 
                    onClick={() => setShowConfirmReopen(true)}
                    className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-2xl text-xs uppercase tracking-wider border border-amber-200/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Unlock size={14} />
                    Reabrir Período
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* TABS SELECTOR: Comprobantes vs Conciliación de Remitos */}
      <div className="flex bg-slate-100/80 border border-slate-200/40 p-1.5 rounded-2xl w-full sm:w-fit shadow-inner">
        <button
          onClick={() => setActiveTab('comprobantes')}
          className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTab === 'comprobantes'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/40'
          }`}
        >
          <FileSpreadsheet size={16} /> Comprobantes AFIP
        </button>
        <button
          onClick={() => setActiveTab('remitos')}
          className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTab === 'remitos'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/40'
          }`}
        >
          <Layers size={16} /> Conciliar Remitos Diferidos
          {remitosPendientes.length > 0 && (
            <span className="bg-amber-500 text-white rounded-full text-[9px] w-5 h-5 flex items-center justify-center font-black animate-pulse">
              {remitosPendientes.length}
            </span>
          )}
        </button>
      </div>

      {/* 5. DYNAMIC TAB RENDER */}
      {activeTab === 'comprobantes' ? (
        /* TAB 1: AFIP INVOICES LEDGER */
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-300">
          
          {/* Table Filter Tabs and search */}
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                 Listado de Comprobantes
               </h3>
               <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full">
                 {comprobantes.length} registros
               </span>
            </div>

            <div className="flex items-center flex-wrap md:flex-nowrap gap-3">
              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar por CUIT o Razón Social..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-600 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Tab Filters */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setTabFilter("todo")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                    tabFilter === 'todo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setTabFilter("emitido")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                    tabFilter === 'emitido' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Emitidos
                </button>
                <button 
                  onClick={() => setTabFilter("recibido")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                    tabFilter === 'recibido' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Recibidos
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Grid Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Flujo</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Comprobante</th>
                  <th className="px-6 py-4">Contraparte</th>
                  <th className="px-6 py-4 text-right">Neto Gravado</th>
                  <th className="px-6 py-4 text-right">Importe IVA</th>
                  <th className="px-6 py-4 text-right">Imp. Total</th>
                  {!balance?.cerrado && <th className="px-6 py-4 text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {comprobantes.map((comp: any) => {
                  const isEmit = comp.tipo_flujo === 'emitido'
                  const isNeg = Number(comp.imp_total) < 0
                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        {isEmit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-100 rounded-full font-black text-[9px] uppercase tracking-widest">
                            <ArrowUpRight size={10} /> Ventas (Débito)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-black text-[9px] uppercase tracking-widest">
                            <ArrowDownLeft size={10} /> Compras (Crédito)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-800">
                        {new Date(comp.fecha + 'T12:00:00').toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-slate-800 uppercase tracking-tight">{comp.tipo_comprobante}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                          {String(comp.punto_venta).padStart(4, '0')}-{String(comp.numero_desde).padStart(8, '0')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={comp.denominacion_contraparte}>
                          {comp.denominacion_contraparte || 'Desconocido'}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                          CUIT: {comp.cuit_contraparte}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">
                        ${Number(comp.neto_gravado_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-slate-700">
                        ${Number(comp.total_iva).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-black tracking-tighter ${
                          isNeg ? 'text-rose-600' : isEmit ? 'text-sky-700' : 'text-slate-800'
                        }`}>
                          ${Number(comp.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      {!balance?.cerrado && (
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleDeleteInvoice(comp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Eliminar comprobante"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                
                {comprobantes.length === 0 && (
                  <tr>
                    <td colSpan={balance?.cerrado ? 7 : 8} className="py-20 text-center">
                      <FileSpreadsheet size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay comprobantes para mostrar</p>
                      <p className="text-slate-300 font-medium text-[10px] uppercase mt-1">Sube planillas de AFIP para ver el desglose impositivo</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      ) : (
        /* TAB 2: REMITO TO INVOICE CONCILIATION PANEL (N-a-1 & inflation deviation) */
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 space-y-8 animate-in fade-in duration-300">
          
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Conciliación Masiva de Remitos a Facturas</h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">
              Asociá múltiples ingresos de stock pendientes a una única factura importada de ARCA.
            </p>
          </div>

          {loadingRemitos ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
          ) : remitosPendientes.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[2rem]">
              <Package size={48} className="mx-auto text-emerald-400 mb-4 animate-bounce" />
              <h4 className="text-base font-black text-slate-800 uppercase">¡Sin Remitos Pendientes!</h4>
              <p className="text-slate-400 text-xs font-semibold mt-1">
                Todas las compras recibidas vía remito tienen su factura correspondiente vinculada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Supplier and Checklist of Remitos (Lg: col-span-7) */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    1. Seleccioná el Proveedor a Conciliar
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value)
                      setSelectedRemitoIds([])
                      setSelectedAFIPComprobanteId("")
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona un proveedor con remitos pendientes...</option>
                    {suppliersWithRemitos.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.count} remito{s.count > 1 ? 's' : ''} pendiente{s.count > 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSupplierId && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      2. Seleccioná los Remitos diferidos a Incluir en la Factura
                    </label>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredRemitos.map((r: any) => {
                        const isChecked = selectedRemitoIds.includes(r.id)
                        return (
                          <div 
                            key={r.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedRemitoIds(selectedRemitoIds.filter(id => id !== r.id))
                              } else {
                                setSelectedRemitoIds([...selectedRemitoIds, r.id])
                              }
                            }}
                            className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                              isChecked 
                                ? 'bg-indigo-50/50 border-indigo-300 shadow-sm' 
                                : 'bg-white border-slate-200 hover:border-indigo-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div>
                                <h5 className="text-xs font-black text-slate-900 uppercase">Remito: {r.nro_comprobante || 'S/N'}</h5>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                  Ingreso: {new Date(r.fecha_esperada + 'T12:00:00').toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-slate-800">
                                $ {Number(r.costo_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: AFIP Invoices (Lg: col-span-5) */}
              <div className="lg:col-span-5 space-y-6">
                {selectedSupplierId ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        3. Seleccioná la Factura de AFIP (ARCA) de Compra
                      </label>
                      <p className="text-[9px] text-slate-400 font-medium leading-normal mb-3">
                        Se muestran los comprobantes recibidos del mes que contienen el nombre del proveedor.
                      </p>
                    </div>

                    {matchedAfipComprobantes.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-2xl">
                        <AlertCircle className="text-amber-500 mx-auto mb-2" size={24} />
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Sin Facturas Disponibles</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                          Asegurate de haber importado el Excel de Recibidos (AFIP) de este mes que contenga la boleta oficial.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {matchedAfipComprobantes.map((c: any) => {
                          const isChecked = selectedAFIPComprobanteId === c.id
                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedAFIPComprobanteId(c.id)}
                              className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                                isChecked
                                  ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-emerald-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  checked={isChecked}
                                  readOnly
                                  className="h-4.5 w-4.5 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div>
                                  <h5 className="text-xs font-black text-slate-900 uppercase">{c.tipo_comprobante}</h5>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                    Nro: {String(c.punto_venta).padStart(4, '0')}-{String(c.numero_desde).padStart(8, '0')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black text-emerald-800">
                                  $ {Number(c.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-8 bg-slate-50 border border-slate-100 rounded-3xl text-center text-slate-400 text-xs font-semibold uppercase">
                    Selecciona un proveedor a la izquierda para ver facturas de AFIP.
                  </div>
                )}
              </div>

              {/* Consolidated Reconciliation Action Panel */}
              {selectedSupplierId && selectedRemitoIds.length > 0 && selectedAFIPComprobanteId && (
                <div className="lg:col-span-12 bg-slate-50 border border-slate-200/80 rounded-[2rem] p-6 space-y-6 shadow-sm animate-in slide-in-from-bottom-4 duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <FileCheck size={18} className="text-emerald-600" /> Resumen de Conciliación
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1.5 text-xs font-semibold text-slate-600">
                      <div>
                        <span className="text-slate-400">Remitos Seleccionados:</span> <span className="font-black text-slate-800">{selectedRemitoIds.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Suma de Remitos:</span> <span className="font-black text-slate-800">$ {sumRemitos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Total Factura AFIP:</span> <span className="font-black text-emerald-800">$ {afipTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="col-span-2 md:col-span-3 border-t border-slate-200 my-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Diferencia / Variación:</span> 
                          <span className={`font-black text-sm ${deviation > 0 ? 'text-rose-600' : deviation === 0 ? 'text-emerald-700' : 'text-indigo-700'}`}>
                            $ {deviation.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                          {deviation !== 0 && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-black uppercase">
                              Se absorberá como Desvío Inflacionario
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-auto self-end md:self-center">
                    <button
                      onClick={handleReconcile}
                      disabled={reconciling}
                      className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:shadow-xl transition-all active:scale-95"
                    >
                      {reconciling ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Confirmar Conciliación
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* CONFIRM REOPEN PERIOD DIALOG */}
      {showConfirmReopen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-5">
              <Unlock size={24} />
            </div>
            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Reabrir Liquidación</h4>
            <p className="text-slate-500 text-sm font-semibold mt-2.5 leading-relaxed">
              ¿Estás seguro de que deseas reabrir el período de <span className="font-bold text-slate-700">{formattedPeriodLabel()}</span>?
              Cualquier cambio posterior en los comprobantes modificará los saldos arrastrados a los meses siguientes.
            </p>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowConfirmReopen(false)}
                disabled={confirmingAction}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleReopen}
                disabled={confirmingAction}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-2xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                {confirmingAction ? <Loader2 size={12} className="animate-spin" /> : null}
                Confirmar Reapertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM WIPE OUT PERIOD DATA DIALOG */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-5">
              <Trash2 size={24} />
            </div>
            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Limpiar Comprobantes del Período</h4>
            <p className="text-slate-500 text-sm font-semibold mt-2.5 leading-relaxed">
              ¿Estás seguro de que deseas borrar <span className="font-bold text-rose-600">todos</span> los comprobantes del período <span className="font-bold text-slate-700">{formattedPeriodLabel()}</span>?
              Esta acción no se puede deshacer y te permitirá reimportar los archivos desde cero.
            </p>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowConfirmClear(false)}
                disabled={confirmingAction}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleClearPeriod}
                disabled={confirmingAction}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-2xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2 animate-pulse"
              >
                {confirmingAction ? <Loader2 size={12} className="animate-spin" /> : null}
                Confirmar Borrado
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
