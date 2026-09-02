"use client"

import React, { useState, useMemo } from 'react'
import { 
  Store, ShoppingCart, Users, Plus, Copy, ExternalLink, ToggleLeft, ToggleRight, 
  Search, Filter, Trash2, Edit3, Link as LinkIcon, Eye, Calendar, DollarSign, 
  TrendingUp, CheckCircle, Clock, XCircle, Package, ChevronDown, Loader2, AlertCircle,
  Ban, Mail, RefreshCw, ArrowRight, Zap, Building2, Check, Bus
} from 'lucide-react'
import { 
  autoSyncStoresForConfirmedEventsAction,
  toggleStoreActiveAction, 
  deleteStoreEventAction, 
  cancelOnlineOrderAction, 
  cancelAllPendingOrdersAction 
} from '@/app/actions/online-sales'
import StoreConfigModal from './StoreConfigModal'
import StoreEditModal from './StoreEditModal'
import { Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  initialStores: any[]
  initialOrders: any[]
  initialEvents: any[]
  rules?: any[]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

export default function OnlineSalesDashboard({ initialStores, initialOrders, initialEvents, rules = [] }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'tiendas' | 'pedidos' | 'clientes'>('pedidos')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<any | null>(null)
  
  // Filters for Pedidos
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEventFilter, setSelectedEventFilter] = useState('ALL')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('ALL')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL')
  
  const [storesList, setStoresList] = useState(initialStores)
  const [storeViewFilter, setStoreViewFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL')

  React.useEffect(() => {
    setStoresList(initialStores)
    setOrdersList(initialOrders)
  }, [initialStores, initialOrders])
  const [ordersList, setOrdersList] = useState(initialOrders)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [isSyncingStores, setIsSyncingStores] = useState(false)

  const handleSyncStores = async () => {
    setIsSyncingStores(true)
    try {
      await autoSyncStoresForConfirmedEventsAction()
      router.refresh()
    } catch (e) {
      console.error("Error syncing stores:", e)
    } finally {
      setIsSyncingStores(false)
    }
  }


  // Helper to determine if a store is currently open and accepting orders
  const isStoreAcceptingOrders = (s: any) => {
    if (s.is_active === false) return false
    if (s.sales_deadline) {
      const deadline = new Date(s.sales_deadline)
      const now = new Date()
      if (now > deadline) return false
    }
    return true
  }

  // 1. Tiendas Abiertas: ordenadas de más próxima a más lejana en el futuro (ASC)
  const activeStores = useMemo(() => {
    return storesList
      .filter(s => isStoreAcceptingOrders(s))
      .sort((a, b) => {
        const dateA = a.events_master?.event_date || a.available_dates?.[0] || '9999-12-31'
        const dateB = b.events_master?.event_date || b.available_dates?.[0] || '9999-12-31'
        return dateA.localeCompare(dateB)
      })
  }, [storesList])

  // 2. Tiendas Cerradas/Pausadas: ordenadas de más recientes a más viejas (DESC)
  const pausedStores = useMemo(() => {
    return storesList
      .filter(s => !isStoreAcceptingOrders(s))
      .sort((a, b) => {
        const dateA = a.events_master?.event_date || a.available_dates?.[0] || '0000-00-00'
        const dateB = b.events_master?.event_date || b.available_dates?.[0] || '0000-00-00'
        return dateB.localeCompare(dateA) // DESC
      })
  }, [storesList])

  // 3. Todas: Abiertas primero (ASC) seguidas de Cerradas (DESC)
  const sortedStores = useMemo(() => {
    return [...activeStores, ...pausedStores]
  }, [activeStores, pausedStores])
  
  const displayedStores = useMemo(() => {
    if (storeViewFilter === 'ACTIVE') return activeStores
    if (storeViewFilter === 'PAUSED') return pausedStores
    return sortedStores
  }, [storeViewFilter, activeStores, pausedStores, sortedStores])

  // Extract unique events from stores
  const uniqueEvents = useMemo(() => {
    const map = new Map<string, { id: string; name: string; date: string }>()
    initialStores.forEach(s => {
      const ev = s.events_master
      if (ev && !map.has(ev.id)) {
        map.set(ev.id, {
          id: ev.id,
          name: ev.show_name || s.title,
          date: ev.event_date || s.available_dates?.[0] || ''
        })
      }
    })
    return Array.from(map.values())
  }, [initialStores])

  // Extract unique companies from stores
  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>()
    initialStores.forEach(s => {
      const title = s.title || ''
      const parts = title.split('—').map((x: string) => x.trim())
      const comp = parts.length > 1 ? parts[1] : title.split('-').pop()?.trim()
      if (comp) set.add(comp)
    })
    return Array.from(set).sort()
  }, [initialStores])

  // Derive unique unified passengers (deduplicating by phone and email)
  const customers = useMemo(() => {
    const unifiedMap = new Map<string, {
      id: string
      full_name: string
      emails: Set<string>
      phones: Set<string>
      primaryEmail: string
      primaryPhone: string
      paidOrdersCount: number
      totalSpent: number
      orderIds: Set<string>
    }>()

    ordersList.forEach(order => {
      const cust = order.online_customers
      const rawEmail = (cust?.email || '').trim().toLowerCase()
      const rawPhone = (cust?.phone || '').replace(/\D/g, '') // numbers only
      const fullName = (cust?.full_name || 'Pasajero').trim()

      if (!rawEmail && !rawPhone && !cust) return

      // Find existing record by matching email OR phone
      let matchKey: string | null = null

      for (const [key, record] of Array.from(unifiedMap.entries())) {
        const matchesEmail = rawEmail && record.emails.has(rawEmail)
        const matchesPhone = rawPhone && rawPhone.length >= 8 && record.phones.has(rawPhone)
        if (matchesEmail || matchesPhone) {
          matchKey = key
          break
        }
      }

      const isPaid = order.status === 'paid'
      const amount = Number(order.total_amount) || 0

      if (matchKey) {
        const existing = unifiedMap.get(matchKey)!
        if (rawEmail) existing.emails.add(rawEmail)
        if (rawPhone) existing.phones.add(rawPhone)
        if (cust?.phone && cust.phone.length > 5) existing.primaryPhone = cust.phone
        if (fullName && fullName.length > existing.full_name.length) existing.full_name = fullName
        
        if (!existing.orderIds.has(order.id)) {
          existing.orderIds.add(order.id)
          if (isPaid) {
            existing.paidOrdersCount += 1
            existing.totalSpent += amount
          }
        }
      } else {
        const newKey = rawPhone && rawPhone.length >= 8 ? `phone-${rawPhone}` : `email-${rawEmail}`
        const newRecord = {
          id: cust?.id || order.id,
          full_name: fullName,
          emails: new Set(rawEmail ? [rawEmail] : []),
          phones: new Set(rawPhone ? [rawPhone] : []),
          primaryEmail: cust?.email || rawEmail,
          primaryPhone: cust?.phone || (rawPhone || '-'),
          paidOrdersCount: isPaid ? 1 : 0,
          totalSpent: isPaid ? amount : 0,
          orderIds: new Set([order.id])
        }
        unifiedMap.set(newKey, newRecord)
      }
    })

    return Array.from(unifiedMap.values()).map(c => ({
      id: c.id,
      full_name: c.full_name,
      email: Array.from(c.emails).join(', ') || c.primaryEmail,
      phone: c.primaryPhone || Array.from(c.phones).join(', ') || '-',
      paidOrdersCount: c.paidOrdersCount,
      totalSpent: c.totalSpent
    }))
  }, [ordersList])

  const paidOrdersTotalCount = useMemo(() => {
    return ordersList.filter(o => o.status === 'paid').length
  }, [ordersList])

  // Helper to extract company from store title
  const getStoreCompany = (storeTitle?: string) => {
    if (!storeTitle) return ''
    const parts = storeTitle.split('—').map(s => s.trim())
    return parts.length > 1 ? parts[1] : storeTitle.split('-').pop()?.trim() || storeTitle
  }

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return ordersList.filter(order => {
      // 1. Search term
      const matchesSearch = searchTerm === '' || 
        order.online_customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.online_customers?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.online_store_events?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.bus_identifier?.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchesSearch) return false

      // 2. Event filter
      if (selectedEventFilter !== 'ALL') {
        if (order.online_store_events?.event_master_id !== selectedEventFilter && 
            order.online_store_events?.events_master?.id !== selectedEventFilter) {
          return false
        }
      }

      // 3. Company filter
      if (selectedCompanyFilter !== 'ALL') {
        const comp = getStoreCompany(order.online_store_events?.title)
        if (!comp.toLowerCase().includes(selectedCompanyFilter.toLowerCase())) {
          return false
        }
      }

      // 4. Status filter
      if (selectedStatusFilter !== 'ALL') {
        if (order.status !== selectedStatusFilter) {
          return false
        }
      }

      return true
    })
  }, [ordersList, searchTerm, selectedEventFilter, selectedCompanyFilter, selectedStatusFilter])

  // Dynamic Combo Production Scorecards (calculated from filtered orders or paid subset)
  const productionMetrics = useMemo(() => {
    // We calculate production metrics from paid orders (or all filtered if selected)
    const targetOrders = filteredOrders.filter(o => o.status === 'paid')
    
    let trad = 0
    let veg = 0
    let stacc = 0
    let vegan = 0
    let totalRevenue = 0

    targetOrders.forEach(o => {
      trad += Number(o.qty_tradicional) || 0
      veg += Number(o.qty_vegetariano) || 0
      stacc += Number(o.qty_sintacc) || 0
      vegan += Number(o.qty_vegano) || 0
      totalRevenue += Number(o.total_amount) || 0
    })

    const totalViandas = trad + veg + stacc + vegan
    const totalWaters = totalViandas // 1 bottle per combo

    return {
      trad,
      veg,
      stacc,
      vegan,
      totalViandas,
      totalWaters,
      totalRevenue,
      paidCount: targetOrders.length,
      pendingCount: filteredOrders.filter(o => o.status === 'pending_payment').length
    }
  }, [filteredOrders])

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/tienda/${slug}`
    navigator.clipboard.writeText(url)
  }

  const handleToggleStore = async (id: string, currentStatus: boolean) => {
    setLoadingAction(`toggle-${id}`)
    const newStatus = !currentStatus
    setStoresList(prev => prev.map(s => s.id === id ? { ...s, is_active: newStatus } : s))
    await toggleStoreActiveAction(id, newStatus)
    router.refresh()
    setLoadingAction(null)
  }

  const handleDeleteStore = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta tienda?")) {
      setLoadingAction(`delete-${id}`)
      setStoresList(prev => prev.filter(s => s.id !== id))
      await deleteStoreEventAction(id)
      router.refresh()
      setLoadingAction(null)
    }
  }

  const handleCancelSingleOrder = async (orderId: string, customerEmail?: string) => {
    if (!confirm(`¿Estás seguro de que deseas cancelar este pedido?${customerEmail ? ` Se registrará la cancelación para ${customerEmail}.` : ''}`)) {
      return
    }

    setCancellingId(orderId)
    const res = await cancelOnlineOrderAction(orderId)
    if (res.success) {
      setOrdersList(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
    } else {
      alert("Error al cancelar el pedido: " + (res.error || 'Error desconocido'))
    }
    setCancellingId(null)
  }

  const handleCancelAllPending = async () => {
    const pendingCount = ordersList.filter(o => o.status === 'pending_payment').length
    if (pendingCount === 0) {
      alert("No hay pedidos pendientes para cancelar.")
      return
    }

    if (!confirm(`¿Deseas cancelar los ${pendingCount} pedidos pendientes de pago en cola?`)) {
      return
    }

    setCancellingId("all")
    const res = await cancelAllPendingOrdersAction()
    if (res.success) {
      setOrdersList(prev => prev.map(o => o.status === 'pending_payment' ? { ...o, status: 'cancelled' } : o))
      alert(`¡Se cancelaron ${res.count} pedidos pendientes con éxito!`)
    } else {
      alert("Error al cancelar los pedidos pendientes: " + (res.error || 'Error desconocido'))
    }
    setCancellingId(null)
  }

  const renderTiendas = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold uppercase italic text-slate-800">Mis Tiendas Online</h2>
          <p className="text-xs text-slate-500 mt-0.5">Control de tiendas, estados y pedidos por evento.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Active vs Paused Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-black uppercase">
            <button
              type="button"
              onClick={() => setStoreViewFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${storeViewFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Todas ({sortedStores.length})
            </button>
            <button
              type="button"
              onClick={() => setStoreViewFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${storeViewFilter === 'ACTIVE' ? 'bg-emerald-500 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-800'}`}
            >
              🟢 Abiertas ({activeStores.length})
            </button>
            <button
              type="button"
              onClick={() => setStoreViewFilter('PAUSED')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${storeViewFilter === 'PAUSED' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:text-amber-800'}`}
            >
              ⏸️ Cerradas / Pausadas ({pausedStores.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleSyncStores}
              disabled={isSyncingStores}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-2xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-slate-200"
              title="Sincronizar automáticamente tiendas para todos los eventos confirmados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingStores ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden md:inline">Sincronizar Tiendas</span>
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors shadow-md cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Nueva Tienda
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displayedStores.map(store => {
          const storeOrders = ordersList.filter(o => o.store_event_id === store.id)
          const paidOrders = storeOrders.filter(o => o.status === 'paid')
          const pendingOrders = storeOrders.filter(o => o.status === 'pending_payment')
          const revenue = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

          const isLoadingToggle = loadingAction === `toggle-${store.id}`
          const isLoadingDelete = loadingAction === `delete-${store.id}`

          const eventDateStr = store.events_master?.event_date || store.available_dates?.[0]
          const companyName = getStoreCompany(store.title)

          return (
            <div key={store.id} className={`rounded-[2.5rem] p-6 shadow-lg flex flex-col h-full relative overflow-hidden group transition-all ${isStoreAcceptingOrders(store) ? 'bg-white border border-slate-100' : 'bg-slate-50/90 border-2 border-amber-200/80'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black uppercase italic tracking-tight text-xl text-slate-900 leading-tight">
                    {store.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg inline-flex border border-slate-200">
                      <Calendar className="w-3.5 h-3.5" />
                      {eventDateStr ? new Date(eventDateStr + 'T12:00:00').toLocaleDateString('es-AR') : 'Sin fecha'}
                    </div>
                    {(() => {
                      const isDeadlinePassed = store.sales_deadline ? new Date() > new Date(store.sales_deadline) : false
                      if (isDeadlinePassed) {
                        const dl = new Date(store.sales_deadline)
                        const timeStr = dl.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })
                        return (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 uppercase tracking-wider flex items-center gap-1" title="El horario límite configurado ha finalizado">
                            ⏰ Cerrada ({timeStr} hs)
                          </span>
                        )
                      }
                      if (!store.is_active) {
                        return (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 uppercase tracking-wider" title="Pausada manualmente por el operador">
                            ⏸️ Pausada
                          </span>
                        )
                      }
                      return (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 uppercase tracking-wider" title="Abierta recibiendo pedidos">
                          🟢 Activa
                        </span>
                      )
                    })()}
                  </div>
                </div>
                
                <button
                  onClick={() => handleToggleStore(store.id, store.is_active)}
                  disabled={isLoadingToggle}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${store.is_active ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-200'}`}
                  title={store.is_active ? "Desactivar tienda" : "Activar tienda"}
                >
                  {isLoadingToggle ? <Loader2 className="w-6 h-6 animate-spin" /> : store.is_active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              <div className="flex-1 space-y-4">
                {/* Link Box */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl flex-1 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-700 truncate">/tienda/{store.slug}</span>
                    <button onClick={() => handleCopyLink(store.slug)} className="text-indigo-500 hover:text-indigo-700 ml-auto cursor-pointer p-1 hover:bg-indigo-50 rounded" title="Copiar link">
                      <Copy className="w-4 h-4" />
                    </button>
                    <a href={`/tienda/${store.slug}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg" title="Abrir tienda">
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Orders metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" /> Pagados
                    </div>
                    <div className="text-xl font-black text-slate-800">{paidOrders.length}</div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" /> Pendientes
                    </div>
                    <div className="text-xl font-black text-slate-800">{pendingOrders.length}</div>
                  </div>
                </div>

                {/* Quick Action: View Orders for this Store */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventFilter(store.event_master_id || 'ALL')
                    setSelectedCompanyFilter(companyName || 'ALL')
                    setSelectedStatusFilter('paid')
                    setActiveTab('pedidos')
                  }}
                  className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Filtrar la tabla de pedidos para ver solo las ventas pagadas de este evento"
                >
                  <ShoppingCart size={14} className="text-indigo-600" />
                  <span>Ver Pedidos ({paidOrders.length} Pagados)</span>
                </button>

                {/* Coordinator Control Panel Link */}
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/tienda/${store.slug}/coordinador`}
                    target="_blank"
                    className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-xs"
                    title="Abrir el Tablero de Control del Coordinador (Pedidos, Lista de Pasajeros y Check-in GPS)"
                  >
                    <Bus size={13} className="text-emerald-600" />
                    <span>🧭 Tablero Coordinador</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const coordUrl = `${window.location.origin}/tienda/${store.slug}/coordinador`
                      navigator.clipboard.writeText(coordUrl)
                      alert("¡Link del Tablero de Coordinador copiado al portapapeles! Listo para enviar por WhatsApp.")
                    }}
                    className="py-2.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center transition cursor-pointer"
                    title="Copiar link del coordinador para enviar por WhatsApp"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {/* Settings & Transfer */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStore(store)}
                    className="w-full py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Settings size={13} />
                    <span>⚙️ Stock / Cierre</span>
                  </button>
                  <Link
                    href={`/ventas-evento?eventId=${store.event_master_id}&company=${encodeURIComponent(companyName)}&fromOnline=true`}
                    className="w-full py-2 px-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition"
                    title="Cerrar y enviar pedidos a Ventas por Evento para facturación y remitos"
                  >
                    <Zap size={13} />
                    <span>Transferir</span>
                  </Link>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Recaudación Pagada</div>
                  <div className="text-lg font-black text-emerald-600">{formatCurrency(revenue)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteStore(store.id)}
                  disabled={loadingAction === `delete-${store.id}`}
                  className="p-2 text-slate-300 hover:text-rose-500 rounded-xl transition-colors cursor-pointer hover:bg-rose-50"
                  title="Eliminar tienda permanentemente"
                >
                  {loadingAction === `delete-${store.id}` ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )
        })}

        {sortedStores.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
            <Store className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-lg font-medium">No hay tiendas creadas aún</p>
            <p className="text-sm mt-1">Crea tu primera tienda para empezar a vender.</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderPedidos = () => {
    return (
      <div className="space-y-6">

        {/* 1. FILTERS BAR (Evento, Empresa, Estado, Buscador) */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-800">
              <Filter className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-wider">Filtrar Pedidos</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1 lg:max-w-4xl">
              {/* Event Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Evento</label>
                <select
                  value={selectedEventFilter}
                  onChange={e => setSelectedEventFilter(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todos los Eventos ({uniqueEvents.length})</option>
                  {uniqueEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Empresa</label>
                <select
                  value={selectedCompanyFilter}
                  onChange={e => setSelectedCompanyFilter(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todas las Empresas ({uniqueCompanies.length})</option>
                  {uniqueCompanies.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Estado de Pago</label>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="paid">✅ Pagados</option>
                  <option value="pending_payment">⏳ Pendientes</option>
                  <option value="cancelled">❌ Cancelados</option>
                </select>
              </div>

              {/* Text Search */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Buscar</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cliente, mail, micro..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. DYNAMIC COMBO SCORECARDS (Cotejo vs Producción) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-md flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">🥪 Tradicional</span>
            <div className="text-2xl font-black mt-2 text-white">{productionMetrics.trad} <span className="text-xs font-normal text-slate-400">un.</span></div>
          </div>

          <div className="bg-emerald-950 text-white rounded-3xl p-4 shadow-md border border-emerald-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">🥗 Vegetariano</span>
            <div className="text-2xl font-black mt-2 text-emerald-300">{productionMetrics.veg} <span className="text-xs font-normal text-emerald-400/70">un.</span></div>
          </div>

          <div className="bg-amber-950 text-white rounded-3xl p-4 shadow-md border border-amber-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">🌾 Sin TACC</span>
            <div className="text-2xl font-black mt-2 text-amber-300">{productionMetrics.stacc} <span className="text-xs font-normal text-amber-400/70">un.</span></div>
          </div>

          <div className="bg-teal-950 text-white rounded-3xl p-4 shadow-md border border-teal-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">🌱 Vegano</span>
            <div className="text-2xl font-black mt-2 text-teal-300">{productionMetrics.vegan} <span className="text-xs font-normal text-teal-400/70">un.</span></div>
          </div>

          <div className="bg-blue-950 text-white rounded-3xl p-4 shadow-md border border-blue-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">💧 Aguas Minerales</span>
            <div className="text-2xl font-black mt-2 text-blue-300">{productionMetrics.totalWaters} <span className="text-xs font-normal text-blue-400/70">un.</span></div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-4 shadow-md border border-indigo-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">📦 Total Viandas</span>
            <div className="text-2xl font-black mt-2 text-white">{productionMetrics.totalViandas} <span className="text-xs font-normal text-indigo-300">un.</span></div>
          </div>
        </div>

        {/* Global Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedidos Pagados</p>
                <p className="text-xl font-black text-slate-800">{productionMetrics.paidCount}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recaudación Filtrada</p>
              <p className="text-lg font-black text-emerald-600">{formatCurrency(productionMetrics.totalRevenue)}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedidos Pendientes</p>
                <p className="text-xl font-black text-slate-800">{productionMetrics.pendingCount}</p>
              </div>
            </div>
            {productionMetrics.pendingCount > 0 && (
              <button
                type="button"
                onClick={handleCancelAllPending}
                disabled={cancellingId !== null}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Ban size={12} /> Limpiar ({productionMetrics.pendingCount})
              </button>
            )}
          </div>

          {/* Quick link to Ventas por Evento if an event or company is selected */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Integración de Ventas</p>
              <p className="text-xs font-bold text-slate-200 mt-0.5">Liquidación y Facturación</p>
            </div>
            <Link
              href={
                selectedEventFilter !== 'ALL' && selectedCompanyFilter !== 'ALL'
                  ? `/ventas-evento?eventId=${selectedEventFilter}&company=${encodeURIComponent(selectedCompanyFilter)}&fromOnline=true`
                  : selectedEventFilter !== 'ALL'
                  ? `/ventas-evento?eventId=${selectedEventFilter}&fromOnline=true`
                  : `/ventas-evento`
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition shadow-sm"
            >
              <Zap size={13} />
              <span>Abrir Ventas Evento</span>
            </Link>
          </div>
        </div>

        {/* 3. ORDERS TABLE */}
        <div className="bg-white rounded-[2.5rem] shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
            <h2 className="text-xl font-bold uppercase italic text-slate-800">
              Pedidos Detallados ({filteredOrders.length})
            </h2>

            <div className="text-xs font-bold text-slate-500">
              Mostrando {filteredOrders.length} de {ordersList.length} pedidos
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500 font-bold">
                  <th className="px-6 py-4 whitespace-nowrap">Fecha</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Evento / Tienda</th>
                  <th className="px-6 py-4">Viaje / Micro</th>
                  <th className="px-6 py-4 text-center">Combos</th>
                  <th className="px-6 py-4 whitespace-nowrap">Total</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrders.map(order => {
                  const combos = []
                  if (order.qty_tradicional > 0) combos.push(`${order.qty_tradicional} TRAD`)
                  if (order.qty_vegetariano > 0) combos.push(`${order.qty_vegetariano} VEG`)
                  if (order.qty_sintacc > 0) combos.push(`${order.qty_sintacc} STACC`)
                  if (order.qty_vegano > 0) combos.push(`${order.qty_vegano} VEGAN`)

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                        {new Date(order.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{order.online_customers?.full_name || 'Desconocido'}</div>
                        <div className="text-xs text-slate-500">{order.online_customers?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700">{order.online_store_events?.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-700">{order.travel_date ? new Date(order.travel_date + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</div>
                        {order.bus_identifier && <div className="text-xs text-indigo-600 font-bold">Micro: {order.bus_identifier}</div>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-wrap gap-1 justify-center max-w-[120px]">
                          {combos.map((c, i) => (
                            <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800 whitespace-nowrap">
                        {formatCurrency(Number(order.total_amount))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {order.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            Pagado
                          </span>
                        ) : order.status === 'pending_payment' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            Pendiente
                          </span>
                        ) : order.status === 'refunded' ? (
                          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            Reembolsado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            Cancelado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {order.status === 'pending_payment' ? (
                          <button
                            type="button"
                            onClick={() => handleCancelSingleOrder(order.id, order.online_customers?.email)}
                            disabled={cancellingId === order.id}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ml-auto"
                            title="Cancelar este pedido pendiente"
                          >
                            <Ban size={12} />
                            <span>Cancelar</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No se encontraron pedidos con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderClientes = () => {
    const filteredCustomers = customers.filter(c => 
      searchTerm === '' || 
      c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xl font-bold uppercase italic text-slate-800">Base de Clientes (CRM Pasajeros)</h2>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-64 shadow-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500 font-bold">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Teléfono</th>
                  <th className="px-6 py-4 text-center">Total Pedidos</th>
                  <th className="px-6 py-4 text-right">Total Gastado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCustomers.map(customer => {
                  const totalSpent = customer.totalSpent || 0
                  const paidCount = customer.paidOrdersCount || 0

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {customer.full_name || 'Desconocido'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {customer.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-600">
                        {paidCount}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">
                        {formatCurrency(totalSpent)}
                      </td>
                    </tr>
                  )
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No se encontraron clientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">
            Ventas Online (Pasajeros)
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Gestiona las tiendas de cada evento, monitorea los pedidos en tiempo real y coteja producción de combos.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 p-1.5 rounded-full flex gap-1 shadow-inner">
          <button
            onClick={() => { setActiveTab('tiendas'); setSearchTerm('') }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'tiendas' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" /> Tiendas ({sortedStores.length})
          </button>
          <button
            onClick={() => { setActiveTab('pedidos'); setSearchTerm('') }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'pedidos' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" /> Pedidos ({paidOrdersTotalCount})
          </button>
          <button
            onClick={() => { setActiveTab('clientes'); setSearchTerm('') }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'clientes' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Clientes ({customers.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'tiendas' && renderTiendas()}
        {activeTab === 'pedidos' && renderPedidos()}
        {activeTab === 'clientes' && renderClientes()}
      </div>

      {/* Store Config Modal */}
      {isModalOpen && (
        <StoreConfigModal
          events={initialEvents}
          onClose={() => setIsModalOpen(false)}
          onCreated={() => {
            setIsModalOpen(false)
            router.refresh()
          }}
        />
      )}

      {/* Store Edit / Stock & Closing Modal */}
      {editingStore && (
        <StoreEditModal
          store={editingStore}
          onClose={() => setEditingStore(null)}
          onUpdated={(updatedStore) => {
            if (updatedStore) {
              setStoresList(prev => prev.map(s => s.id === updatedStore.id ? { ...s, ...updatedStore } : s))
            }
            setEditingStore(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
