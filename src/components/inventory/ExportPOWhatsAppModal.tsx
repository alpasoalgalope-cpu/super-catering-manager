"use client"

import React, { useState, useMemo } from "react"
import { 
  X, MessageSquare, Copy, Check, ExternalLink, 
  Truck, Calendar, Package, Send, CheckCircle2,
  ChevronRight, Filter, Building2, Phone
} from "lucide-react"

interface ExportPOWhatsAppModalProps {
  orders: any[]
  initialSelectedOrderId?: string | null
  onClose: () => void
}

export function formatItemLine(item: any): string {
  const prodName = item.productos?.nombre || 'Insumo'
  const unit = item.productos?.unidad_medida || 'un'
  const qty = Number(item.cantidad) || 0
  const gramsPerUnit = item.productos?.gramos_por_unidad || 1

  if (gramsPerUnit > 1) {
    const bultos = Math.round((qty / gramsPerUnit) * 10) / 10
    const bultosLabel = unit === 'un' ? 'packs' : 'bultos'
    return `*${prodName}*: ${bultos} ${bultosLabel} × ${gramsPerUnit.toLocaleString('es-AR')} ${unit} = *${qty.toLocaleString('es-AR')} ${unit}*`
  } else {
    return `*${prodName}*: *${qty.toLocaleString('es-AR')} ${unit}*`
  }
}

export function formatPOWhatsAppText(order: any): string {
  const provName = order.proveedores?.nombre || 'Proveedor'
  const fecha = order.fecha_esperada 
    ? new Date(order.fecha_esperada + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'A coordinar'

  let msg = `📦 *ORDEN DE COMPRA - SUPER CATERING*\n`
  msg += `🏢 *Proveedor:* ${provName}\n`
  msg += `📅 *Fecha de Entrega:* ${fecha}\n`
  if (order.id) {
    msg += `🔖 *OC ID:* #${order.id.slice(0, 8)}\n`
  }
  msg += `\n📋 *DETALLE DEL PEDIDO (Bultos × Presentación = Total):*\n`

  if (order.purchase_order_items && order.purchase_order_items.length > 0) {
    order.purchase_order_items.forEach((item: any, idx: number) => {
      msg += `${idx + 1}. ${formatItemLine(item)}\n`
    })
  } else {
    msg += `• (Sin ítems detallados)\n`
  }

  msg += `\n📍 *Lugar de Entrega:* Cocina Central - Super Catering\n`
  msg += `🙏 *Por favor confirmar recepción del pedido y horario estimado de entrega.*\n¡Muchas gracias!`

  return msg
}

export function formatMultiplePOsWhatsAppText(provName: string, provOrders: any[]): string {
  let msg = `📦 *PEDIDOS DE COMPRA - SUPER CATERING*\n`
  msg += `🏢 *Proveedor:* ${provName}\n`
  msg += `📅 *Total de Entregas:* ${provOrders.length}\n\n`

  provOrders.forEach((order, oIdx) => {
    const fecha = order.fecha_esperada 
      ? new Date(order.fecha_esperada + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' })
      : 'A coordinar'
    
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `🚚 *ENTREGA #${oIdx + 1}:* ${fecha}\n`
    if (order.id) msg += `🔖 *OC:* #${order.id.slice(0, 8)}\n`
    msg += `📝 *Ítems (Bultos × Presentación = Total):*\n`

    if (order.purchase_order_items && order.purchase_order_items.length > 0) {
      order.purchase_order_items.forEach((item: any) => {
        msg += `  • ${formatItemLine(item)}\n`
      })
    }
    msg += `\n`
  })

  msg += `📍 *Lugar de Entrega:* Cocina Central - Super Catering\n`
  msg += `🙏 *Por favor confirmar recepción y disponibilidad de entrega.*\n¡Muchas gracias!`

  return msg
}

export function formatConsolidatedSummaryWhatsAppText(orders: any[]): string {
  let msg = `📋 *RESUMEN CONSOLIDADO DE COMPRAS - SUPER CATERING*\n`
  msg += `📅 *Fecha de Emisión:* ${new Date().toLocaleDateString('es-AR')}\n`
  msg += `🚚 *Total de Órdenes:* ${orders.length}\n\n`

  // Group by Provider
  const groups: Record<string, any[]> = {}
  orders.forEach(o => {
    const provName = o.proveedores?.nombre || 'Sin Proveedor'
    if (!groups[provName]) groups[provName] = []
    groups[provName].push(o)
  })

  Object.entries(groups).forEach(([prov, ords]) => {
    msg += `🏢 *${prov.toUpperCase()}* (${ords.length} entrega${ords.length > 1 ? 's' : ''}):\n`
    ords.forEach((order, oIdx) => {
      const fecha = order.fecha_esperada 
        ? new Date(order.fecha_esperada + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
        : 'S/F'
      msg += `  ▫️ *Entrega #${oIdx + 1}: ${fecha}* [${order.estado}]:\n`
      if (order.purchase_order_items && order.purchase_order_items.length > 0) {
        order.purchase_order_items.forEach((item: any) => {
          msg += `     • ${formatItemLine(item)}\n`
        })
      } else {
        msg += `     • (Sin ítems)\n`
      }
    })
    msg += `\n`
  })

  msg += `_Super Catering Manager · Sistema Operativo de Cocina_`
  return msg
}

export default function ExportPOWhatsAppModal({ 
  orders, 
  initialSelectedOrderId, 
  onClose 
}: ExportPOWhatsAppModalProps) {
  const [activeTab, setActiveTab] = useState<'by_provider' | 'single_order' | 'consolidated'>('by_provider')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedProv, setSelectedProv] = useState<string>("")
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialSelectedOrderId || (orders[0]?.id || ""))

  // Group orders by Provider
  const providerGroups = useMemo(() => {
    const map: Record<string, {
      provName: string
      contacto?: string
      orders: any[]
    }> = {}

    orders.forEach(order => {
      const pName = order.proveedores?.nombre || 'Sin Proveedor'
      if (!map[pName]) {
        map[pName] = {
          provName: pName,
          contacto: order.proveedores?.contacto,
          orders: []
        }
      }
      map[pName].orders.push(order)
    })

    return Object.values(map)
  }, [orders])

  // Set default selected provider
  React.useEffect(() => {
    if (providerGroups.length > 0 && !selectedProv) {
      if (initialSelectedOrderId) {
        const found = orders.find(o => o.id === initialSelectedOrderId)
        if (found) {
          setSelectedProv(found.proveedores?.nombre || providerGroups[0].provName)
          setActiveTab('single_order')
          return
        }
      }
      setSelectedProv(providerGroups[0].provName)
    }
  }, [providerGroups, initialSelectedOrderId, orders])

  const currentProvGroup = providerGroups.find(p => p.provName === selectedProv) || providerGroups[0]
  const currentOrder = orders.find(o => o.id === selectedOrderId) || orders[0]

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const handleSendWhatsApp = (text: string, phone?: string) => {
    const cleanPhone = (phone || "").replace(/\D/g, "")
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <MessageSquare size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">
                Exportar Pedidos a WhatsApp
              </h2>
              <p className="text-emerald-100 text-xs font-medium">
                Generá y compartí los pedidos de compra ordenados por proveedor con formato optimizado
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-8 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('by_provider')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-2xl transition-all flex items-center gap-2 ${
              activeTab === 'by_provider'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 size={15} />
            <span>Por Proveedor ({providerGroups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('single_order')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-2xl transition-all flex items-center gap-2 ${
              activeTab === 'single_order'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package size={15} />
            <span>Orden Individual</span>
          </button>

          <button
            onClick={() => setActiveTab('consolidated')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-2xl transition-all flex items-center gap-2 ${
              activeTab === 'consolidated'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck size={15} />
            <span>Resumen Consolidado ({orders.length} OCs)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* ========================================================================= */}
          {/* TAB 1: POR PROVEEDOR */}
          {/* ========================================================================= */}
          {activeTab === 'by_provider' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sidebar: Lista de Proveedores */}
              <div className="space-y-2 lg:border-r lg:border-slate-200 lg:pr-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Seleccioná Proveedor:
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {providerGroups.map(group => {
                    const isSelected = group.provName === currentProvGroup?.provName
                    return (
                      <button
                        key={group.provName}
                        onClick={() => setSelectedProv(group.provName)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase">
                            {group.provName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                            {group.orders.length} orden{group.orders.length > 1 ? 'es' : ''} asociada{group.orders.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronRight size={16} className={isSelected ? 'text-emerald-600' : 'text-slate-300'} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contenido: Vista Previa y Acciones */}
              {currentProvGroup && (
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">
                        {currentProvGroup.provName}
                      </h3>
                      {currentProvGroup.contacto ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 font-bold mt-0.5">
                          <Phone size={12} className="text-emerald-600" /> {currentProvGroup.contacto}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-0.5">Sin número de contacto registrado</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(formatMultiplePOsWhatsAppText(currentProvGroup.provName, currentProvGroup.orders), `prov-${currentProvGroup.provName}`)}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        {copiedKey === `prov-${currentProvGroup.provName}` ? (
                          <>
                            <Check size={14} className="text-emerald-600" />
                            <span className="text-emerald-700">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleSendWhatsApp(formatMultiplePOsWhatsAppText(currentProvGroup.provName, currentProvGroup.orders), currentProvGroup.contacto)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                      >
                        <Send size={14} />
                        <span>Enviar a WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Vista Previa del Mensaje */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Vista previa del mensaje formateado:
                    </label>
                    <pre className="bg-slate-900 text-emerald-400 p-5 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[380px] shadow-inner border border-slate-800">
                      {formatMultiplePOsWhatsAppText(currentProvGroup.provName, currentProvGroup.orders)}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ORDEN INDIVIDUAL */}
          {/* ========================================================================= */}
          {activeTab === 'single_order' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sidebar: Lista de Órdenes */}
              <div className="space-y-2 lg:border-r lg:border-slate-200 lg:pr-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Seleccioná Orden de Compra:
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {orders.map(o => {
                    const isSelected = o.id === selectedOrderId
                    const fecha = o.fecha_esperada ? new Date(o.fecha_esperada + 'T12:00:00').toLocaleDateString('es-AR') : 'S/F'
                    return (
                      <button
                        key={o.id}
                        onClick={() => setSelectedOrderId(o.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">
                            {o.proveedores?.nombre || 'Proveedor'}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                            Entrega: {fecha} · #{o.id.slice(0, 8)}
                          </p>
                        </div>
                        <ChevronRight size={16} className={isSelected ? 'text-emerald-600' : 'text-slate-300'} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contenido: Vista Previa y Acciones */}
              {currentOrder && (
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">
                        {currentOrder.proveedores?.nombre || 'Proveedor'} · OC #{currentOrder.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">
                        Entrega: {currentOrder.fecha_esperada ? new Date(currentOrder.fecha_esperada + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Sin fecha'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(formatPOWhatsAppText(currentOrder), `order-${currentOrder.id}`)}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        {copiedKey === `order-${currentOrder.id}` ? (
                          <>
                            <Check size={14} className="text-emerald-600" />
                            <span className="text-emerald-700">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleSendWhatsApp(formatPOWhatsAppText(currentOrder), currentOrder.proveedores?.contacto)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                      >
                        <Send size={14} />
                        <span>Enviar a WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Vista Previa del Mensaje */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Vista previa del mensaje:
                    </label>
                    <pre className="bg-slate-900 text-emerald-400 p-5 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[380px] shadow-inner border border-slate-800">
                      {formatPOWhatsAppText(currentOrder)}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: RESUMEN CONSOLIDADO */}
          {/* ========================================================================= */}
          {activeTab === 'consolidated' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">
                    Resumen General de Todas las Órdenes ({orders.length} OCs)
                  </h3>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    Ideal para enviar el cronograma completo de compras al equipo de cocina o logística
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(formatConsolidatedSummaryWhatsAppText(orders), 'consolidated')}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {copiedKey === 'consolidated' ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-emerald-700">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleSendWhatsApp(formatConsolidatedSummaryWhatsAppText(orders))}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                  >
                    <Send size={14} />
                    <span>Enviar a WhatsApp</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Vista previa del consolidado:
                </label>
                <pre className="bg-slate-900 text-emerald-400 p-5 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[380px] shadow-inner border border-slate-800">
                  {formatConsolidatedSummaryWhatsAppText(orders)}
                </pre>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="font-bold">
            Total Órdenes: <strong className="text-slate-900">{orders.length}</strong> · Proveedores: <strong className="text-slate-900">{providerGroups.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-black uppercase tracking-wider transition-colors text-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
