"use client"

import React, { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { X, Loader2, CheckCircle2, FileText, Landmark, Percent, AlertCircle } from "lucide-react"

interface ReceivePOModalProps {
  orderId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ReceivePOModal({ orderId, onClose, onSuccess }: ReceivePOModalProps) {
  const [proveedorNombre, setProveedorNombre] = useState("")
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Document states
  const [tipoDocumento, setTipoDocumento] = useState<'factura' | 'remito'>('factura')
  const [nroComprobante, setNroComprobante] = useState("")
  const [fechaVencimientoPago, setFechaVencimientoPago] = useState(new Date().toISOString().split("T")[0])
  
  // Tax / Perception states
  const [percepcionIva, setPercepcionIva] = useState<number | "">(0)
  const [percepcionIibb, setPercepcionIibb] = useState<number | "">(0)
  const [percepcionGanancias, setPercepcionGanancias] = useState<number | "">(0)
  const [impuestosInternos, setImpuestosInternos] = useState<number | "">(0)

  const supabase = createClient()

  useEffect(() => {
    async function fetchOrder() {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id, 
          proveedores(nombre),
          purchase_order_items(
            id, 
            producto_id, 
            cantidad, 
            costo_unitario, 
            productos(nombre, unidad_medida, iva_pct, gramos_por_unidad)
          )
        `)
        .eq("id", orderId)
        .single()

      if (data) {
        const rawProv = data.proveedores as any
        const provName = Array.isArray(rawProv) 
          ? rawProv[0]?.nombre 
          : rawProv?.nombre
        setProveedorNombre(provName || "Proveedor")
        
        // Map database schema back to UI schema (bultos = cantidad / gramos_por_unidad, units = gramos_por_unidad)
        const uiItems = data.purchase_order_items.map((item: any) => {
          const rawUnitCost = Number(item.costo_unitario) || 0
          const rawQty = Number(item.cantidad) || 0
          const ivaPct = Number(item.productos?.iva_pct) || 0
          const unitsPerPkg = Number(item.productos?.gramos_por_unidad) || 1
          const bultos = rawQty / unitsPerPkg
          
          return {
            ...item,
            bultos: bultos,
            unidadesPorBulto: unitsPerPkg,
            // We store the user's entered cost. 
            // Since PO items are net in DB, if default is factura, we show net.
            costoUnitario: rawUnitCost,
            costoTotal: rawQty * rawUnitCost,
            iva_pct: ivaPct
          }
        })
        setItems(uiItems)
      }
      setLoading(false)
    }
    fetchOrder()
  }, [orderId])

  // Recalculate prices if tipoDocumento changes
  useEffect(() => {
    // When changing document type, we reset the numeric inputs of items to match their scale
    // If switching from factura to remito, items prices are final (net * (1+iva))
    // If switching from remito to factura, items prices are net (final / (1+iva))
    setItems(prevItems => prevItems.map(item => {
      const totalQty = (Number(item.bultos) || 0) * (Number(item.unidadesPorBulto) || 0)
      const ivaFactor = 1 + (Number(item.iva_pct) || 0) / 100

      let newUnitCost = item.costoUnitario
      if (tipoDocumento === 'remito') {
        // Convert to IVA included
        newUnitCost = Number((item.costoUnitario * ivaFactor).toFixed(4))
      } else {
        // Convert to net
        newUnitCost = Number((item.costoUnitario / ivaFactor).toFixed(4))
      }
      
      return {
        ...item,
        costoUnitario: newUnitCost,
        costoTotal: Number((newUnitCost * totalQty).toFixed(2))
      }
    }))
  }, [tipoDocumento])

  const handleItemChange = (idx: number, field: string, value: any) => {
    const newItems = [...items]
    const item = newItems[idx]
    
    item[field] = value

    const totalQty = (Number(item.bultos) || 0) * (Number(item.unidadesPorBulto) || 0)

    if (field === 'bultos' || field === 'unidadesPorBulto') {
      item.costoTotal = Number((item.costoUnitario * totalQty).toFixed(2))
    } 
    else if (field === 'costoTotal') {
      item.costoUnitario = totalQty > 0 ? Number((Number(value) / totalQty).toFixed(4)) : 0
    } 
    else if (field === 'costoUnitario') {
      item.costoTotal = Number((Number(value) * totalQty).toFixed(2))
    }

    setItems(newItems)
  }

  // Calculation formulas for final panel
  const computedTotals = React.useMemo(() => {
    let subtotalMercaderiaNeto = 0
    let totalIvaEstimado = 0
    let totalMercaderiaFinal = 0 // Sum of final price (net + iva)

    items.forEach(item => {
      const itemQty = (Number(item.bultos) || 0) * (Number(item.unidadesPorBulto) || 0)
      const enteredCostTotal = Number(item.costoTotal) || 0
      const ivaPct = Number(item.iva_pct) || 0

      if (tipoDocumento === 'remito') {
        // Entered total is final price (with IVA). We strip the IVA.
        const itemNetTotal = enteredCostTotal / (1 + ivaPct / 100)
        const itemIvaTotal = enteredCostTotal - itemNetTotal

        subtotalMercaderiaNeto += itemNetTotal
        totalIvaEstimado += itemIvaTotal
        totalMercaderiaFinal += enteredCostTotal
      } else {
        // Entered total is net price (without IVA). We add the IVA.
        const itemIvaTotal = enteredCostTotal * (ivaPct / 100)
        const itemFinalTotal = enteredCostTotal + itemIvaTotal

        subtotalMercaderiaNeto += enteredCostTotal
        totalIvaEstimado += itemIvaTotal
        totalMercaderiaFinal += itemFinalTotal
      }
    })

    const pIva = Number(percepcionIva) || 0
    const pIibb = Number(percepcionIibb) || 0
    const pGan = Number(percepcionGanancias) || 0
    const impInt = Number(impuestosInternos) || 0

    const totalCargasAdicionales = pIva + pIibb + pGan + impInt
    const totalFinanciero = (tipoDocumento === 'factura' ? totalMercaderiaFinal : totalMercaderiaFinal) + totalCargasAdicionales

    return {
      subtotalMercaderiaNeto,
      totalIvaEstimado,
      totalMercaderiaFinal,
      totalCargasAdicionales,
      totalFinanciero
    }
  }, [items, tipoDocumento, percepcionIva, percepcionIibb, percepcionGanancias, impuestosInternos])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: Enforce prices!
    if (items.some(i => i.costoTotal <= 0)) {
      alert("Por favor, ingresá el costo real de todos los insumos recibidos para poder valorizar el stock.")
      return
    }

    if (items.some(i => i.bultos <= 0 || i.unidadesPorBulto <= 0)) {
      alert("Las cantidades recibidas no pueden ser cero.")
      return
    }

    if (!nroComprobante.trim()) {
      alert(`Por favor, ingresá el número de ${tipoDocumento === 'factura' ? 'Factura' : 'Remito'} oficial.`)
      return
    }

    setSaving(true)

    try {
      // 1. Update purchase_order_items with final quantities and NET costs
      for (const item of items) {
        const totalQty = Number(item.bultos) * Number(item.unidadesPorBulto)
        
        let unitCostNet = 0
        if (tipoDocumento === 'remito') {
          // Entered price has IVA. Strip it!
          const totalCostNet = Number(item.costoTotal) / (1 + (Number(item.iva_pct) || 0) / 100)
          unitCostNet = totalQty > 0 ? totalCostNet / totalQty : 0
        } else {
          // Entered price is net already
          unitCostNet = totalQty > 0 ? Number(item.costoTotal) / totalQty : 0
        }

        const { error: itemErr } = await supabase
          .from("purchase_order_items")
          .update({
            cantidad: totalQty,
            costo_unitario: Number(unitCostNet.toFixed(4))
          })
          .eq("id", item.id)
          
        if (itemErr) throw itemErr
      }

      // 2. Update purchase_orders with financial details and accounting fields
      const { error: poErr } = await supabase
        .from("purchase_orders")
        .update({
          costo_total: Number(computedTotals.totalFinanciero.toFixed(2)),
          tipo_documento: tipoDocumento,
          nro_comprobante: nroComprobante.trim(),
          percepcion_iva: tipoDocumento === 'factura' ? Number(percepcionIva) || 0 : 0,
          percepcion_iibb: tipoDocumento === 'factura' ? Number(percepcionIibb) || 0 : 0,
          percepcion_ganancias: tipoDocumento === 'factura' ? Number(percepcionGanancias) || 0 : 0,
          impuestos_internos: tipoDocumento === 'factura' ? Number(impuestosInternos) || 0 : 0,
          facturado: tipoDocumento === 'factura',
          desvio_inflacion: 0,
          fecha_vencimiento_pago: fechaVencimientoPago || null
        })
        .eq("id", orderId)

      if (poErr) throw poErr

      // 3. Call RPC to finalize reception and update physical stock
      const { error: rpcErr } = await supabase.rpc('recepcionar_orden_compra', { p_po_id: orderId })
      
      if (rpcErr) throw rpcErr

      alert(`¡Orden recibida como ${tipoDocumento.toUpperCase()} y stock valorizado al neto correctamente!`)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      alert("Error al recepcionar: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-emerald-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50/50">
          <div>
            <h2 className="text-2xl font-black text-emerald-950 uppercase italic tracking-tighter flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-600" />
              Recepción de Mercadería
            </h2>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">
              Validá cantidades, discriminá impuestos y valorizá tu stock
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-full text-emerald-800 transition-colors">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-emerald-600" size={48} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            
            {/* 1. SECCIÓN: DATOS DE COMPROBANTE */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-[2rem] p-6 space-y-6 shadow-inner">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={18} className="text-slate-500" /> Documento de Respaldo
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Proveedor: <span className="text-slate-700">{proveedorNombre}</span>
                  </p>
                </div>
                
                {/* Selector de Documento */}
                <div className="flex bg-slate-200 p-1 rounded-xl w-full md:w-auto self-start">
                  <button
                    type="button"
                    onClick={() => setTipoDocumento('factura')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      tipoDocumento === 'factura'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Factura Directa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDocumento('remito')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      tipoDocumento === 'remito'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Remito (Factura Diferida)
                  </button>
                </div>
              </div>

              {/* Grid de Inputs de Cabecera */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    {tipoDocumento === 'factura' ? 'Nro de Factura Oficial' : 'Nro de Remito'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tipoDocumento === 'factura' ? 'Ej: 0005-00012345' : 'Ej: 0001-00004567'}
                    value={nroComprobante}
                    onChange={(e) => setNroComprobante(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Fecha Vencimiento de Pago
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaVencimientoPago}
                    onChange={(e) => setFechaVencimientoPago(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {tipoDocumento === 'remito' && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in duration-300">
                    <AlertCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-[10px] font-black text-emerald-900 uppercase tracking-wide">Desglose de IVA Activo</p>
                      <p className="text-[10px] text-emerald-700 font-medium leading-relaxed mt-0.5">
                        Ingresá los precios de los insumos tal como figuran en tu lista (con IVA). El sistema calculará el costo neto automáticamente para la valoración del stock en el inventario.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección de Cargas Impositivas Adicionales (Solo Factura) */}
              {tipoDocumento === 'factura' && (
                <div className="border-t border-slate-200/80 pt-6 animate-in slide-in-from-top-4 duration-300">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <Landmark size={14} /> Percepciones e Impuestos Adicionales (RG 4240, IIBB, etc.)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Percepción IVA</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={percepcionIva === 0 ? '' : percepcionIva}
                          onChange={(e) => setPercepcionIva(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Percepción IIBB</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={percepcionIibb === 0 ? '' : percepcionIibb}
                          onChange={(e) => setPercepcionIibb(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Percepción Ganancias (RG 4240)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={percepcionGanancias === 0 ? '' : percepcionGanancias}
                          onChange={(e) => setPercepcionGanancias(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Impuestos Internos</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={impuestosInternos === 0 ? '' : impuestosInternos}
                          onChange={(e) => setImpuestosInternos(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. SECCIÓN: ÍTEMS / INSUMOS RECIBIDOS */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                Detalle de Insumos Recibidos
              </h3>
              
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const totalQty = (Number(item.bultos) || 0) * (Number(item.unidadesPorBulto) || 0)
                  const ivaPct = Number(item.iva_pct) || 0
                  
                  // Compute secondary price preview
                  let previewLabel = ""
                  let previewValue = 0

                  if (tipoDocumento === 'remito') {
                    // Entered is final. Preview is Net.
                    previewLabel = "Neto Estimado Stock"
                    previewValue = item.costoUnitario / (1 + ivaPct / 100)
                  } else {
                    // Entered is Net. Preview is Final (with IVA).
                    previewLabel = "Costo con IVA"
                    previewValue = item.costoUnitario * (1 + ivaPct / 100)
                  }

                  return (
                    <div key={item.id} className="flex flex-col lg:flex-row items-start lg:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors">
                      
                      {/* Producto */}
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-slate-900 uppercase">{item.productos?.nombre}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unidad: {item.productos?.unidad_medida}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Percent size={10} /> IVA {ivaPct}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Cantidades y Costos */}
                      <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="w-20">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bultos</label>
                          <input
                            type="number" min="0.1" step="0.1" required
                            value={item.bultos || ''}
                            onChange={(e) => handleItemChange(idx, 'bultos', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="w-20">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unid/Bulto</label>
                          <input
                            type="number" min="1" step="1" required
                            value={item.unidadesPorBulto || ''}
                            onChange={(e) => handleItemChange(idx, 'unidadesPorBulto', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        {/* Costo Unitario */}
                        <div className="w-28">
                          <label className="block text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">
                            {tipoDocumento === 'remito' ? 'Costo Unit. c/IVA' : 'Costo Unit. Neto'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                            <input
                              type="number" min="0.0001" step="0.0001" required
                              value={item.costoUnitario === 0 ? '' : item.costoUnitario}
                              onChange={(e) => handleItemChange(idx, 'costoUnitario', e.target.value)}
                              className="w-full pl-7 pr-2 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-black text-emerald-950 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                          <span className="block text-[8px] text-slate-400 font-bold mt-1 uppercase">
                            {previewLabel}: ${previewValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                        </div>

                        {/* Costo Fila */}
                        <div className="w-32">
                          <label className="block text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">
                            {tipoDocumento === 'remito' ? 'Total Fila c/IVA' : 'Total Fila Neto'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                            <input
                              type="number" min="0.01" step="0.01" required
                              value={item.costoTotal === 0 ? '' : item.costoTotal}
                              onChange={(e) => handleItemChange(idx, 'costoTotal', e.target.value)}
                              className="w-full pl-7 pr-2 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                          <span className="block text-[8px] text-slate-400 font-bold mt-1 uppercase">
                            Cant. Total: {totalQty} {item.productos?.unidad_medida}
                          </span>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. SECCIÓN: TOTALES FINANCIEROS Y RESUMEN */}
            <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              
              {/* Desglose impositivo resumido */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full md:w-auto shrink-0 shadow-inner">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subtotal Neto Stock</p>
                  <p className="font-bold text-slate-700 tabular-nums">
                    $ {computedTotals.subtotalMercaderiaNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total IVA Estimado</p>
                  <p className="font-bold text-slate-700 tabular-nums">
                    $ {computedTotals.totalIvaEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2 border-t border-slate-200/60 my-1 pt-1.5">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Percepciones y Tasas</span>
                    <span className="font-bold text-slate-600 tabular-nums text-xs">
                      $ {computedTotals.totalCargasAdicionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Final Grande */}
              <div className="text-right w-full md:w-auto flex flex-col items-end gap-1">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  {tipoDocumento === 'factura' ? 'Costo Total Factura' : 'Costo Total Remito (c/IVA)'}
                </p>
                <p className="text-4xl font-black text-emerald-950 tabular-nums tracking-tighter">
                  $ {computedTotals.totalFinanciero.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                  Este total se registrará para caja y control contable
                </p>
              </div>
            </div>

            {/* Footer de Botones */}
            <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
              <button 
                type="button" onClick={onClose}
                className="px-6 py-3 font-black text-slate-500 uppercase text-xs tracking-widest hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" disabled={saving || items.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl shadow-emerald-100 transition-all active:scale-95"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmar Ingreso
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
