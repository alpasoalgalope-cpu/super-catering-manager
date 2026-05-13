"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { AlertTriangle, Coffee, Search, Plus, Trash2, ArrowDownRight, ArrowUpRight, CheckCircle2, Loader2, DollarSign, ClipboardList, Edit2 } from "lucide-react"
import { createMermaAction, createConsumoAction, createCompraAction, updateCompraAction } from "@/app/actions/adjustments"

export default function AjustesPage() {
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<any[]>([])
  const [recetas, setRecetas] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  
  const [mermas, setMermas] = useState<any[]>([])
  const [consumos, setConsumos] = useState<any[]>([])
  const [comprasHist, setComprasHist] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'merma' | 'consumo' | 'compra'>('merma')

  // Merma Form
  const [mermaProd, setMermaProd] = useState("")
  const [mermaQty, setMermaQty] = useState("")
  const [mermaMotivoCategoria, setMermaMotivoCategoria] = useState("")
  const [mermaMotivoDetalle, setMermaMotivoDetalle] = useState("")
  
  // Consumo Form
  const [consumoTipo, setConsumoTipo] = useState<'vianda' | 'suelto'>('vianda')
  const [consumoItem, setConsumoItem] = useState("")
  const [consumoQty, setConsumoQty] = useState("")
  const [consumoEmpleado, setConsumoEmpleado] = useState("")

  // Compra Form
  const [compraProd, setCompraProd] = useState("")
  const [compraProv, setCompraProv] = useState("")
  const [compraQtyBultos, setCompraQtyBultos] = useState("")
  const [compraUnitsPerBulto, setCompraUnitsPerBulto] = useState("1")
  const [compraCostoTotalBulto, setCompraCostoTotalBulto] = useState("")
  const [compraObs, setCompraObs] = useState("")
  const [editCompraId, setEditCompraId] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const [
      { data: pData },
      { data: rData },
      { data: mData },
      { data: cData },
      { data: provData },
      { data: compData }
    ] = await Promise.all([
      supabase.from("productos").select("id, nombre, unidad_medida, factor_merma, familias(nombre)").order("nombre"),
      supabase.from("recetas").select("id, nombre").order("nombre"),
      supabase.from("registro_desperdicios").select("*, productos(nombre, unidad_medida)").order("fecha", { ascending: false }).limit(20),
      supabase.from("registro_consumos_personal").select("*, recetas(nombre), productos(nombre, unidad_medida)").order("fecha", { ascending: false }).limit(20),
      supabase.from("proveedores").select("id, nombre").order("nombre"),
      supabase.from("registro_compras").select("*, productos(nombre, unidad_medida), proveedores(nombre)").order("fecha", { ascending: false }).limit(20)
    ])

    setProductos(pData || [])
    setRecetas(rData || [])
    setMermas(mData || [])
    setConsumos(cData || [])
    setProveedores(provData || [])
    setComprasHist(compData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleMermaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mermaProd || !mermaQty || !mermaMotivoCategoria) return
    setIsSubmitting(true)
    setMessage(null)
    const finalMotivo = mermaMotivoCategoria === 'Otros' ? `Otros: ${mermaMotivoDetalle}` : mermaMotivoCategoria
    const res = await createMermaAction({ productoId: mermaProd, cantidad: Number(mermaQty), motivo: finalMotivo })
    if (res.success) {
      setMessage({ type: 'success', text: 'Merma registrada exitosamente.' })
      setMermaProd(""); setMermaQty(""); setMermaMotivoCategoria(""); setMermaMotivoDetalle(""); fetchData()
    } else setMessage({ type: 'error', text: res.error || 'Error al guardar.' })
    setIsSubmitting(false)
  }

  const handleConsumoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consumoItem || !consumoQty || !consumoEmpleado) return
    setIsSubmitting(true)
    setMessage(null)
    const res = await createConsumoAction({ tipoConsumo: consumoTipo, empleadoNombre: consumoEmpleado, cantidad: Number(consumoQty), itemId: consumoItem })
    if (res.success) {
      setMessage({ type: 'success', text: 'Consumo registrado exitosamente.' })
      setConsumoItem(""); setConsumoQty(""); setConsumoEmpleado(""); fetchData()
    } else setMessage({ type: 'error', text: res.error || 'Error al guardar.' })
    setIsSubmitting(false)
  }

  const handleCompraSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!compraProd || !compraQtyBultos || !compraUnitsPerBulto) return
    setIsSubmitting(true)
    setMessage(null)

    const bultos = Number(compraQtyBultos)
    const unitsPer = Number(compraUnitsPerBulto)
    const totalQty = bultos * unitsPer
    const totalCost = Number(compraCostoTotalBulto) || 0
    const unitCost = totalQty > 0 ? totalCost / totalQty : 0

    let res;
    if (editCompraId) {
      res = await updateCompraAction(editCompraId, { 
        productoId: compraProd, 
        proveedorId: compraProv || undefined, 
        cantidad: totalQty, 
        costoTotal: totalCost,
        costoUnidad: unitCost, 
        observaciones: compraObs 
      })
    } else {
      res = await createCompraAction({ 
        productoId: compraProd, 
        proveedorId: compraProv || undefined, 
        cantidad: totalQty, 
        costoUnidad: unitCost, 
        observaciones: compraObs 
      })
    }

    if (res.success) {
      setMessage({ type: 'success', text: editCompraId ? 'Compra actualizada exitosamente.' : 'Compra registrada y stock actualizado.' })
      cancelEditCompra()
      fetchData()
    } else setMessage({ type: 'error', text: res.error || 'Error al guardar.' })
    setIsSubmitting(false)
  }

  const handleEditCompra = (c: any) => {
    setActiveTab('compra')
    setEditCompraId(c.id)
    setCompraProd(c.producto_id)
    setCompraProv(c.proveedor_id || "")
    setCompraQtyBultos(c.cantidad.toString())
    setCompraUnitsPerBulto("1")
    setCompraCostoTotalBulto(c.total_compra ? c.total_compra.toString() : (c.costo_unidad * c.cantidad).toString())
    setCompraObs(c.observaciones || "")
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditCompra = () => {
    setEditCompraId(null)
    setCompraProd("")
    setCompraProv("")
    setCompraQtyBultos("")
    setCompraUnitsPerBulto("1")
    setCompraCostoTotalBulto("")
    setCompraObs("")
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val || 0)

  const totalMermas = mermas.reduce((acc, curr) => acc + Number(curr.costo_total), 0)
  const totalConsumos = consumos.reduce((acc, curr) => acc + Number(curr.costo_total), 0)
  const totalCompras = comprasHist.reduce((acc, curr) => acc + Number(curr.total_compra), 0)

  const selectedMermaProd = productos.find(p => p.id === mermaProd)
  const mermaUnit = selectedMermaProd ? selectedMermaProd.unidad_medida : "UN"

  const selectedConsumoProd = productos.find(p => p.id === consumoItem)
  const consumoUnit = consumoTipo === 'vianda' ? 'viandas' : (selectedConsumoProd ? selectedConsumoProd.unidad_medida : "UN")

  const selectedCompraProd = productos.find(p => p.id === compraProd)
  const compraUnit = selectedCompraProd ? selectedCompraProd.unidad_medida : "UN"

  if (loading) return (
    <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-400" size={40} /></div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
         <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Ajustes y Movimientos</h1>
            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest italic">Gestión de Stock Fuera de Venta</p>
         </div>
         <div className="flex gap-4">
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-right min-w-[140px]">
               <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Mermas</p>
               <p className="text-xl font-black text-rose-700 tabular-nums">{formatCurrency(totalMermas)}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-right min-w-[140px]">
               <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Compras</p>
               <p className="text-xl font-black text-emerald-700 tabular-nums">{formatCurrency(totalCompras)}</p>
            </div>
         </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
         {/* Tabs */}
         <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button onClick={() => setActiveTab('merma')} className={`flex-1 flex items-center justify-center gap-2 py-5 font-black text-xs tracking-widest uppercase transition-all ${activeTab === 'merma' ? 'bg-white text-rose-600 border-b-4 border-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
               <AlertTriangle size={16} /> Mermas / Desperdicio
            </button>
            <button onClick={() => setActiveTab('consumo')} className={`flex-1 flex items-center justify-center gap-2 py-5 font-black text-xs tracking-widest uppercase transition-all ${activeTab === 'consumo' ? 'bg-white text-amber-600 border-b-4 border-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
               <Coffee size={16} /> Consumo Personal
            </button>
            <button onClick={() => setActiveTab('compra')} className={`flex-1 flex items-center justify-center gap-2 py-5 font-black text-xs tracking-widest uppercase transition-all ${activeTab === 'compra' ? 'bg-white text-emerald-600 border-b-4 border-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
               <Plus size={16} /> Ingreso Mercadería
            </button>
         </div>

         <div className="p-10">
            {activeTab === 'merma' && (
               <form onSubmit={handleMermaSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Insumo a dar de baja</label>
                        <select required value={mermaProd} onChange={e => setMermaProd(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700">
                           <option value="">Seleccionar...</option>
                           {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.familias?.nombre})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cantidad</label>
                        <div className="relative">
                           <input type="number" step="0.01" min="0.01" required value={mermaQty} onChange={e => setMermaQty(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl pl-4 pr-20 py-3 text-sm font-bold text-slate-700" />
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-100 text-rose-700 text-[9px] font-black px-2 py-1 rounded-md uppercase">{mermaUnit}</span>
                        </div>
                     </div>
                     <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo / Categoría</label>
                        <select required value={mermaMotivoCategoria} onChange={e => setMermaMotivoCategoria(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700">
                           <option value="">Seleccionar motivo...</option>
                           <option value="Vencimiento / Caducidad">Vencimiento / Caducidad</option>
                           <option value="Rotura / Daño Físico">Rotura / Daño Físico</option>
                           <option value="Mal Estado / Calidad">Mal Estado / Calidad</option>
                           <option value="Error de Preparación / Cocción">Error de Preparación / Cocción</option>
                           <option value="Merma Técnica (Corte / Producción)">Merma Técnica (Corte / Producción)</option>
                           <option value="Faltante de Stock / Inventario">Faltante de Stock / Inventario</option>
                           <option value="Robo / Pérdida Inexplicable">Robo / Pérdida Inexplicable</option>
                           <option value="Otros">Otros (Especificar)</option>
                        </select>
                     </div>
                     {mermaMotivoCategoria === 'Otros' && (
                        <div className="lg:col-span-2">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Especificar Motivo</label>
                           <input type="text" required value={mermaMotivoDetalle} onChange={e => setMermaMotivoDetalle(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700" />
                        </div>
                     )}
                     <div className="flex items-end">
                        <button disabled={isSubmitting} type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-rose-200 disabled:opacity-50">Registrar Merma</button>
                     </div>
                  </div>
               </form>
            )}

            {activeTab === 'consumo' && (
               <form onSubmit={handleConsumoSubmit} className="space-y-6">
                  <div className="flex gap-4 p-1 bg-slate-100 rounded-lg w-fit mb-6">
                     <button type="button" onClick={() => { setConsumoTipo('vianda'); setConsumoItem("") }} className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${consumoTipo === 'vianda' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>Vianda Cerrada</button>
                     <button type="button" onClick={() => { setConsumoTipo('suelto'); setConsumoItem("") }} className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${consumoTipo === 'suelto' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>Insumo Suelto</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">¿Qué consumió?</label>
                        <select required value={consumoItem} onChange={e => setConsumoItem(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700">
                           <option value="">Seleccionar {consumoTipo === 'vianda' ? 'Vianda' : 'Insumo'}...</option>
                           {consumoTipo === 'vianda' ? recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>) : productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.familias?.nombre})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cantidad</label>
                        <div className="relative">
                           <input type="number" step="0.01" min="0.01" required value={consumoQty} onChange={e => setConsumoQty(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl pl-4 pr-24 py-3 text-sm font-bold text-slate-700" />
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-1 rounded-md uppercase">{consumoUnit}</span>
                        </div>
                     </div>
                     <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre del Empleado</label>
                        <input type="text" required value={consumoEmpleado} onChange={e => setConsumoEmpleado(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700" placeholder="Ej: Juan Perez" />
                     </div>
                     <div className="flex items-end">
                        <button disabled={isSubmitting} type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-amber-100 disabled:opacity-50">Registrar Consumo</button>
                     </div>
                  </div>
               </form>
            )}

            {activeTab === 'compra' && (
               <form onSubmit={handleCompraSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Producto Recibido</label>
                        <select required value={compraProd} onChange={e => setCompraProd(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700">
                           <option value="">Seleccionar producto...</option>
                           {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.familias?.nombre})</option>)}
                        </select>
                     </div>
                     <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proveedor (Opcional)</label>
                        <select value={compraProv} onChange={e => setCompraProv(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700">
                           <option value="">Seleccionar proveedor...</option>
                           {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cantidad (Bultos)</label>
                           <input type="number" step="0.01" min="0.01" required value={compraQtyBultos} onChange={e => setCompraQtyBultos(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700" />
                        </div>
                        <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unidades x Bulto</label>
                           <input type="number" min="1" required value={compraUnitsPerBulto} onChange={e => setCompraUnitsPerBulto(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700" />
                        </div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Costo Total de la Compra (S/IVA)</label>
                        <div className="relative">
                           <input type="number" step="0.01" value={compraCostoTotalBulto} onChange={e => setCompraCostoTotalBulto(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl pl-8 py-3 text-sm font-bold text-slate-700" placeholder="0.00" />
                           <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                        {Number(compraQtyBultos) * Number(compraUnitsPerBulto) > 0 && (
                           <div className="mt-2 space-y-1">
                              <p className="text-[10px] font-bold text-slate-500 italic">
                                 Costo Unitario Neto: ${((Number(compraCostoTotalBulto)||0) / (Number(compraQtyBultos) * Number(compraUnitsPerBulto))).toFixed(2)} por {compraUnit}
                              </p>
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">
                                 Costo Útil (con {((selectedCompraProd?.factor_merma || 1)*100).toFixed(0)}% rinde): ${((Number(compraCostoTotalBulto)||0) / (Number(compraQtyBultos) * Number(compraUnitsPerBulto) * (selectedCompraProd?.factor_merma || 1))).toFixed(2)}
                              </p>
                           </div>
                        )}
                     </div>
                     <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Observaciones / Nro Factura</label>
                        <input type="text" value={compraObs} onChange={e => setCompraObs(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700" placeholder="Ej: Factura A-0001..." />
                     </div>
                     <div className="flex items-end gap-2">
                        {editCompraId && (
                           <button type="button" onClick={cancelEditCompra} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all">Cancelar</button>
                        )}
                        <button disabled={isSubmitting} type="submit" className={`${editCompraId ? 'w-2/3' : 'w-full'} bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-100 disabled:opacity-50`}>
                           {editCompraId ? 'Actualizar' : 'Cargar Compra'}
                        </button>
                     </div>
                  </div>
               </form>
            )}
         </div>
      </div>

      {/* Tables Section */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 overflow-hidden">
         <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 italic uppercase tracking-tight">
            <ClipboardList className="text-indigo-500" size={24} /> Últimos Movimientos
         </h3>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                     <th className="pb-4">Fecha</th>
                     <th className="pb-4">Tipo</th>
                     <th className="pb-4">Producto / Ítem</th>
                     <th className="pb-4">Cantidad</th>
                     <th className="pb-4">Detalle / Motivo</th>
                     <th className="pb-4 text-right">Costo Total</th>
                     {activeTab === 'compra' && <th className="pb-4 text-center">Acciones</th>}
                  </tr>
               </thead>
               <tbody className="text-sm font-bold">
                  {/* COMPRAS */}
                  {activeTab === 'compra' && comprasHist.map(c => (
                     <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 text-slate-400 text-[10px] uppercase">{new Date(c.fecha).toLocaleDateString()}</td>
                        <td className="py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[8px] uppercase">Compra</span></td>
                        <td className="py-4 text-slate-800">{c.productos?.nombre}</td>
                        <td className="py-4 text-emerald-600">+{c.cantidad} <span className="text-[9px]">{c.productos?.unidad_medida}</span></td>
                        <td className="py-4 text-slate-400 text-xs italic">{c.proveedores?.nombre || c.observaciones || "S/D"}</td>
                        <td className="py-4 text-right text-emerald-800">{formatCurrency(c.total_compra)}</td>
                        <td className="py-4 text-center">
                           <button onClick={() => handleEditCompra(c)} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Editar Compra">
                              <Edit2 size={16} />
                           </button>
                        </td>
                     </tr>
                  ))}
                  {/* MERMAS */}
                  {activeTab === 'merma' && mermas.map(m => (
                     <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 text-slate-400 text-[10px] uppercase">{new Date(m.fecha).toLocaleDateString()}</td>
                        <td className="py-4"><span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md text-[8px] uppercase">Merma</span></td>
                        <td className="py-4 text-slate-800">{m.productos?.nombre}</td>
                        <td className="py-4 text-rose-600">-{m.cantidad} <span className="text-[9px]">{m.productos?.unidad_medida}</span></td>
                        <td className="py-4 text-slate-400 text-xs italic">{m.motivo}</td>
                        <td className="py-4 text-right text-rose-800">{formatCurrency(m.costo_total)}</td>
                     </tr>
                  ))}
                  {/* CONSUMOS */}
                  {activeTab === 'consumo' && consumos.map(c => (
                     <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 text-slate-400 text-[10px] uppercase">{new Date(c.fecha).toLocaleDateString()}</td>
                        <td className="py-4"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[8px] uppercase">Consumo</span></td>
                        <td className="py-4 text-slate-800">{c.tipo_consumo === 'vianda' ? c.recetas?.nombre : c.productos?.nombre}</td>
                        <td className="py-4 text-amber-600">-{c.cantidad} <span className="text-[9px]">{c.tipo_consumo === 'vianda' ? 'un' : c.productos?.unidad_medida}</span></td>
                        <td className="py-4 text-slate-400 text-xs italic">{c.empleado_nombre}</td>
                        <td className="py-4 text-right text-amber-800">{formatCurrency(c.costo_total)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  )
}
