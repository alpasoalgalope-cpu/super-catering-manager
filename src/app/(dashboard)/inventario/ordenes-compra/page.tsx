"use client"

import React, { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ShoppingCart, Plus, Package, Clock, CheckCircle2, XCircle, Search, Truck, Edit2, Trash2 } from "lucide-react"
import { PurchaseOrder } from "@/types/inventory"
import CreatePOModal from "@/components/inventory/CreatePOModal"
import ReceivePOModal from "@/components/inventory/ReceivePOModal"

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("TODAS")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        proveedores (nombre),
        purchase_order_items (
          producto_id,
          cantidad,
          costo_unitario,
          productos (nombre, unidad_medida)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error fetching POs:", error)
    } else {
      setOrders(data as any)
    }
    setLoading(false)
  }

  // The actual receive logic is now handled in ReceivePOModal.
  // We keep this function name but just use it to open the modal.
  function openReceiveModal(id: string) {
    setReceiveOrderId(id)
  }

  async function handleDeleteOrder(id: string) {
    if (!window.confirm("¿Está seguro de que desea eliminar permanentemente esta orden de compra? Esta acción no se puede deshacer y borrará también sus ítems.")) {
      return
    }

    setDeletingId(id)
    try {
      // 1. Eliminar ítems de la orden de compra
      const { error: itemsErr } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("po_id", id)

      if (itemsErr) throw itemsErr

      // 2. Eliminar la orden de compra
      const { error: poErr } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id)

      if (poErr) throw poErr

      alert("Orden de compra eliminada correctamente.")
      fetchOrders()
    } catch (err: any) {
      console.error(err)
      alert("Error al eliminar la orden de compra: " + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredOrders = orders.filter(o => {
    const provName = o.proveedores?.nombre?.toLowerCase() || ""
    const matchesSearch = provName.includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm)
    const matchesStatus = statusFilter === "TODAS" || o.estado === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusColors: any = {
    'PENDIENTE': 'bg-amber-100 text-amber-800 border-amber-200',
    'RECIBIDA': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'CANCELADA': 'bg-rose-100 text-rose-800 border-rose-200'
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3 italic uppercase">
            <Truck className="text-indigo-600" size={32} />
            Órdenes de Compra
          </h2>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-[10px] mt-1">
            Gestión de Stock en Tránsito y Recepción de Proveedores
          </p>
        </div>
        <button 
          onClick={() => { setEditOrderId(null); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
        
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por proveedor o ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
            {['TODAS', 'PENDIENTE', 'RECIBIDA'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  statusFilter === status 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <Package className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay órdenes registradas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
               const itemsCount = order.purchase_order_items?.length || 0
               const qtyTotal = order.purchase_order_items?.reduce((acc: number, curr: any) => acc + Number(curr.cantidad), 0) || 0

               return (
                <div key={order.id} className="group bg-white border border-slate-200 rounded-3xl p-6 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <ShoppingCart size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusColors[order.estado]}`}>
                          {order.estado}
                        </span>
                        
                        {order.estado === 'RECIBIDA' && (
                          <>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              order.tipo_documento === 'remito'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {order.tipo_documento === 'remito' ? 'Remito' : 'Factura'}
                            </span>
                            
                            {order.tipo_documento === 'remito' && (
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                order.facturado
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                              }`}>
                                {order.facturado ? 'Facturado' : 'Pend. Factura'}
                              </span>
                            )}
                          </>
                        )}

                        <span className="text-xs font-bold text-slate-400 ml-1">
                          Entrega: {new Date(order.fecha_esperada + 'T12:00:00').toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">
                        {order.proveedores?.nombre || "Proveedor Eliminado"}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {itemsCount} insumos • {qtyTotal} unidades totales • {order.nro_comprobante ? `Comprobante: ${order.nro_comprobante} • ` : ''}ID: {order.id.split('-')[0]}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="text-right flex-1 md:flex-none">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Costo Estimado</p>
                      <p className="text-xl font-black text-slate-800 tabular-nums">{formatCurrency(order.costo_total)}</p>
                    </div>
                    
                    {order.estado === 'PENDIENTE' && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setEditOrderId(order.id); setShowModal(true); }}
                          className="text-slate-400 hover:text-indigo-600 p-2 transition-colors rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                          title="Editar Orden"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deletingId === order.id}
                          className="text-slate-400 hover:text-rose-600 p-2 transition-colors rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 disabled:opacity-50"
                          title="Eliminar Orden"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          onClick={() => openReceiveModal(order.id)}
                          className="bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-emerald-200 flex items-center gap-2"
                        >
                          <CheckCircle2 size={16} /> Recibir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <CreatePOModal 
          editOrderId={editOrderId}
          onClose={() => { setShowModal(false); setEditOrderId(null); }}
          onSuccess={() => {
            setShowModal(false)
            setEditOrderId(null)
            fetchOrders()
          }}
        />
      )}

      {receiveOrderId && (
        <ReceivePOModal 
          orderId={receiveOrderId}
          onClose={() => setReceiveOrderId(null)}
          onSuccess={() => {
            setReceiveOrderId(null)
            fetchOrders()
          }}
        />
      )}
    </div>
  )
}
