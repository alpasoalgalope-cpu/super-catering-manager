"use client"

import React, { useState, useMemo } from 'react'
import { 
  Store, ShoppingCart, Users, Plus, Copy, ExternalLink, ToggleLeft, ToggleRight, 
  Search, Filter, Trash2, Edit3, Link as LinkIcon, Eye, Calendar, DollarSign, 
  TrendingUp, CheckCircle, Clock, XCircle, Package, ChevronDown, Loader2, AlertCircle,
  Ban, Mail, RefreshCw, ArrowRight, Zap, Building2, Check, Bus, X, FileSpreadsheet, Download,
  ArrowRightLeft
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { 
  autoSyncStoresForConfirmedEventsAction,
  toggleStoreActiveAction, 
  deleteStoreEventAction, 
  cancelOnlineOrderAction, 
  cancelAllPendingOrdersAction,
  moveOnlineOrderBusAction,
  bulkMoveOnlineOrdersBusAction,
  resendOrderEmailAction,
  manuallyApproveOnlineOrderAction,
  sendFirstCutProductionEmailAction
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

// Helper to extract company from store title
export const getStoreCompany = (storeTitle?: string) => {
  if (!storeTitle) return ''
  const parts = storeTitle.split('—').map(s => s.trim())
  return parts.length > 1 ? parts[1] : storeTitle.split('-').pop()?.trim() || storeTitle
}

export default function OnlineSalesDashboard({ initialStores, initialOrders, initialEvents, rules = [] }: Props) {
  const [userRole, setUserRole] = useState<string>('admin')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'tiendas' | 'pedidos' | 'clientes'>('pedidos')

  React.useEffect(() => {
    async function loadRole() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (user?.email === 'alpaso.algalope@gmail.com' || user?.email === 'cocina@supercatering.com') {
          setUserRole('cocina')
        } else {
          setUserRole(user?.app_metadata?.role || user?.user_metadata?.role || 'admin')
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadRole()
  }, [])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<any | null>(null)
  
  // Filters for Pedidos
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrderDateFilter, setSelectedOrderDateFilter] = useState('ALL')
  const [selectedEventFilter, setSelectedEventFilter] = useState('ALL')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('ALL')
  const [selectedCoordinatorFilter, setSelectedCoordinatorFilter] = useState('ALL')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL')
  const [bulkMoving, setBulkMoving] = useState<boolean>(false)
  
  // Filters for Tiendas
  const [storesList, setStoresList] = useState(initialStores)
  const [storeViewFilter, setStoreViewFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL')
  const [storeDateFilter, setStoreDateFilter] = useState<string>('ALL')
  const [storeCompanyFilter, setStoreCompanyFilter] = useState<string>('ALL')
  const [storeSearchTerm, setStoreSearchTerm] = useState<string>('')

  React.useEffect(() => {
    setStoresList(initialStores)
    setOrdersList(initialOrders)
  }, [initialStores, initialOrders])
  const [ordersList, setOrdersList] = useState(initialOrders)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [isSyncingStores, setIsSyncingStores] = useState(false)
  const [movingOrder, setMovingOrder] = useState<any | null>(null)
  const [targetBusInput, setTargetBusInput] = useState<string>('')
  const [isMovingOrder, setIsMovingOrder] = useState(false)

  const handleMoveOrder = async () => {
    if (!movingOrder) return
    setIsMovingOrder(true)
    try {
      const res = await moveOnlineOrderBusAction({
        orderId: movingOrder.id,
        newBusIdentifier: targetBusInput.trim()
      })
      if (res.success) {
        setOrdersList(prev => prev.map(o => o.id === movingOrder.id ? { ...o, bus_identifier: targetBusInput.trim() || null } : o))
        setMovingOrder(null)
      } else {
        alert("Error al mover el pedido: " + res.error)
      }
    } catch (e: any) {
      console.error("Error moving order:", e)
      alert("Error al mover el pedido: " + (e.message || 'Error desconocido'))
    } finally {
      setIsMovingOrder(false)
    }
  }

  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const handleManuallyApproveOrder = async (orderId: string, customerEmail?: string) => {
    if (!confirm(`¿Confirmás que querés aprobar el pago para ${customerEmail || 'el cliente'} y enviarle el comprobante oficial por correo?`)) {
      return
    }
    setApprovingId(orderId)
    try {
      const res = await manuallyApproveOnlineOrderAction(orderId)
      if (res.success) {
        setOrdersList(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid', mp_status: 'approved' } : o))
        alert(`¡Pago aprobado exitosamente! Se envió el correo de confirmación a ${customerEmail || 'el cliente'}.`)
      } else {
        alert("Error al aprobar el pago: " + (res.error || 'Error desconocido'))
      }
    } catch (e: any) {
      console.error("Error approving order:", e)
      alert("Error al aprobar el pago: " + (e.message || 'Error desconocido'))
    } finally {
      setApprovingId(null)
    }
  }

  const handleResendEmail = async (orderId: string, customerEmail?: string) => {
    setResendingEmailId(orderId)
    try {
      const res = await resendOrderEmailAction({ orderId })
      if (res.success) {
        alert(`¡Correo de confirmación enviado exitosamente a ${customerEmail || 'el cliente'}!`)
      } else {
        alert("No se pudo enviar el correo: " + ((res as any)?.error || 'Error desconocido'))
      }
    } catch (e: any) {
      console.error("Error resending email:", e)
      alert("Error: " + (e.message || 'Error al reenviar'))
    } finally {
      setResendingEmailId(null)
    }
  }

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
  
  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>()
    initialStores.forEach(s => {
      const title = s.title || ''
      // Support em-dash (—), en-dash (–), and hyphen (-)
      const parts = title.split(/[—–-]/).map((x: string) => x.trim())
      if (parts.length > 1) {
        const comp = parts[parts.length - 1]
        if (comp) set.add(comp)
      } else {
        const comp = getStoreCompany(title)
        if (comp) set.add(comp)
      }
    })
    return Array.from(set).filter(Boolean).sort()
  }, [initialStores])

  // Extract unique dates for stores (sorted closest future -> furthest, then past DESC)
  const uniqueStoreDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const dateCounts = new Map<string, number>()

    const allStores = storesList && storesList.length > 0 ? storesList : initialStores
    allStores.forEach(s => {
      const dates = s.available_dates && s.available_dates.length > 0
        ? s.available_dates
        : s.events_master?.event_date
        ? [s.events_master.event_date]
        : []

      dates.forEach((d: string) => {
        if (d) {
          dateCounts.set(d, (dateCounts.get(d) || 0) + 1)
        }
      })
    })

    const dateList = Array.from(dateCounts.entries()).map(([date, count]) => {
      let formatted = date
      try {
        const [y, m, d] = date.split('-')
        if (y && m && d) formatted = `${d}/${m}/${y}`
      } catch (e) {}

      return {
        date,
        formatted,
        count
      }
    })

    const upcoming = dateList
      .filter(item => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))

    const past = dateList
      .filter(item => item.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))

    return [...upcoming, ...past]
  }, [storesList, initialStores])

  const displayedStores = useMemo(() => {
    let baseList = sortedStores
    if (storeViewFilter === 'ACTIVE') baseList = activeStores
    if (storeViewFilter === 'PAUSED') baseList = pausedStores

    return baseList.filter(s => {
      // 1. Company Filter
      if (storeCompanyFilter !== 'ALL') {
        const titleLower = (s.title || '').toLowerCase()
        const slugLower = (s.slug || '').toLowerCase()
        const compLower = storeCompanyFilter.toLowerCase()
        if (!titleLower.includes(compLower) && !slugLower.includes(compLower)) {
          return false
        }
      }

      // 2. Date Filter
      if (storeDateFilter !== 'ALL') {
        const sDates = s.available_dates && s.available_dates.length > 0
          ? s.available_dates
          : s.events_master?.event_date
          ? [s.events_master.event_date]
          : []
        if (!sDates.includes(storeDateFilter)) {
          return false
        }
      }

      // 3. Search Term Filter
      if (storeSearchTerm.trim() !== '') {
        const query = storeSearchTerm.toLowerCase().trim()
        const titleMatch = (s.title || '').toLowerCase().includes(query)
        const slugMatch = (s.slug || '').toLowerCase().includes(query)
        const showMatch = (s.events_master?.show_name || '').toLowerCase().includes(query)
        if (!titleMatch && !slugMatch && !showMatch) {
          return false
        }
      }

      return true
    })
  }, [storeViewFilter, storeCompanyFilter, storeDateFilter, storeSearchTerm, activeStores, pausedStores, sortedStores])

  // Extract unique events from stores and orders, sorted from closest to furthest (upcoming ASC, past DESC)
  const uniqueEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const map = new Map<string, { id: string; name: string; date: string }>()

    const allStores = storesList && storesList.length > 0 ? storesList : initialStores
    allStores.forEach(s => {
      const ev = s.events_master
      if (ev && !map.has(ev.id)) {
        map.set(ev.id, {
          id: ev.id,
          name: ev.show_name || s.title,
          date: ev.event_date || s.available_dates?.[0] || ''
        })
      }
    })

    // Also include any events referenced in orders
    ordersList.forEach(o => {
      const ev = o.online_store_events?.events_master
      const evId = ev?.id || o.online_store_events?.event_master_id
      if (evId && !map.has(evId)) {
        map.set(evId, {
          id: evId,
          name: ev?.show_name || o.online_store_events?.title || 'Evento',
          date: ev?.event_date || o.travel_date || ''
        })
      }
    })

    const list = Array.from(map.values())

    const upcoming = list
      .filter(ev => !ev.date || ev.date >= today)
      .sort((a, b) => {
        const dA = a.date || '9999-12-31'
        const dB = b.date || '9999-12-31'
        return dA.localeCompare(dB)
      })

    const past = list
      .filter(ev => ev.date && ev.date < today)
      .sort((a, b) => {
        return b.date.localeCompare(a.date) // Most recent past first
      })

    return [...upcoming, ...past]
  }, [storesList, initialStores, ordersList])

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


  // Extract unique travel dates from orders (sorted closest upcoming -> furthest, then past DESC)
  const uniqueOrderDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const dateCounts = new Map<string, number>()

    ordersList.forEach(o => {
      const rawDate = (o.travel_date || o.online_store_events?.events_master?.event_date || '').split('T')[0]
      if (rawDate) {
        dateCounts.set(rawDate, (dateCounts.get(rawDate) || 0) + 1)
      }
    })

    const dateList = Array.from(dateCounts.entries()).map(([date, count]) => {
      let formatted = date
      try {
        const [y, m, d] = date.split('-')
        if (y && m && d) formatted = `${Number(d)}/${Number(m)}/${y}`
      } catch (e) {}

      return {
        date,
        formatted,
        count
      }
    })

    const upcoming = dateList
      .filter(item => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))

    const past = dateList
      .filter(item => item.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))

    return [...upcoming, ...past]
  }, [ordersList])

  // Extract unique coordinators / buses based on selected date, event & company
  const uniqueCoordinators = useMemo(() => {
    let pool = ordersList
    if (selectedOrderDateFilter !== 'ALL') {
      pool = pool.filter(o => {
        const d = (o.travel_date || o.online_store_events?.events_master?.event_date || '').split('T')[0]
        return d === selectedOrderDateFilter
      })
    }
    if (selectedEventFilter !== 'ALL') {
      pool = pool.filter(o => 
        o.online_store_events?.event_master_id === selectedEventFilter || 
        o.online_store_events?.events_master?.id === selectedEventFilter
      )
    }
    if (selectedCompanyFilter !== 'ALL') {
      pool = pool.filter(o => {
        const comp = getStoreCompany(o.online_store_events?.title)
        return comp.toLowerCase().includes(selectedCompanyFilter.toLowerCase())
      })
    }

    const map = new Map<string, number>()
    let unassignedCount = 0

    pool.forEach(o => {
      const bus = (o.bus_identifier || '').trim()
      if (!bus) {
        unassignedCount++
      } else {
        map.set(bus, (map.get(bus) || 0) + 1)
      }
    })

    const list = Array.from(map.entries()).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    return {
      list,
      unassignedCount,
      totalCount: pool.length
    }
  }, [ordersList, selectedOrderDateFilter, selectedEventFilter, selectedCompanyFilter])

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

      // 1b. Date filter (travel date independent of events)
      if (selectedOrderDateFilter !== 'ALL') {
        const d = (order.travel_date || order.online_store_events?.events_master?.event_date || '').split('T')[0]
        if (d !== selectedOrderDateFilter) {
          return false
        }
      }

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

      // 4. Coordinator / Micro filter
      if (selectedCoordinatorFilter !== 'ALL') {
        if (selectedCoordinatorFilter === '__UNASSIGNED__') {
          if (order.bus_identifier && order.bus_identifier.trim()) {
            return false
          }
        } else {
          const bus = (order.bus_identifier || '').trim().toLowerCase()
          if (bus !== selectedCoordinatorFilter.toLowerCase().trim()) {
            return false
          }
        }
      }

      // 5. Status filter
      if (selectedStatusFilter !== 'ALL') {
        if (order.status !== selectedStatusFilter) {
          return false
        }
      }

      return true
    })
  }, [ordersList, searchTerm, selectedOrderDateFilter, selectedEventFilter, selectedCompanyFilter, selectedCoordinatorFilter, selectedStatusFilter])

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

  const availableBusesForMovingStore = useMemo(() => {
    if (movingOrder) {
      const storeId = movingOrder.store_event_id
      const storeOrders = ordersList.filter(o => o.store_event_id === storeId && o.bus_identifier)
      const set = new Set<string>()
      storeOrders.forEach(o => {
        if (o.bus_identifier && o.bus_identifier.trim()) {
          set.add(o.bus_identifier.trim())
        }
      })
      return Array.from(set)
    } else if (bulkMoving) {
      const storeIds = new Set(filteredOrders.map(o => o.store_event_id))
      const storeOrders = ordersList.filter(o => (storeIds.size === 0 || storeIds.has(o.store_event_id)) && o.bus_identifier)
      const set = new Set<string>()
      storeOrders.forEach(o => {
        if (o.bus_identifier && o.bus_identifier.trim()) {
          set.add(o.bus_identifier.trim())
        }
      })
      return Array.from(set)
    }
    return []
  }, [movingOrder, bulkMoving, ordersList, filteredOrders])

  const handleBulkMoveOrders = async () => {
    const idsToMove = filteredOrders.map(o => o.id)
    if (idsToMove.length === 0) return
    const cleanTarget = targetBusInput.trim()
    if (!confirm(`¿Confirmás que querés reasignar los ${idsToMove.length} pedidos mostrados al micro/coordinador "${cleanTarget || 'Sin Micro'}"?`)) {
      return
    }
    setIsMovingOrder(true)
    try {
      const res = await bulkMoveOnlineOrdersBusAction({
        orderIds: idsToMove,
        newBusIdentifier: cleanTarget
      })
      if (res.success) {
        setOrdersList(prev => prev.map(o => idsToMove.includes(o.id) ? { ...o, bus_identifier: cleanTarget || null } : o))
        setBulkMoving(false)
        alert(`¡Se reasignaron exitosamente ${res.count} pedidos a "${cleanTarget || 'Sin Micro'}"!`)
      } else {
        alert("Error al mover los pedidos: " + res.error)
      }
    } catch (e: any) {
      console.error("Error bulk moving orders:", e)
      alert("Error al mover pedidos: " + (e.message || 'Error desconocido'))
    } finally {
      setIsMovingOrder(false)
    }
  }

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/tienda/${slug}`
    navigator.clipboard.writeText(url)
  }

  const handleToggleStore = async (store: any) => {
    const id = store.id
    const currentStatus = store.is_active
    const newStatus = !currentStatus

    let sendMode: 'test' | 'official' | 'none' = 'none'
    if (currentStatus === true) {
      // Operator is turning store OFF (closing store)
      const wantEmail = window.confirm(
        "¿Deseas enviar el correo de 'Primer corte para producción' al cerrar esta tienda?\n\n" +
        "• Aceptar: Seleccionar destinatario (Prueba personal o Graciela).\n" +
        "• Cancelar: Cerrar la tienda SIN enviar correo."
      )

      if (wantEmail) {
        const isTest = window.confirm(
          "¿Deseas que sea un envío de MODO PRUEBA únicamente a tu correo (fschottenfeld@gmail.com)?\n\n" +
          "• Aceptar: MODO PRUEBA (SOLO a fschottenfeld@gmail.com, Graciela NO lo recibe).\n" +
          "• Cancelar: Envío oficial a Graciela (graciel.ch@gmail.com) con copia a ti."
        )
        sendMode = isTest ? 'test' : 'official'
      }
    }

    setLoadingAction(`toggle-${id}`)
    setStoresList(prev => prev.map(s => s.id === id ? { ...s, is_active: newStatus } : s))
    await toggleStoreActiveAction(id, newStatus)

    if (sendMode !== 'none') {
      try {
        const targetEmail = sendMode === 'test' ? 'fschottenfeld@gmail.com' : 'graciel.ch@gmail.com'
        const ccEmail = sendMode === 'test' ? undefined : 'fschottenfeld@gmail.com'
        const res = await sendFirstCutProductionEmailAction({
          eventId: store.event_master_id,
          targetEmail,
          ccEmail
        })
        if (res.success) {
          if (sendMode === 'test') {
            alert("¡Prueba enviada con éxito exclusivamente a tu casilla fschottenfeld@gmail.com!")
          } else {
            alert("¡Primer corte de producción enviado con éxito a graciel.ch@gmail.com (CC: fschottenfeld@gmail.com)!")
          }
        } else {
          alert(`La tienda se desactivó, pero ocurrió un problema al enviar el correo: ${res.error || 'Error desconocido'}`)
        }
      } catch (err: any) {
        alert(`Error al enviar el correo de producción: ${err.message}`)
      }
    }

    router.refresh()
    setLoadingAction(null)
  }

  const handleSendFirstCutManual = async (store: any) => {
    const showTitle = store.events_master?.show_name || store.title
    const isTest = window.confirm(
      `¿Deseas enviar este 1° Corte en MODO PRUEBA únicamente a tu correo (fschottenfeld@gmail.com)?\n\n` +
      `• Aceptar: MODO PRUEBA (solo a fschottenfeld@gmail.com, Graciela NO lo recibe).\n` +
      `• Cancelar: Pasar a confirmación de envío oficial a Graciela.`
    )

    let targetEmail = "graciel.ch@gmail.com"
    let ccEmail: string | undefined = "fschottenfeld@gmail.com"

    if (isTest) {
      targetEmail = "fschottenfeld@gmail.com"
      ccEmail = undefined
    } else {
      const sendOfficial = window.confirm(
        `¿Deseas enviar el 1° Corte OFICIAL a Graciela (graciel.ch@gmail.com) con copia a tu correo?\n\nShow: ${showTitle}`
      )
      if (!sendOfficial) return
    }

    setLoadingAction(`email-${store.id}`)
    try {
      const res = await sendFirstCutProductionEmailAction({
        eventId: store.event_master_id,
        targetEmail,
        ccEmail
      })
      if (res.success) {
        if (isTest) {
          alert("¡Prueba enviada con éxito! Revisa tu casilla fschottenfeld@gmail.com")
        } else {
          alert("¡Primer corte de producción enviado con éxito a graciel.ch@gmail.com (CC: fschottenfeld@gmail.com)!")
        }
      } else {
        alert(`Error al enviar el correo: ${res.error || 'Error desconocido'}`)
      }
    } catch (err: any) {
      alert(`Error al enviar el correo: ${err.message}`)
    } finally {
      setLoadingAction(null)
    }
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

  const handleExportOrdersXLS = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      alert("No hay pedidos para exportar con los filtros seleccionados.")
      return
    }

    const rows = filteredOrders.map(order => {
      const trad = Number(order.qty_tradicional) || 0
      const veg = Number(order.qty_vegetariano) || 0
      const stacc = Number(order.qty_sintacc) || 0
      const vegan = Number(order.qty_vegano) || 0
      const totalViandas = trad + veg + stacc + vegan

      const statusMap: Record<string, string> = {
        'paid': 'PAGADO',
        'pending_payment': 'PENDIENTE',
        'cancelled': 'CANCELADO',
        'refunded': 'REEMBOLSADO'
      }

      return {
        'Fecha': new Date(order.created_at).toLocaleDateString('es-AR') + ' ' + new Date(order.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        'Cliente': order.online_customers?.full_name || order.full_name || 'Desconocido',
        'Teléfono': order.online_customers?.phone || order.phone || '',
        'Email': order.online_customers?.email || order.email || '',
        'Evento / Tienda': order.online_store_events?.title || '',
        'Fecha Viaje': order.travel_date ? new Date(order.travel_date + 'T12:00:00').toLocaleDateString('es-AR') : '',
        'Micro / Coordinador': order.bus_identifier || '',
        'Tradicional': trad,
        'Vegetariano': veg,
        'Sin TACC': stacc,
        'Vegano': vegan,
        'Total Viandas': totalViandas,
        'Monto Total ($)': Number(order.total_amount) || 0,
        'Estado': statusMap[order.status] || order.status || '',
        'ID Mercado Pago': order.mp_payment_id || '',
        'ID Pedido': order.id
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    
    // Column widths
    ws['!cols'] = [
      { wch: 18 }, // Fecha
      { wch: 25 }, // Cliente
      { wch: 18 }, // Teléfono
      { wch: 30 }, // Email
      { wch: 35 }, // Evento / Tienda
      { wch: 14 }, // Fecha Viaje
      { wch: 24 }, // Micro / Coordinador
      { wch: 12 }, // Tradicional
      { wch: 12 }, // Vegetariano
      { wch: 10 }, // Sin TACC
      { wch: 10 }, // Vegano
      { wch: 14 }, // Total Viandas
      { wch: 16 }, // Monto Total ($)
      { wch: 14 }, // Estado
      { wch: 20 }, // ID Mercado Pago
      { wch: 38 }  // ID Pedido
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos")

    const dateStr = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Pedidos_Online_${dateStr}.xlsx`)
  }

  const handleExportCustomersXLS = () => {
    const filteredCustomers = customers.filter(c => 
      searchTerm === '' || 
      c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (filteredCustomers.length === 0) {
      alert("No hay clientes para exportar.")
      return
    }

    const rows = filteredCustomers.map(c => ({
      'Nombre': c.full_name || 'Desconocido',
      'Email': c.email || '',
      'Teléfono': c.phone || '',
      'Pedidos Pagados': c.paidOrdersCount || 0,
      'Total Gastado ($)': c.totalSpent || 0
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Clientes")

    const dateStr = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Clientes_Online_${dateStr}.xlsx`)
  }

  const renderTiendas = () => {
    const isFiltered = storeCompanyFilter !== 'ALL' || storeDateFilter !== 'ALL' || storeSearchTerm.trim() !== '' || storeViewFilter !== 'ALL'

    return (
      <div className="space-y-6">
        {/* Header with Title & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold uppercase italic text-slate-800">Mis Tiendas Online</h2>
            <p className="text-xs text-slate-500 mt-0.5">Control de tiendas, estados y pedidos por evento.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

        {/* Filters Bar: Status Pills + Fecha Filter + Empresa Filter + Search Input */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-black uppercase shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setStoreViewFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${storeViewFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Todas ({sortedStores.length})
              </button>
              <button
                type="button"
                onClick={() => setStoreViewFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${storeViewFilter === 'ACTIVE' ? 'bg-emerald-500 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-800'}`}
              >
                🟢 Abiertas ({activeStores.length})
              </button>
              <button
                type="button"
                onClick={() => setStoreViewFilter('PAUSED')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${storeViewFilter === 'PAUSED' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:text-amber-800'}`}
              >
                ⏸️ Cerradas ({pausedStores.length})
              </button>
            </div>

            {/* Inputs: Fecha Selector + Empresa Selector + Live Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:max-w-3xl justify-end">
              {/* Date Filter Dropdown */}
              <div className="min-w-[160px] sm:w-48">
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={storeDateFilter}
                    onChange={e => setStoreDateFilter(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">Todas las Fechas ({uniqueStoreDates.length})</option>
                    {uniqueStoreDates.map(d => (
                      <option key={d.date} value={d.date}>
                        {d.formatted} ({d.count})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Company Filter Dropdown */}
              <div className="min-w-[170px] sm:w-52">
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={storeCompanyFilter}
                    onChange={e => setStoreCompanyFilter(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">Todas las Empresas ({uniqueCompanies.length})</option>
                    {uniqueCompanies.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Search Box */}
              <div className="flex-1 min-w-[180px]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={storeSearchTerm}
                    onChange={e => setStoreSearchTerm(e.target.value)}
                    placeholder="Buscar show o empresa..."
                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                  />
                  {storeSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setStoreSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Borrar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Clear filters button */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    setStoreDateFilter('ALL')
                    setStoreCompanyFilter('ALL')
                    setStoreSearchTerm('')
                    setStoreViewFilter('ALL')
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-rose-100 flex items-center justify-center gap-1"
                  title="Restablecer todos los filtros"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Results feedback banner when filtering */}
          {isFiltered && (
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100">
              <span>
                Mostrando <strong className="text-indigo-600 font-black">{displayedStores.length}</strong> de {sortedStores.length} tiendas
                {storeCompanyFilter !== 'ALL' && <span> • Empresa: <strong className="text-slate-800">{storeCompanyFilter}</strong></span>}
                {storeViewFilter !== 'ALL' && <span> • Estado: <strong className="text-slate-800">{storeViewFilter === 'ACTIVE' ? 'Abiertas' : 'Cerradas'}</strong></span>}
                {storeSearchTerm && <span> • Búsqueda: &ldquo;{storeSearchTerm}&rdquo;</span>}
              </span>
            </div>
          )}
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
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black uppercase italic tracking-tight text-xl text-slate-900 leading-tight break-words">
                    {store.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg inline-flex border border-slate-200 shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                      {eventDateStr ? new Date(eventDateStr + 'T12:00:00').toLocaleDateString('es-AR') : 'Sin fecha'}
                    </div>
                    {(() => {
                      const isDeadlinePassed = store.sales_deadline ? new Date() > new Date(store.sales_deadline) : false
                      if (isDeadlinePassed) {
                        const dl = new Date(store.sales_deadline)
                        const timeStr = dl.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })
                        return (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 uppercase tracking-wider flex items-center gap-1 shrink-0" title="El horario límite configurado ha finalizado">
                            ⏰ Cerrada ({timeStr} hs)
                          </span>
                        )
                      }
                      if (!store.is_active) {
                        return (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 uppercase tracking-wider shrink-0" title="Pausada manualmente por el operador">
                            ⏸️ Pausada
                          </span>
                        )
                      }
                      return (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 uppercase tracking-wider shrink-0" title="Abierta recibiendo pedidos">
                          🟢 Activa
                        </span>
                      )
                    })()}
                  </div>
                </div>
                
                <button
                  onClick={() => handleToggleStore(store)}
                  disabled={isLoadingToggle}
                  className={`p-2 rounded-full transition-colors cursor-pointer shrink-0 ${store.is_active ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-200'}`}
                  title={store.is_active ? "Desactivar tienda" : "Activar tienda"}
                >
                  {isLoadingToggle ? <Loader2 className="w-6 h-6 animate-spin" /> : store.is_active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              <div className="flex-1 space-y-4">
                {/* Redesigned Store Link Bar */}
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 pl-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                    <LinkIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-600 truncate font-mono select-all" title={`/tienda/${store.slug}`}>
                      /tienda/{store.slug}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      type="button"
                      onClick={() => handleCopyLink(store.slug)} 
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer border border-transparent hover:border-indigo-100" 
                      title="Copiar link de la tienda pública"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a 
                      href={`/tienda/${store.slug}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer shrink-0" 
                      title="Abrir tienda en nueva pestaña"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3 h-3" />
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
                    <Bus size={13} className="text-emerald-600 shrink-0" />
                    <span>🧭 Tablero Coordinador</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const coordUrl = `${window.location.origin}/tienda/${store.slug}/coordinador`
                      navigator.clipboard.writeText(coordUrl)
                      alert("¡Link del Tablero de Coordinador copiado al portapapeles! Listo para enviar por WhatsApp.")
                    }}
                    className="py-2.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center transition cursor-pointer shrink-0"
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

                {/* Manual First Cut Production Email */}
                <button
                  type="button"
                  onClick={() => handleSendFirstCutManual(store)}
                  disabled={loadingAction === `email-${store.id}`}
                  className="w-full py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                  title="Enviar manualmente el 1° corte de producción por email a Graciela (graciel.ch@gmail.com)"
                >
                  {loadingAction === `email-${store.id}` ? (
                    <Loader2 size={13} className="animate-spin text-indigo-600" />
                  ) : (
                    <Mail size={13} className="text-indigo-600" />
                  )}
                  <span>📧 Enviar 1° Corte Cocina</span>
                </button>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Recaudación Pagada</div>
                  {userRole === 'cocina' ? (
                    <div className="text-sm font-black text-indigo-600">{paidOrders.length} pedidos pagados</div>
                  ) : (
                    <div className="text-lg font-black text-emerald-600">{formatCurrency(revenue)}</div>
                  )}
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

        {displayedStores.length === 0 && sortedStores.length > 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <Store className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-lg font-bold text-slate-700">No se encontraron tiendas</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay tiendas que coincidan con los filtros seleccionados en esta vista.
            </p>
            <button
              type="button"
              onClick={() => {
                setStoreCompanyFilter('ALL')
                setStoreSearchTerm('')
                setStoreViewFilter('ALL')
              }}
              className="mt-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer border border-indigo-100 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restablecer filtros
            </button>
          </div>
        )}

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
}

  const renderPedidos = () => {
    return (
      <div className="space-y-6">

        {/* 1. FILTERS BAR (Evento, Empresa, Coordinador, Estado, Buscador) */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-800 shrink-0">
              <Filter className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-wider">Filtrar Pedidos</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 flex-1 lg:max-w-6xl">
              {/* Travel Date Filter (Independent of events) */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Fecha Viaje</label>
                <select
                  value={selectedOrderDateFilter}
                  onChange={e => {
                    setSelectedOrderDateFilter(e.target.value)
                    setSelectedCoordinatorFilter('ALL')
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todas las Fechas ({uniqueOrderDates.length})</option>
                  {uniqueOrderDates.map(d => (
                    <option key={d.date} value={d.date}>
                      {d.formatted} ({d.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Evento</label>
                <select
                  value={selectedEventFilter}
                  onChange={e => {
                    setSelectedEventFilter(e.target.value)
                    setSelectedCoordinatorFilter('ALL')
                  }}
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
                  onChange={e => {
                    setSelectedCompanyFilter(e.target.value)
                    setSelectedCoordinatorFilter('ALL')
                  }}
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

              {/* Coordinator / Micro Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Coordinador / Micro</label>
                <select
                  value={selectedCoordinatorFilter}
                  onChange={e => setSelectedCoordinatorFilter(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todos ({uniqueCoordinators.totalCount})</option>
                  {uniqueCoordinators.unassignedCount > 0 && (
                    <option value="__UNASSIGNED__">⚠️ Sin Micro / A coordinar ({uniqueCoordinators.unassignedCount})</option>
                  )}
                  {uniqueCoordinators.list.map(c => (
                    <option key={c.name} value={c.name}>
                      🚌 {c.name} ({c.count})
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
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {userRole === 'cocina' ? 'Viandas Pagadas' : 'Recaudación Filtrada'}
              </p>
              {userRole === 'cocina' ? (
                <p className="text-lg font-black text-indigo-600">{productionMetrics.totalViandas} viandas</p>
              ) : (
                <p className="text-lg font-black text-emerald-600">{formatCurrency(productionMetrics.totalRevenue)}</p>
              )}
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
            <div>
              <h2 className="text-xl font-bold uppercase italic text-slate-800">
                Pedidos Detallados ({filteredOrders.length})
              </h2>
              <div className="text-xs font-bold text-slate-500 mt-0.5">
                Mostrando {filteredOrders.length} de {ordersList.length} pedidos
              </div>
            </div>

            <div className="flex items-center gap-2">
              {filteredOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkMoving(true)
                    setTargetBusInput(selectedCoordinatorFilter !== 'ALL' && selectedCoordinatorFilter !== '__UNASSIGNED__' ? selectedCoordinatorFilter : '')
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition shadow-md hover:shadow-indigo-600/20 active:scale-95 cursor-pointer"
                  title="Reasignar todos los pedidos mostrados a otro micro o coordinador en lote"
                >
                  <ArrowRightLeft size={16} />
                  <span>Mover en Lote ({filteredOrders.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportOrdersXLS}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition shadow-md hover:shadow-emerald-600/20 active:scale-95 cursor-pointer"
                title="Descargar pedidos filtrados en formato Excel XLS"
              >
                <FileSpreadsheet size={16} />
                <span>Descargar XLS</span>
              </button>
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
                  {userRole !== 'cocina' && <th className="px-6 py-4 whitespace-nowrap">Total</th>}
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
                        <div className="font-bold text-slate-800">{order.online_customers?.full_name || order.full_name || 'Desconocido'}</div>
                        <div className="text-xs text-slate-500">{order.online_customers?.email || order.email}</div>
                        {(order.online_customers?.phone || order.phone) && (
                          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                            <span className="text-[10px]">📱</span> {order.online_customers?.phone || order.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700">{order.online_store_events?.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-700">{order.travel_date ? new Date(order.travel_date + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {order.bus_identifier ? (
                            <span className="text-xs text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                              Micro: {order.bus_identifier}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium italic">
                              Sin Micro
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setMovingOrder(order)
                              setTargetBusInput(order.bus_identifier || '')
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                            title="Mover a otro Micro / Coordinador"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-wrap gap-1 justify-center max-w-[120px]">
                          {combos.map((c, i) => (
                            <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      {userRole !== 'cocina' && (
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-600">
                          {formatCurrency(order.total_amount)}
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {order.status === 'paid' ? 'Pagado' : order.status === 'pending_payment' ? 'Pendiente' : order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status === 'paid' && (
                            <button
                              type="button"
                              onClick={() => handleResendEmail(order.id, order.online_customers?.email)}
                              disabled={resendingEmailId === order.id}
                              className="text-xs font-bold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-sky-200/60 inline-flex items-center gap-1"
                              title="Reenviar comprobante por correo electrónico"
                            >
                              {resendingEmailId === order.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Mail size={12} />
                              )}
                              <span>Reenviar Mail</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setMovingOrder(order)
                              setTargetBusInput(order.bus_identifier || '')
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-indigo-200/60 inline-flex items-center gap-1"
                            title="Mover a otro Micro o Coordinador"
                          >
                            <ArrowRightLeft size={12} />
                            <span>Mover a...</span>
                          </button>

                          {order.status === 'pending_payment' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleManuallyApproveOrder(order.id, order.online_customers?.email)}
                                disabled={approvingId === order.id}
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-emerald-300 inline-flex items-center gap-1"
                                title="Aprobar pago manualmente y enviar correo de confirmación"
                              >
                                {approvingId === order.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={12} />
                                )}
                                <span>Aprobar Pago</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancelSingleOrder(order.id, order.online_customers?.email)}
                                disabled={cancellingId === order.id}
                                className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-rose-200/60 inline-flex items-center gap-1"
                                title="Cancelar este pedido pendiente"
                              >
                                {cancellingId === order.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Ban size={12} />
                                )}
                                <span>Cancelar</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={userRole === 'cocina' ? 7 : 8} className="px-6 py-12 text-center text-slate-500">
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
          <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
            <h2 className="text-xl font-bold uppercase italic text-slate-800">Base de Clientes (CRM Pasajeros)</h2>
            <div className="flex items-center gap-3">
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
              <button
                type="button"
                onClick={handleExportCustomersXLS}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition shadow-md hover:shadow-emerald-600/20 active:scale-95 cursor-pointer"
                title="Descargar clientes en formato Excel XLS"
              >
                <FileSpreadsheet size={15} />
                <span>Descargar XLS</span>
              </button>
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
                  {userRole !== 'cocina' && <th className="px-6 py-4 text-right">Total Gastado</th>}
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
                      {userRole !== 'cocina' && (
                        <td className="px-6 py-4 text-right font-black text-emerald-600">
                          {formatCurrency(totalSpent)}
                        </td>
                      )}
                    </tr>
                  )
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={userRole === 'cocina' ? 4 : 5} className="px-6 py-12 text-center text-slate-500">
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

      {/* Move Order to Another Bus / Coord Modal (Single & Bulk) */}
      {(movingOrder || bulkMoving) && (
        <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <ArrowRightLeft size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {bulkMoving ? `Mover ${filteredOrders.length} Pedidos en Lote` : 'Mover Pedido a otro Micro / Coordi'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {bulkMoving ? 'Reasignar todos los pedidos filtrados' : 'Reasignar pasajero a otro coordinador o micro'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMovingOrder(null)
                  setBulkMoving(false)
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Info Box */}
            {movingOrder ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Pasajero</span>
                  <span className="font-black text-slate-800">{movingOrder.online_customers?.full_name || 'Desconocido'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Micro Actual</span>
                  <span className="font-bold text-indigo-600">{movingOrder.bus_identifier || 'Sin asignar'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tienda / Evento</span>
                  <span className="font-medium text-slate-600 truncate max-w-[200px]">{movingOrder.online_store_events?.title}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-600 font-bold uppercase tracking-wider text-[10px]">Pedidos Seleccionados</span>
                  <span className="font-black text-indigo-900 text-sm">{filteredOrders.length} pedidos</span>
                </div>
                {selectedCoordinatorFilter !== 'ALL' && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-600 font-bold uppercase tracking-wider text-[10px]">Coordinador Actual</span>
                    <span className="font-bold text-slate-800">
                      {selectedCoordinatorFilter === '__UNASSIGNED__' ? 'Sin Micro' : selectedCoordinatorFilter}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Chips of existing micros in this store */}
            {availableBusesForMovingStore.length > 0 && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Micros / Coordinadores registrados:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availableBusesForMovingStore.map((bName) => (
                    <button
                      key={bName}
                      type="button"
                      onClick={() => setTargetBusInput(bName)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                        targetBusInput === bName
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-indigo-200'
                      }`}
                    >
                      {bName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                O Escribir Nuevo Micro / Coordinador:
              </label>
              <input
                type="text"
                placeholder="Ej: Micro 2 - Cami / Flor / Micro 3"
                value={targetBusInput}
                onChange={e => setTargetBusInput(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-200 font-bold text-slate-800 text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMovingOrder(null)
                  setBulkMoving(false)
                }}
                className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={bulkMoving ? handleBulkMoveOrders : handleMoveOrder}
                disabled={isMovingOrder || !targetBusInput.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isMovingOrder ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={16} /> Confirmar {bulkMoving ? `Traslado (${filteredOrders.length})` : 'Traslado'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

