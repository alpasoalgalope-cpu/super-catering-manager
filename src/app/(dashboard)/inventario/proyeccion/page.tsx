"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getCoordinatorConversionRatesAction } from "@/app/actions/reports"
import { 
  ShoppingCart, Package, TrendingUp, Calendar as CalendarIcon, 
  MapPin, Loader2, Info, ArrowRight, Scale, 
  ChevronRight, Calculator, PieChart, CheckCircle2,
  Circle, Shield, Truck, AlertTriangle, Clock,
  ChevronLeft, Filter, Plus, Eye, EyeOff, Sparkles, Layers,
  CalendarDays, Check, RefreshCw
} from "lucide-react"
import CreatePOModal from "@/components/inventory/CreatePOModal"

// --- Types ---
interface IngredientNeed {
  productId: string
  name: string
  unit: string
  totalQuantity: number
  baseQuantity: number
  gramsPerUnit: number
  familyName: string
  stockActual: number
  stockTransito: number
  proveedorId?: string
  proveedorName?: string
}

interface EventSummary {
  id: string
  date: string
  show: string
  totalPax: number
  adjustedPax: number
  companies?: {
    companyName: string
    pax: number
    adjustedSales: number
  }[]
  details: {
    category: string
    quantity: number
    recipeName: string
    recipeId: string
    companies?: string[]
  }[]
  missingRules?: string[]
}

interface DayColumn {
  dateStr: string
  dayName: string
  dayNumber: number
  monthName: string
  isToday: boolean
  isPast: boolean
  events: EventSummary[]
  incomingPOs: any[]
  totalPax: number
  totalViandas: number
  tradicional: number
  vegetariano: number
  vegano: number
  sintacc: number
  bebidas: number
  dayCompanies: { companyName: string, pax: number, adjustedSales: number }[]
}

function normalizeKey(str: string) {
  return str?.trim().toLowerCase().replace(/\s+/g, ' ') || ""
}

export default function ProyeccionInsumosPage() {
  const router = useRouter()
  const supabase = createClient()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'timeline' | 'staggered' | 'consolidated'>('timeline')
  const [rangeDays, setRangeDays] = useState<number>(10)
  const [startDateOffset, setStartDateOffset] = useState<number>(0)
  const [bufferPercentage, setBufferPercentage] = useState<number>(20)
  const [selectedFamily, setSelectedFamily] = useState<string>("TODAS")
  const [searchTerm, setSearchTerm] = useState<string>("")
  
  // Modals & Quick Actions
  const [showCreatePOModal, setShowCreatePOModal] = useState(false)
  const [poPrefillDate, setPoPrefillDate] = useState<string>("")
  const [poPrefillProvId, setPoPrefillProvId] = useState<string>("")
  const [poPrefillItems, setPoPrefillItems] = useState<any[]>([])
  const [selectedPODetail, setSelectedPODetail] = useState<any | null>(null)

  const [generatingPOs, setGeneratingPOs] = useState(false)
  
  // Visibilidad de Días
  const [hideEmptyDays, setHideEmptyDays] = useState<boolean>(false)
  const [hiddenDayDates, setHiddenDayDates] = useState<Set<string>>(new Set())

  const toggleHideDay = (dateStr: string) => {
    setHiddenDayDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  const restoreAllDays = () => {
    setHiddenDayDates(new Set())
    setHideEmptyDays(false)
  }

  // Data Store
  const [rawData, setRawData] = useState<{
    masters: any[]
    probabilities: any[]
    rules: any[]
    clientList: any[]
    recipes: any[]
    waterProduct: any
    inTransit: any[]
    purchaseOrders: any[]
    allProducts: any[]
  }>({
    masters: [],
    probabilities: [],
    rules: [],
    clientList: [],
    recipes: [],
    waterProduct: null,
    inTransit: [],
    purchaseOrders: [],
    allProducts: []
  })

  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set())
  const [coordinatorRates, setCoordinatorRates] = useState<Record<string, number>>({})
  const [rvClientId, setRvClientId] = useState<string | undefined>(undefined)

  // --- Compute Dates Window ---
  const dateWindow = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const start = new Date(today)
    start.setDate(start.getDate() + startDateOffset)

    const end = new Date(start)
    end.setDate(end.getDate() + rangeDays - 1)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    return { start, end, startStr, endStr }
  }, [startDateOffset, rangeDays])

  // --- Fetch Data ---
  const fetchData = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      const [{ data: masters }, { data: probabilities }, { data: rules }, { data: clientList }, { data: recipes }, { data: waterProduct }, { data: inTransit }, { data: purchaseOrders }, { data: allProducts }, coordinatorRatesRes] = await Promise.all([
        supabase.from("events_master")
          .select("id, event_date, show_name, status, event_projections(company_name, projected_pax), event_bus_assignments(client_id, crew_count, coordinators(id, name, phone, company))")
          .gte("event_date", dateWindow.startStr)
          .lte("event_date", dateWindow.endStr)
          .neq("status", "cancelado")
          .neq("status", "ejecutado")
          .order("event_date", { ascending: true }),
        supabase.from("product_mix_probabilities").select("*"),
        supabase.from("commercial_rules").select("*"),
        supabase.from("clients").select("id, name, conversion_factor"),
        supabase.from("recetas").select(`
          id, nombre,
          receta_insumos(
            producto_id, 
            cantidad_necesaria, 
            productos(
              id,
              nombre, 
              unidad_medida, 
              gramos_por_unidad,
              stock_actual,
              proveedor_id,
              familias(nombre),
              proveedores!productos_proveedor_id_fkey(nombre)
            )
          )
        `),
        supabase.from("productos").select("*, familias(nombre), proveedores!productos_proveedor_id_fkey(nombre)").eq("id", "2e452d5b-9d90-47a7-ae2e-134cc55ef7bd").single(),
        supabase.from("vw_stock_en_transito").select("*"),
        supabase.from("purchase_orders")
          .select(`
            id,
            fecha_esperada,
            estado,
            proveedor_id,
            costo_total,
            proveedores (nombre),
            purchase_order_items (
              producto_id,
              cantidad,
              costo_unitario,
              productos (nombre, unidad_medida, familias(nombre), gramos_por_unidad)
            )
          `)
          .gte("fecha_esperada", dateWindow.startStr)
          .lte("fecha_esperada", dateWindow.endStr)
          .neq("estado", "CANCELADA")
          .order("fecha_esperada", { ascending: true }),
        supabase.from("productos")
          .select("id, nombre, unidad_medida, gramos_por_unidad, stock_actual, proveedor_id, familias(nombre), proveedores!productos_proveedor_id_fkey(nombre)")
          .order("nombre"),
        getCoordinatorConversionRatesAction()
      ])

      const rates = coordinatorRatesRes.data || {}
      setCoordinatorRates(rates)

      let rvId: string | undefined = undefined
      clientList?.forEach((c: any) => {
        if (c.name?.trim().toLowerCase() === "rv traslados") {
          rvId = c.id
        }
      })
      setRvClientId(rvId)

      setRawData({
        masters: masters || [],
        probabilities: probabilities || [],
        rules: rules || [],
        clientList: clientList || [],
        recipes: recipes || [],
        waterProduct: waterProduct || null,
        inTransit: inTransit || [],
        purchaseOrders: purchaseOrders || [],
        allProducts: allProducts || []
      })

      if (masters) {
        setSelectedEventIds(new Set(masters.map(m => m.id)))
      }
    } catch (e) {
      console.error("Error fetching proyeccion data:", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateWindow.startStr, dateWindow.endStr])

  // --- Maps for Fast Lookups ---
  const maps = useMemo(() => {
    const probMap: Record<string, number> = {}
    rawData.probabilities.forEach(p => probMap[p.category] = Number(p.probability))

    const ruleMap: Record<string, any> = {}
    rawData.rules.forEach(r => {
      const key = normalizeKey(r.company_name)
      if (key) ruleMap[key] = r
    })

    const convMap: Record<string, number> = {}
    rawData.clientList.forEach(c => {
      const key = normalizeKey(c.name)
      if (key) convMap[key] = Number(c.conversion_factor) || 1.0
    })

    const recipeMap: Record<string, any> = {}
    rawData.recipes.forEach(r => recipeMap[r.id] = r)

    const transitMap: Record<string, number> = {}
    rawData.inTransit.forEach(t => transitMap[t.producto_id] = Number(t.total_en_transito))

    const productMap: Record<string, any> = {}
    rawData.allProducts.forEach(p => productMap[p.id] = p)

    return { probMap, ruleMap, convMap, recipeMap, transitMap, productMap }
  }, [rawData])

  // --- Day-by-Day Demands & Timeline Aggregation ---
  const timelineDays = useMemo<DayColumn[]>(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const days: DayColumn[] = []

    const cur = new Date(dateWindow.start)
    for (let i = 0; i < rangeDays; i++) {
      const dStr = cur.toISOString().split('T')[0]
      const dayOfWeek = cur.toLocaleDateString('es-AR', { weekday: 'long' })
      const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
      const dayNum = cur.getDate()
      const mName = cur.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '')

      days.push({
        dateStr: dStr,
        dayName: capitalizedDay,
        dayNumber: dayNum,
        monthName: mName,
        isToday: dStr === todayStr,
        isPast: dStr < todayStr,
        events: [],
        incomingPOs: [],
        totalPax: 0,
        totalViandas: 0,
        tradicional: 0,
        vegetariano: 0,
        vegano: 0,
        sintacc: 0,
        bebidas: 0,
        dayCompanies: []
      })

      cur.setDate(cur.getDate() + 1)
    }

    // Map Events to Days (only pending/confirmed future production events, exclude ejecutado and cancelado)
    rawData.masters
      .filter(m => m.status !== 'ejecutado' && m.status !== 'cancelado')
      .forEach(m => {
      const dayCol = days.find(d => d.dateStr === m.event_date)
      if (!dayCol) return

      let eventTotalPax = 0
      const missingRules: string[] = []
      const eventCompanies: { companyName: string, pax: number, adjustedSales: number }[] = []
      const consolidatedDetails: Record<string, { category: string, quantity: number, recipeName: string, recipeId: string, companies: string[] }> = {}

      // Crew viandas
      const eventCrewTotal = (m.event_bus_assignments || []).reduce((acc: number, ba: any) => acc + (ba.crew_count || 0), 0)
      if (eventCrewTotal > 0) {
        eventCompanies.push({
          companyName: 'Tripulación / Choferes',
          pax: eventCrewTotal,
          adjustedSales: eventCrewTotal
        })

        const anyComp = m.event_projections?.[0]?.company_name
        const rule = anyComp ? maps.ruleMap[normalizeKey(anyComp)] : null
        const tradRecipeId = rule?.recipe_trad_id || (rawData.rules.length > 0 ? rawData.rules[0].recipe_trad_id : null)
        
        if (tradRecipeId) {
          const recipe = maps.recipeMap[tradRecipeId]
          if (recipe) {
            const recipeKey = `traditional__${recipe.id}`
            consolidatedDetails[recipeKey] = { 
              category: 'traditional',
              quantity: eventCrewTotal, 
              recipeName: recipe.nombre, 
              recipeId: recipe.id,
              companies: ['Tripulación']
            }
          }
        }
      }

      // Projections
      const seenCompanies = new Set()
      const uniqueProjections = m.event_projections?.filter((p: any) => {
        const key = normalizeKey(p.company_name)
        if (!key || seenCompanies.has(key)) return false
        seenCompanies.add(key)
        return true
      }) || []

      uniqueProjections.forEach((proj: any) => {
        const compKey = normalizeKey(proj.company_name)
        let factor = maps.convMap[compKey] || 1.0

        if (compKey === "rv traslados") {
          const rvAssignment = m.event_bus_assignments?.find((ba: any) => {
            if (rvClientId && ba.client_id === rvClientId) return true
            if (ba.coordinators?.company?.trim().toLowerCase() === "rv traslados") return true
            return false
          })
          const coordName = rvAssignment?.coordinators?.name
          if (coordName) {
            const coordRate = coordinatorRates[coordName.trim().toLowerCase()]
            if (coordRate !== undefined && coordRate > 0) {
              factor = coordRate
            }
          }
        }

        const rule = maps.ruleMap[compKey]
        const basePax = Number(proj.projected_pax) || 0
        const adjustedSales = Math.round(basePax * factor)
        eventTotalPax += basePax

        eventCompanies.push({
          companyName: proj.company_name,
          pax: basePax,
          adjustedSales: adjustedSales
        })

        if (!rule) {
          missingRules.push(proj.company_name)
          return
        }

        const cats = [
          { id: 'traditional', recipeId: rule?.recipe_trad_id },
          { id: 'vegetarian', recipeId: rule?.recipe_veg_id },
          { id: 'vegan', recipeId: rule?.recipe_vegan_id },
          { id: 'sin_tacc', recipeId: rule?.recipe_sintacc_id }
        ]

        cats.forEach(cat => {
          const prob = maps.probMap[cat.id] || 0
          const catPax = adjustedSales * prob
          if (catPax <= 0 || !cat.recipeId) return

          const recipe = maps.recipeMap[cat.recipeId]
          if (!recipe) return

          const recipeKey = `${cat.id}__${cat.recipeId}`
          if (!consolidatedDetails[recipeKey]) {
            consolidatedDetails[recipeKey] = {
              category: cat.id,
              quantity: 0,
              recipeName: recipe.nombre,
              recipeId: recipe.id,
              companies: []
            }
          }
          consolidatedDetails[recipeKey].quantity += catPax
          if (!consolidatedDetails[recipeKey].companies.includes(proj.company_name)) {
            consolidatedDetails[recipeKey].companies.push(proj.company_name)
          }
        })

        // Water
        if (rule?.includes_water && rawData.waterProduct) {
          const waterKey = `bebida__${rawData.waterProduct.id}`
          if (!consolidatedDetails[waterKey]) {
            consolidatedDetails[waterKey] = {
              category: 'bebida',
              quantity: 0,
              recipeName: 'Agua 600cc',
              recipeId: rawData.waterProduct.id,
              companies: []
            }
          }
          consolidatedDetails[waterKey].quantity += adjustedSales
          if (!consolidatedDetails[waterKey].companies.includes(proj.company_name)) {
            consolidatedDetails[waterKey].companies.push(proj.company_name)
          }
        }
      })

      let finalEventAdjPax = 0
      const finalDetails = Object.entries(consolidatedDetails).map(([key, data]) => {
        const roundedQty = Math.ceil(data.quantity)
        if (data.category !== 'bebida') finalEventAdjPax += roundedQty

        if (data.category === 'traditional') dayCol.tradicional += roundedQty
        if (data.category === 'vegetarian') dayCol.vegetariano += roundedQty
        if (data.category === 'vegan') dayCol.vegano += roundedQty
        if (data.category === 'sin_tacc') dayCol.sintacc += roundedQty
        if (data.category === 'bebida') dayCol.bebidas += roundedQty

        return {
          category: data.category,
          quantity: roundedQty,
          recipeName: data.recipeName,
          recipeId: data.recipeId,
          companies: data.companies || []
        }
      })

      dayCol.totalPax += eventTotalPax
      dayCol.totalViandas += finalEventAdjPax

      dayCol.events.push({
        id: m.id,
        date: m.event_date,
        show: m.show_name,
        totalPax: eventTotalPax,
        adjustedPax: finalEventAdjPax,
        companies: eventCompanies,
        details: finalDetails,
        missingRules
      })
    })

    // Map Incoming POs to Days
    rawData.purchaseOrders.forEach(po => {
      const dayCol = days.find(d => d.dateStr === po.fecha_esperada)
      if (dayCol) {
        dayCol.incomingPOs.push(po)
      }
    })

    // Consolidate dayCompanies per day across all events
    days.forEach(day => {
      const compMap: Record<string, { companyName: string, pax: number, adjustedSales: number }> = {}
      day.events.forEach(ev => {
        ev.companies?.forEach(c => {
          if (!compMap[c.companyName]) {
            compMap[c.companyName] = { companyName: c.companyName, pax: 0, adjustedSales: 0 }
          }
          compMap[c.companyName].pax += c.pax
          compMap[c.companyName].adjustedSales += c.adjustedSales
        })
      })
      day.dayCompanies = Object.values(compMap)
    })

    return days
  }, [rawData, maps, dateWindow, rangeDays, coordinatorRates, rvClientId])

  // --- Días Visibles Filtrados (Ocultar Días sin Movimientos o Manuales) ---
  const displayedTimelineDays = useMemo(() => {
    return timelineDays.filter(day => {
      if (hiddenDayDates.has(day.dateStr)) return false
      if (hideEmptyDays) {
        const hasEvents = day.events.length > 0
        const hasPOs = day.incomingPOs.length > 0
        if (!hasEvents && !hasPOs) return false
      }
      return true
    })
  }, [timelineDays, hideEmptyDays, hiddenDayDates])

  const emptyDaysCount = useMemo(() => {
    return timelineDays.filter(day => day.events.length === 0 && day.incomingPOs.length === 0).length
  }, [timelineDays])

  const totalHiddenDaysCount = useMemo(() => {
    return timelineDays.length - displayedTimelineDays.length
  }, [timelineDays, displayedTimelineDays])

  // --- Time-Phased MRP Stock Evolution Engine ---
  const stockEvolution = useMemo(() => {
    const trackedProductsMap: Record<string, {
      productId: string
      name: string
      unit: string
      familyName: string
      gramsPerUnit: number
      stockActual: number
      stockTransito: number
      proveedorId?: string
      proveedorName?: string
      dailyDemand: Record<string, number>
      dailyInflow: Record<string, number>
      dailyEndStock: Record<string, number>
      totalDemand: number
      totalInflow: number
      minStockProjected: number
      stockoutDate: string | null
      totalDeficit: number
    }> = {}

    // Init with all products from recipes
    rawData.recipes.forEach(r => {
      r.receta_insumos?.forEach((ri: any) => {
        const p = ri.productos
        if (!p) return
        if (!trackedProductsMap[p.id]) {
          trackedProductsMap[p.id] = {
            productId: p.id,
            name: p.nombre,
            unit: p.unidad_medida || "un",
            familyName: p.familias?.nombre || "General",
            gramsPerUnit: p.gramos_por_unidad || 1,
            stockActual: Number(p.stock_actual) || 0,
            stockTransito: maps.transitMap[p.id] || 0,
            proveedorId: p.proveedor_id,
            proveedorName: p.proveedores?.nombre,
            dailyDemand: {},
            dailyInflow: {},
            dailyEndStock: {},
            totalDemand: 0,
            totalInflow: 0,
            minStockProjected: Number(p.stock_actual) || 0,
            stockoutDate: null,
            totalDeficit: 0
          }
        }
      })
    })

    // Add Water product
    if (rawData.waterProduct) {
      const wp = rawData.waterProduct
      if (!trackedProductsMap[wp.id]) {
        trackedProductsMap[wp.id] = {
          productId: wp.id,
          name: wp.nombre,
          unit: wp.unidad_medida || "un",
          familyName: wp.familias?.nombre || "Bebidas",
          gramsPerUnit: wp.gramos_por_unidad || 1,
          stockActual: Number(wp.stock_actual) || 0,
          stockTransito: maps.transitMap[wp.id] || 0,
          proveedorId: wp.proveedor_id,
          proveedorName: wp.proveedores?.nombre,
          dailyDemand: {},
          dailyInflow: {},
          dailyEndStock: {},
          totalDemand: 0,
          totalInflow: 0,
          minStockProjected: Number(wp.stock_actual) || 0,
          stockoutDate: null,
          totalDeficit: 0
        }
      }
    }

    // Compute Daily Demand per day
    timelineDays.forEach(day => {
      day.events.forEach(ev => {
        if (!selectedEventIds.has(ev.id)) return

        ev.details.forEach(det => {
          if (det.category === 'bebida' && rawData.waterProduct) {
            const pid = rawData.waterProduct.id
            if (trackedProductsMap[pid]) {
              const rawNeeded = det.quantity * (1 + bufferPercentage / 100)
              trackedProductsMap[pid].dailyDemand[day.dateStr] = (trackedProductsMap[pid].dailyDemand[day.dateStr] || 0) + Math.ceil(rawNeeded)
            }
          } else {
            const recipe = maps.recipeMap[det.recipeId]
            recipe?.receta_insumos?.forEach((ri: any) => {
              const pid = ri.producto_id
              if (trackedProductsMap[pid]) {
                const rawNeeded = (ri.cantidad_necesaria * det.quantity) * (1 + bufferPercentage / 100)
                trackedProductsMap[pid].dailyDemand[day.dateStr] = (trackedProductsMap[pid].dailyDemand[day.dateStr] || 0) + Math.ceil(rawNeeded)
              }
            })
          }
        })
      })

      // Compute Daily Inflows
      day.incomingPOs.forEach(po => {
        po.purchase_order_items?.forEach((poi: any) => {
          const pid = poi.producto_id
          if (trackedProductsMap[pid]) {
            trackedProductsMap[pid].dailyInflow[day.dateStr] = (trackedProductsMap[pid].dailyInflow[day.dateStr] || 0) + Number(poi.cantidad)
          }
        })
      })
    })

    // Calculate Sequential Day-by-Day Stock Balance
    const items = Object.values(trackedProductsMap).map(item => {
      let runningBalance = item.stockActual
      let minBal = runningBalance
      let stockout: string | null = null
      let totalDem = 0
      let totalInf = 0

      timelineDays.forEach(day => {
        const demand = item.dailyDemand[day.dateStr] || 0
        const inflow = item.dailyInflow[day.dateStr] || 0
        totalDem += demand
        totalInf += inflow

        runningBalance = runningBalance + inflow - demand
        item.dailyEndStock[day.dateStr] = runningBalance

        if (runningBalance < minBal) {
          minBal = runningBalance
        }

        if (runningBalance < 0 && !stockout) {
          stockout = day.dateStr
        }
      })

      item.totalDemand = totalDem
      item.totalInflow = totalInf
      item.minStockProjected = minBal
      item.stockoutDate = stockout
      item.totalDeficit = minBal < 0 ? Math.abs(minBal) : 0

      return item
    })

    const filtered = items.filter(it => it.totalDemand > 0 || it.stockActual > 0 || it.totalInflow > 0)

    filtered.sort((a, b) => {
      if (a.familyName !== b.familyName) return a.familyName.localeCompare(b.familyName)
      return a.name.localeCompare(b.name)
    })

    return {
      items: filtered,
      totalStockouts: filtered.filter(i => i.stockoutDate !== null).length
    }
  }, [timelineDays, rawData, maps, selectedEventIds, bufferPercentage])

  // --- Staggered Purchases Planner (Split into JIT Batches) ---
  const staggeredBatches = useMemo(() => {
    const batchList: {
      batchIndex: number
      title: string
      dateRangeStr: string
      suggestedDeliveryDate: string
      eventsCovered: EventSummary[]
      totalPax: number
      totalViandas: number
      itemsToOrder: {
        productId: string
        name: string
        unit: string
        familyName: string
        gramsPerUnit: number
        proveedorId?: string
        proveedorName?: string
        quantityNeeded: number
        bultos: number
      }[]
    }[] = []

    const validDays = timelineDays.filter(d => d.events.length > 0)
    if (validDays.length === 0) return []

    const chunkSize = Math.max(2, Math.ceil(validDays.length / 2))
    const chunks: DayColumn[][] = []
    for (let i = 0; i < validDays.length; i += chunkSize) {
      chunks.push(validDays.slice(i, i + chunkSize))
    }

    chunks.forEach((chunk, idx) => {
      const firstDay = chunk[0]
      const lastDay = chunk[chunk.length - 1]
      const deliveryDate = firstDay.dateStr

      const eventsInBatch: EventSummary[] = []
      let bPax = 0
      let bViandas = 0
      const batchIngredients: Record<string, number> = {}

      chunk.forEach(day => {
        day.events.forEach(ev => {
          if (!selectedEventIds.has(ev.id)) return
          eventsInBatch.push(ev)
          bPax += ev.totalPax
          bViandas += ev.adjustedPax

          ev.details.forEach(det => {
            if (det.category === 'bebida' && rawData.waterProduct) {
              const pid = rawData.waterProduct.id
              const rawNeeded = det.quantity * (1 + bufferPercentage / 100)
              batchIngredients[pid] = (batchIngredients[pid] || 0) + Math.ceil(rawNeeded)
            } else {
              const recipe = maps.recipeMap[det.recipeId]
              recipe?.receta_insumos?.forEach((ri: any) => {
                const pid = ri.producto_id
                const rawNeeded = (ri.cantidad_necesaria * det.quantity) * (1 + bufferPercentage / 100)
                batchIngredients[pid] = (batchIngredients[pid] || 0) + Math.ceil(rawNeeded)
              })
            }
          })
        })
      })

      if (eventsInBatch.length === 0) return

      const itemsToOrder = Object.entries(batchIngredients).map(([pid, qty]) => {
        const prod = maps.productMap[pid] || {}
        const size = Number(prod.gramos_por_unidad) > 0 ? Number(prod.gramos_por_unidad) : 1
        const bultos = Math.ceil(qty / size)

        return {
          productId: pid,
          name: prod.nombre || "Insumo",
          unit: prod.unidad_medida || "un",
          familyName: prod.familias?.nombre || "General",
          gramsPerUnit: size,
          proveedorId: prod.proveedor_id,
          proveedorName: prod.proveedores?.nombre || "Sin Proveedor",
          quantityNeeded: qty,
          bultos
        }
      }).sort((a, b) => a.familyName.localeCompare(b.familyName))

      batchList.push({
        batchIndex: idx + 1,
        title: `Lote ${idx + 1}: ${firstDay.dayNumber} ${firstDay.monthName} al ${lastDay.dayNumber} ${lastDay.monthName}`,
        dateRangeStr: `${firstDay.dayName} ${firstDay.dayNumber} - ${lastDay.dayName} ${lastDay.dayNumber} ${lastDay.monthName}`,
        suggestedDeliveryDate: deliveryDate,
        eventsCovered: eventsInBatch,
        totalPax: bPax,
        totalViandas: bViandas,
        itemsToOrder
      })
    })

    return batchList
  }, [timelineDays, selectedEventIds, maps, rawData, bufferPercentage])

  // --- Generate Staggered POs Action ---
  const handleGenerateStaggeredPOs = async (specificBatchIndex?: number) => {
    setGeneratingPOs(true)
    try {
      const batchesToExport = specificBatchIndex 
        ? staggeredBatches.filter(b => b.batchIndex === specificBatchIndex)
        : staggeredBatches

      if (batchesToExport.length === 0) {
        alert("No hay lotes con insumos para generar.")
        setGeneratingPOs(false)
        return
      }

      const allDrafts: any[] = []

      batchesToExport.forEach(batch => {
        const provGroups: Record<string, typeof batch.itemsToOrder> = {}
        batch.itemsToOrder.forEach(item => {
          const provId = item.proveedorId || 'SIN_PROVEEDOR'
          if (!provGroups[provId]) provGroups[provId] = []
          provGroups[provId].push(item)
        })

        Object.entries(provGroups).forEach(([provId, items]) => {
          allDrafts.push({
            proveedor_id: provId === 'SIN_PROVEEDOR' ? null : provId,
            proveedor_nombre: `${items[0].proveedorName} (Lote: ${batch.dateRangeStr})`,
            fecha_esperada: batch.suggestedDeliveryDate,
            items: items.map(item => ({
              producto_id: item.productId,
              nombre: item.name,
              unidad_medida: item.unit,
              bultos: item.bultos,
              unidadesPorBulto: item.gramsPerUnit,
              costoUnitario: 0,
              costoTotal: 0
            }))
          })
        })
      })

      localStorage.setItem("po_drafts", JSON.stringify(allDrafts))
      router.push("/inventario/ordenes-compra/sugeridas")
    } catch (err: any) {
      console.error(err)
      alert("Error al preparar lotes de compra: " + err.message)
      setGeneratingPOs(false)
    }
  }

  // --- Handlers ---
  const toggleEvent = (id: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenQuickPO = (dateStr: string, proveedorId?: string, productId?: string, deficitAmount?: number) => {
    setPoPrefillDate(dateStr)
    setPoPrefillProvId(proveedorId || "")
    if (productId) {
      const prod = maps.productMap[productId]
      const size = prod?.gramos_por_unidad || 1
      const deficit = Math.abs(deficitAmount || 0)
      const bultos = deficit > 0 ? Math.ceil(deficit / size) : 1
      setPoPrefillItems([{
        producto_id: productId,
        bultos: bultos,
        unidadesPorBulto: size,
        costoUnitario: 0,
        costoTotal: 0
      }])
    } else {
      setPoPrefillItems([])
    }
    setShowCreatePOModal(true)
  }

  const filteredStockItems = useMemo(() => {
    return stockEvolution.items.filter(item => {
      const matchFam = selectedFamily === "TODAS" || item.familyName === selectedFamily
      const matchSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.familyName.toLowerCase().includes(searchTerm.toLowerCase())
      return matchFam && matchSearch
    })
  }, [stockEvolution.items, selectedFamily, searchTerm])

  const availableFamilies = useMemo(() => {
    const fams = new Set<string>()
    stockEvolution.items.forEach(i => fams.add(i.familyName))
    return Array.from(fams).sort()
  }, [stockEvolution.items])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest animate-pulse">
          Calculando cronograma de 10 días y flujo de stock en tiempo real...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 -m-8 p-6 md:p-8 space-y-8 pb-32">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarDays size={18} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full text-indigo-700 border border-indigo-100/50">
              MRP · Planificador Just-In-Time
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Proyección & Cronograma de Abastecimiento
          </h1>
          <p className="text-slate-400 font-medium text-xs uppercase tracking-wider mt-1">
            Programá recepciones escalonadas y evitá el sobreacopio en cocina
          </p>
        </div>

        {/* CONTROLES DE FECHA Y COLCHÓN */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          
          {/* Rango de Días */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setStartDateOffset(prev => prev - rangeDays)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Período anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-1">
              {[10, 14, 21].map(days => (
                <button
                  key={days}
                  onClick={() => setRangeDays(days)}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    rangeDays === days 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {days} DÍAS
                </button>
              ))}
            </div>
            <button
              onClick={() => setStartDateOffset(prev => prev + rangeDays)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Período siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Margen / Colchón */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Shield size={16} />
              <span className="text-[10px] font-black uppercase tracking-wider">Margen:</span>
            </div>
            <span className="text-sm font-black text-emerald-700 w-8 tabular-nums">{bufferPercentage}%</span>
            <input 
              type="range" 
              min="0" 
              max="30" 
              step="5"
              value={bufferPercentage}
              onChange={(e) => setBufferPercentage(Number(e.target.value))}
              className="w-20 accent-emerald-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Toggle Ocultar Días Sin Movimientos */}
          <button
            onClick={() => setHideEmptyDays(prev => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border shadow-sm ${
              hideEmptyDays 
                ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/30' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Ocultar días sin shows ni órdenes de compra que ingresan"
          >
            {hideEmptyDays ? <EyeOff size={15} /> : <Eye size={15} className="text-slate-400" />}
            <span>Ocultar días sin movimientos</span>
            {emptyDaysCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                hideEmptyDays ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {emptyDaysCount}
              </span>
            )}
          </button>

          {/* Restaurar Días Ocultos */}
          {totalHiddenDaysCount > 0 && (
            <button
              onClick={restoreAllDays}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-all shadow-sm"
              title="Mostrar todos los días ocultos"
            >
              <Eye size={14} />
              <span>Mostrar todos ({totalHiddenDaysCount} ocultos)</span>
            </button>
          )}

          {/* Botón Refrescar / Actualizar Datos */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border shadow-sm ${
              refreshing 
                ? 'bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-indigo-100 hover:shadow-md active:scale-95'
            }`}
            title="Actualizar datos del calendario, consumos y órdenes de compra"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          {/* Reset Today */}
          {startDateOffset !== 0 && (
            <button
              onClick={() => setStartDateOffset(0)}
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black transition-all"
              title="Volver a hoy"
            >
              <CalendarIcon size={16} />
            </button>
          )}

        </div>
      </div>

      {/* TABS DE VISTA */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'timeline'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
            }`}
          >
            <CalendarDays size={16} />
            <span>1. Cronograma & Flujo de Stock ({rangeDays} Días)</span>
            {stockEvolution.totalStockouts > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
                {stockEvolution.totalStockouts} Quiebres
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('staggered')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'staggered'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Truck size={16} />
            <span>2. Compras Escalonadas (Lotes JIT)</span>
            <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full ml-1">
              {staggeredBatches.length} Lotes
            </span>
          </button>

          <button
            onClick={() => setActiveTab('consolidated')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'consolidated'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Layers size={16} />
            <span>3. Matriz Consolidada</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-xs font-bold text-slate-400">
          <span>Ventana: {new Date(dateWindow.startStr + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — {new Date(dateWindow.endStr + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CRONOGRAMA & FLUJO DE STOCK (10 DÍAS) */}
      {/* ========================================================================= */}
      {activeTab === 'timeline' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* TIMELINE HORIZONTAL DE DÍAS Y SHOWS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <CalendarIcon size={20} className="text-indigo-600" />
                Demanda Diaria y Recepciones Programadas
              </h2>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Deslizá horizontalmente para ver los {rangeDays} días
              </span>
            </div>

            <div className="overflow-x-auto pb-4 pt-1">
              <div className="flex gap-4 min-w-max">
                {displayedTimelineDays.map(day => (
                  <div 
                    key={day.dateStr}
                    className={`w-[290px] rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                      day.isToday 
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-md ring-2 ring-indigo-500/20' 
                        : day.events.length > 0
                          ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                          : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Cabecera del Día */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-black uppercase text-indigo-600 tracking-wider">
                              {day.dayName}
                            </p>
                            <button
                              onClick={() => toggleHideDay(day.dateStr)}
                              className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                              title="Ocultar este día de la vista"
                            >
                              <EyeOff size={11} />
                            </button>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-900">{day.dayNumber}</span>
                            <span className="text-xs font-black text-slate-400 uppercase">{day.monthName}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {day.isToday && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                              HOY
                            </span>
                          )}
                          <button
                            onClick={() => handleOpenQuickPO(day.dateStr)}
                            className="text-[10px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                            title="Programar entrega de proveedor para este día"
                          >
                            <Plus size={12} /> + Pedir Entrega
                          </button>
                        </div>
                      </div>

                      {/* Shows del Día */}
                      {day.events.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                            Sin shows programados
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 mb-4">
                          {day.events.map(ev => {
                            const isSelected = selectedEventIds.has(ev.id)
                            return (
                              <div
                                key={ev.id}
                                onClick={() => toggleEvent(ev.id)}
                                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="text-xs font-black uppercase tracking-tight truncate flex-1">
                                    {ev.show}
                                  </h4>
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                    isSelected ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-200 text-slate-500'
                                  }`}>
                                    {ev.adjustedPax} V.
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] opacity-70 mt-1">
                                  <span>{ev.totalPax} Pax Total</span>
                                  <span>{ev.details.length} tipos</span>
                                </div>

                                {/* Desglose por Empresa: Pasajeros y Venta Estimada */}
                                {ev.companies && ev.companies.length > 0 && (
                                  <div className={`mt-2.5 pt-2 border-t space-y-1.5 ${isSelected ? 'border-white/10' : 'border-slate-200'}`}>
                                    <p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                                      Empresas (PAX → Venta)
                                    </p>
                                    <div className="flex flex-col gap-1">
                                      {ev.companies.map((comp, cIdx) => (
                                        <div 
                                          key={cIdx} 
                                          className={`flex justify-between items-center px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                                            isSelected 
                                              ? 'bg-white/10 border-white/15 text-white shadow-xs' 
                                              : 'bg-white border-slate-200/80 text-slate-800 shadow-xs'
                                          }`}
                                        >
                                          <span className={`truncate max-w-[130px] font-medium ${isSelected ? 'text-indigo-200' : 'text-slate-600'}`} title={comp.companyName}>
                                            {comp.companyName}:
                                          </span>
                                          <span className="tabular-nums font-black whitespace-nowrap ml-1">
                                            {comp.pax} <span className="opacity-40">→</span> <strong className={`${isSelected ? 'text-emerald-300' : 'text-emerald-600'} font-black`}>{comp.adjustedSales}</strong>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Desglose por Receta / Formato de Vianda */}
                                {ev.details && ev.details.filter((d: any) => d.category !== 'bebida').length > 0 && (
                                  <div className={`mt-2 pt-2 border-t space-y-1 ${isSelected ? 'border-white/10' : 'border-slate-200'}`}>
                                    <p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                                      Formatos / Recetas
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {ev.details.filter((d: any) => d.category !== 'bebida').map((d: any, dIdx: number) => (
                                        <span
                                          key={dIdx}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border ${
                                            isSelected
                                              ? 'bg-white/10 border-white/15 text-indigo-100'
                                              : 'bg-indigo-50/70 border-indigo-100 text-indigo-700'
                                          }`}
                                          title={d.companies?.length > 0 ? d.companies.join(', ') : ''}
                                        >
                                          <strong>{d.quantity}x</strong> {d.recipeName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Resumen de Viandas del Día */}
                      {day.totalViandas > 0 && (
                        <div className="bg-slate-100/80 p-2.5 rounded-2xl mb-4 space-y-1 text-[10px] font-bold text-slate-600">
                          <div className="flex justify-between items-center text-slate-900 font-black">
                            <span>TOTAL PRODUCCIÓN:</span>
                            <span className="text-indigo-600 font-black">{day.totalViandas} viandas</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <div>Trad: <strong className="text-slate-800">{day.tradicional}</strong></div>
                            <div>Veg: <strong className="text-slate-800">{day.vegetariano}</strong></div>
                            <div>STACC: <strong className="text-slate-800">{day.sintacc}</strong></div>
                            <div>Bebidas: <strong className="text-slate-800">{day.bebidas}</strong></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fila de Recepciones / Órdenes que Llegan */}
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                        <Truck size={12} className="text-amber-500" />
                        Llegan Hoy ({day.incomingPOs.length})
                      </p>

                      {day.incomingPOs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No hay entregas programadas</p>
                      ) : (
                        <div className="space-y-1.5">
                          {day.incomingPOs.map(po => {
                            const isRecibida = po.estado === 'RECIBIDA'
                            const totalItemsCount = (po.purchase_order_items || []).reduce((acc: number, curr: any) => acc + (Number(curr.cantidad) || 0), 0)
                            return (
                              <div
                                key={po.id}
                                onClick={() => setSelectedPODetail(po)}
                                className={`p-2 rounded-xl border text-[10px] cursor-pointer hover:scale-[1.02] transition-transform ${
                                  isRecibida 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                    : 'bg-amber-50 border-amber-200 text-amber-900'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold">
                                  <span className="truncate">{po.proveedores?.nombre || 'Proveedor'}</span>
                                  <span className={`text-[8px] font-black px-1 rounded uppercase ${
                                    isRecibida ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                                  }`}>
                                    {po.estado}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] opacity-80 mt-0.5">
                                  <span>{po.purchase_order_items?.length || 0} ítems</span>
                                  <span>+{totalItemsCount.toLocaleString('es-AR')} un/gr</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MATRIZ DE STOCK EVOLUTIVO (DÍA A DÍA) */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Package size={22} className="text-indigo-600" />
                  Matriz de Stock Evolutivo (Día a Día)
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Stock Inicial + Compras que llegan − Consumo del show = Saldo Proyectado
                </p>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setSelectedFamily("TODAS")}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-colors ${
                      selectedFamily === "TODAS" ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    TODOS
                  </button>
                  {availableFamilies.map(fam => (
                    <button
                      key={fam}
                      onClick={() => setSelectedFamily(fam)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-colors whitespace-nowrap ${
                        selectedFamily === fam ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {fam}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Buscar insumo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border shadow-sm ${
                    refreshing
                      ? 'bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-50 text-indigo-600 border-slate-200 hover:border-indigo-200 active:scale-95'
                  }`}
                  title="Actualizar datos de stock y compras"
                >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
                  <span className="hidden sm:inline">{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
                </button>
              </div>
            </div>

            {/* TABLA HORIZONTAL CON COLUMNA FIJA */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider">
                    {/* Columna 1 Sticky */}
                    <th className="p-4 sticky left-0 z-30 bg-slate-900 w-[260px] min-w-[260px] max-w-[260px] align-bottom pb-3 border-r border-slate-800">
                      Insumo / Familia
                    </th>
                    {/* Columna 2 Sticky */}
                    <th className="p-4 text-center sticky left-[260px] z-30 bg-slate-800 w-[110px] min-w-[110px] max-w-[110px] align-bottom pb-3 border-r border-slate-700">
                      Stock Hoy
                    </th>
                    {/* Columna 3 Sticky */}
                    <th className="p-4 text-center sticky left-[370px] z-30 bg-slate-800 w-[110px] min-w-[110px] max-w-[110px] align-bottom pb-3 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.35)] border-r-2 border-slate-700">
                      En Tránsito
                    </th>
                    {displayedTimelineDays.map(day => (
                      <th 
                        key={day.dateStr} 
                        className={`p-4 text-left min-w-[210px] border-l border-slate-800 align-top ${
                          day.isToday ? 'bg-indigo-950 text-indigo-100 ring-1 ring-indigo-500/40' : 'bg-slate-900'
                        }`}
                      >
                        <div className="flex flex-col justify-between min-h-[160px] h-full">
                          {/* PARTE SUPERIOR: EMPRESAS Y PRODUCCIÓN */}
                          {day.events.length > 0 ? (
                            <div className="space-y-2.5">
                              {/* Totales de Producción del Día */}
                              <div className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center justify-between">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Producción:</span>
                                <span className="text-xs font-black text-emerald-300 tabular-nums">
                                  {day.totalViandas} v. <span className="text-[9px] opacity-70 font-normal">({day.totalPax} pax)</span>
                                </span>
                              </div>

                              {/* Desglose de Empresas (PAX → Venta) */}
                              {day.dayCompanies && day.dayCompanies.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-0.5">
                                    Empresas (PAX → Venta)
                                  </p>
                                  <div className="flex flex-col gap-1">
                                    {day.dayCompanies.map((c, cIdx) => (
                                      <div 
                                        key={cIdx} 
                                        className="flex items-center justify-between bg-white/10 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-white shadow-xs transition-colors"
                                      >
                                        <span className="text-slate-300 font-medium truncate max-w-[110px]" title={c.companyName}>
                                          {c.companyName}:
                                        </span>
                                        <span className="text-white font-black tabular-nums whitespace-nowrap ml-1">
                                          {c.pax} <span className="opacity-40">→</span> <span className="text-emerald-300 font-black">{c.adjustedSales}</span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-6 text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                              Sin shows
                            </div>
                          )}

                          {/* PARTE INFERIOR: FECHA DEL DÍA (PEGADA A LA GRILLA DE INSUMOS) */}
                          <div className="pt-2.5 mt-3 border-t border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs text-white uppercase tracking-tight">
                                {day.dayName.slice(0, 3)} {day.dayNumber} {day.monthName}
                              </span>
                              {day.isToday && (
                                <span className="text-[8px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black">
                                  HOY
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => toggleHideDay(day.dateStr)}
                              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                              title="Ocultar este día de la tabla"
                            >
                              <EyeOff size={12} />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={3 + displayedTimelineDays.length} className="p-12 text-center text-slate-400 font-bold uppercase">
                        No hay insumos para los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item, idx) => {
                      const hasQuiebre = item.stockoutDate !== null

                      return (
                        <tr key={item.productId} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          
                          {/* Columna 1: Insumo Sticky */}
                          <td className={`p-3.5 sticky left-0 z-20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} w-[260px] min-w-[260px] max-w-[260px] border-r border-slate-100`}>
                            <div className="font-black text-slate-900 truncate max-w-[230px]" title={item.name}>
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 mt-0.5">
                              <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded uppercase">
                                {item.familyName}
                              </span>
                              {item.proveedorName && (
                                <span className="truncate max-w-[120px] text-slate-500">
                                  · {item.proveedorName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Columna 2: Stock Actual Sticky */}
                          <td className={`p-3.5 text-center font-black text-slate-700 sticky left-[260px] z-20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} w-[110px] min-w-[110px] max-w-[110px] border-r border-slate-100`}>
                            {item.stockActual.toLocaleString('es-AR')}
                            <span className="text-[9px] text-slate-400 ml-1 uppercase">{item.unit}</span>
                          </td>

                          {/* Columna 3: En Tránsito Sticky */}
                          <td className={`p-3.5 text-center font-bold text-amber-600 sticky left-[370px] z-20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} w-[110px] min-w-[110px] max-w-[110px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)] border-r-2 border-slate-200`}>
                            {item.stockTransito > 0 ? `+${item.stockTransito.toLocaleString('es-AR')}` : '-'}
                          </td>

                          {/* Días del Cronograma */}
                          {displayedTimelineDays.map(day => {
                            const demand = item.dailyDemand[day.dateStr] || 0
                            const inflow = item.dailyInflow[day.dateStr] || 0
                            const endStock = item.dailyEndStock[day.dateStr] ?? item.stockActual
                            const isDeficit = endStock < 0

                            return (
                              <td 
                                key={day.dateStr}
                                className={`p-2.5 text-center border-l border-slate-100 transition-colors ${
                                  isDeficit 
                                    ? 'bg-rose-50/90 text-rose-900 ring-1 ring-inset ring-rose-300' 
                                    : day.isToday 
                                      ? 'bg-indigo-50/30' 
                                      : ''
                                }`}
                              >
                                <div className="space-y-1">
                                  {/* Flujo: Consumo vs Inflow */}
                                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                                    {demand > 0 ? (
                                      <span className="text-rose-600 font-bold" title="Consumo estimado">
                                        -{demand.toLocaleString('es-AR')}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}

                                    {inflow > 0 && (
                                      <span className="text-emerald-600 font-black bg-emerald-100/80 px-1 rounded" title="Llega Orden de Compra">
                                        +{inflow.toLocaleString('es-AR')}
                                      </span>
                                    )}
                                  </div>

                                  {/* Saldo Final Proyectado */}
                                  <div className="pt-0.5 border-t border-slate-200/50">
                                    <span className={`text-xs font-black tabular-nums ${
                                      isDeficit ? 'text-rose-700 font-black flex items-center justify-center gap-1' : 'text-slate-900'
                                    }`}>
                                      {isDeficit && <AlertTriangle size={12} className="text-rose-600 shrink-0 animate-bounce" />}
                                      {endStock.toLocaleString('es-AR')}
                                    </span>
                                  </div>

                                  {/* Botón rápido si hay quiebre */}
                                  {isDeficit && (
                                    <button
                                      onClick={() => handleOpenQuickPO(day.dateStr, item.proveedorId, item.productId, Math.abs(endStock))}
                                      className="w-full text-[8px] font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white py-1 px-1 rounded-md shadow-sm transition-colors mt-1 flex items-center justify-center gap-1"
                                      title={`Pedir ${Math.ceil(Math.abs(endStock) / (item.gramsPerUnit || 1))} bultos para cubrir el quiebre`}
                                    >
                                      <span>+ Pedir</span>
                                      <span className="bg-rose-900/60 text-rose-100 px-1 py-0.2 rounded font-black text-[7.5px]">
                                        {Math.ceil(Math.abs(endStock) / (item.gramsPerUnit || 1))} b.
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            )
                          })}

                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMPRAS ESCALONADAS (LOTES JIT) */}
      {/* ========================================================================= */}
      {activeTab === 'staggered' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          <div className="bg-gradient-to-r from-amber-500 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-amber-200 mb-1">
                <Truck size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                  Estrategia Just-In-Time (JIT)
                </span>
              </div>
              <h2 className="text-3xl font-black tracking-tight">Plan de Entregas Escalonadas</h2>
              <p className="text-white/80 font-medium text-xs mt-1 max-w-2xl leading-relaxed">
                Dividimos tus requerimientos en lotes de 2 a 3 entregas con fechas fijadas por evento. Así recibís la mercadería fresca justo a tiempo sin saturar la cocina.
              </p>
            </div>

            <button
              onClick={() => handleGenerateStaggeredPOs()}
              disabled={generatingPOs || staggeredBatches.length === 0}
              className="bg-white text-slate-900 hover:bg-amber-100 disabled:opacity-50 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all shrink-0"
            >
              {generatingPOs ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} className="text-amber-600" />}
              Generar Todas las Órdenes en Lotes
            </button>
          </div>

          {/* LISTA DE LOTES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {staggeredBatches.map(batch => (
              <div 
                key={batch.batchIndex}
                className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 md:p-8 space-y-6 flex flex-col justify-between"
              >
                <div>
                  {/* Cabecera del Lote */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                        {batch.title}
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
                        Entrega: {new Date(batch.suggestedDeliveryDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h3>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-slate-400">Total Producción</p>
                      <p className="text-xl font-black text-slate-900">{batch.totalViandas} viandas</p>
                      <p className="text-[10px] text-slate-500 font-bold">{batch.totalPax} Pax proyectados</p>
                    </div>
                  </div>

                  {/* Shows Cubiertos */}
                  <div className="space-y-1.5 mb-6">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Shows Cubiertos por este Lote ({batch.eventsCovered.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {batch.eventsCovered.map(ev => (
                        <span key={ev.id} className="bg-slate-100 text-slate-800 text-xs font-black px-3 py-1 rounded-xl border border-slate-200">
                          {ev.show} ({ev.adjustedPax} v.)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Insumos del Lote */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Insumos a Pedir para este Lote ({batch.itemsToOrder.length}):
                    </p>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                      {batch.itemsToOrder.map(item => (
                        <div key={item.productId} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs font-medium">
                          <div>
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[10px] text-slate-400">{item.proveedorName} · {item.familyName}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900">
                              {item.quantityNeeded.toLocaleString('es-AR')} {item.unit}
                            </span>
                            {item.gramsPerUnit > 1 && (
                              <div className="text-[10px] text-indigo-600 font-bold">
                                {item.bultos} bultos
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botón para generar solo este lote */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleGenerateStaggeredPOs(batch.batchIndex)}
                    className="bg-slate-900 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2"
                  >
                    <ShoppingCart size={14} />
                    Generar Órdenes para Lote {batch.batchIndex}
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MATRIZ CONSOLIDADA DE INSUMOS */}
      {/* ========================================================================= */}
      {activeTab === 'consolidated' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Explosión Consolidada de Materia Prima
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Total acumulado requerido para todos los shows seleccionados en el período
                </p>
              </div>

              <button
                onClick={() => handleGenerateStaggeredPOs()}
                disabled={generatingPOs}
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md flex items-center gap-2 transition-colors"
              >
                <ShoppingCart size={16} />
                Generar Órdenes de Compra
              </button>
            </div>

            {/* Grilla de Insumos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockEvolution.items.map(item => {
                const deficit = item.totalDeficit
                return (
                  <div 
                    key={item.productId}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                      deficit > 0 
                        ? 'bg-rose-50/50 border-rose-200' 
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                          {item.familyName}
                        </span>
                        {item.stockoutDate && (
                          <span className="text-[9px] font-black uppercase bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                            Quiebre: {item.stockoutDate}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                        {item.proveedorName || 'Sin Proveedor Asignado'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-end justify-between">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Stock / En Tránsito</p>
                        <p className="text-xs font-black text-slate-700">
                          {item.stockActual} <span className="text-[9px] text-slate-400">{item.unit}</span>
                          {item.stockTransito > 0 && <span className="text-amber-600 ml-1">(+{item.stockTransito})</span>}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Total Requerido</p>
                        <p className="text-xl font-black text-slate-900 tabular-nums">
                          {item.totalDemand.toLocaleString('es-AR')}
                          <span className="text-xs text-slate-400 ml-1 uppercase">{item.unit}</span>
                        </p>
                        {deficit > 0 && (
                          <button
                            onClick={() => handleOpenQuickPO(item.stockoutDate || dateWindow.startStr, item.proveedorId, item.productId, deficit)}
                            className="mt-1.5 text-[9px] font-black uppercase bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg shadow-sm transition-colors flex items-center gap-1 ml-auto"
                            title={`Pedir ${Math.ceil(deficit / (item.gramsPerUnit || 1))} bultos`}
                          >
                            + Pedir ({Math.ceil(deficit / (item.gramsPerUnit || 1))} b.)
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALLES DE ORDEN DE COMPRA SELECCIONADA */}
      {/* ========================================================================= */}
      {selectedPODetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Orden de Compra #{selectedPODetail.id.slice(0, 8)}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {selectedPODetail.proveedores?.nombre || 'Proveedor'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedPODetail(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha Esperada</span>
                <p className="font-black text-slate-900">{selectedPODetail.fecha_esperada || 'Sin Fecha'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Estado</span>
                <p className="font-black text-emerald-600">{selectedPODetail.estado}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Ítems a Recibir:</p>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                {selectedPODetail.purchase_order_items?.map((poi: any, idx: number) => (
                  <div key={idx} className="p-3 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{poi.productos?.nombre || 'Insumo'}</span>
                    <span className="font-black text-slate-900">
                      {poi.cantidad?.toLocaleString('es-AR')} {poi.productos?.unidad_medida}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedPODetail(null)}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR ORDEN DE COMPRA PRELLENADA */}
      {showCreatePOModal && (
        <CreatePOModal
          initialFechaEsperada={poPrefillDate}
          initialProveedorId={poPrefillProvId}
          initialItems={poPrefillItems}
          onClose={() => setShowCreatePOModal(false)}
          onSuccess={() => {
            setShowCreatePOModal(false)
            fetchData(true)
          }}
        />
      )}

    </div>
  )
}
