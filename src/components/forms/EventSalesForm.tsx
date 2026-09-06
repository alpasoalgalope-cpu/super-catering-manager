"use client";

import { generateAndDownloadSalesPdf } from '@/lib/pdf-generator';
import React, { useState, useMemo, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { supabase as defaultSupabase } from "@/lib/supabase"
import {
  Calculator, Truck, Users, Plus, Trash2, Calendar,
  ClipboardList, MapPin, AlertCircle, CheckCircle2,
  Save, Printer, Loader2, Building2, ChevronDown, ChevronUp
} from "lucide-react"
import FleetModal from "@/components/forms/FleetModal"
import CoordinatorModal from "@/components/forms/CoordinatorModal"
import { syncStockForSaleAction } from "@/app/actions/stock"

interface UnitRecord {
  id: string
  name: string
  vehicle_id: string
  coordinator_id: string
  sold: number
  liberated: number
  traditional: number
  vegetarian: number
  vegana: number
  sin_tacc: number
  water: number
  observations: string
  details: { id: string; category: string; qty: number; obs: string }[]
  isExpanded: boolean
}

interface EventMaster {
  id: string
  event_date: string
  show_name: string
  status: string
  venues?: { name: string; address?: string; meeting_point?: string }
  coordinators?: { id: string; name: string; phone?: string }
  event_projections?: { id: string; company_name: string; projected_pax: number }[]
}

const newUnit = (name: string): UnitRecord => ({
  id: crypto.randomUUID(),
  name,
  vehicle_id: "",
  coordinator_id: "",
  sold: 0, liberated: 0,
  traditional: 0, vegetarian: 0, vegana: 0, sin_tacc: 0,
  water: 0, observations: "", details: [], isExpanded: true,
})

export default function EventSalesForm({ initialEventId, initialCompany, commercialRules = [], coordinators: initCoordinators = [], vehicles: initVehicles = [], clients = [] }: any) {
  const supabase = createClient()
  // Master event selection
  const [events, setEvents] = useState<EventMaster[]>([])
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || "")
  const [selectedCompany, setSelectedCompany] = useState(initialCompany || "")
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [userRole, setUserRole] = useState<string>('admin')

  useEffect(() => {
    async function loadRole() {
      try {
        const clientSupabase = createClient()
        const { data: { user } } = await clientSupabase.auth.getUser()
        if (user?.email === 'alpaso.algalope@gmail.com' || user?.email === 'cocina@supercatering.com') {
          setUserRole('cocina')
        } else {
          const r = user?.app_metadata?.role || user?.user_metadata?.role || 'admin'
          setUserRole(r)
        }
      } catch (e) {
        console.error("Error loading role in EventSalesForm:", e)
      }
    }
    loadRole()
  }, [])

  // Modals state
  const [fleetModal, setFleetModal] = useState(false)
  const [coordModal, setCoordModal] = useState(false)
  const [vehicles, setVehicles] = useState(initVehicles)
  const [coordinators, setCoordinators] = useState(initCoordinators)

  // Quick Add Company to Event State
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false)
  const [newCompanyInput, setNewCompanyInput] = useState("")
  const [newPaxInput, setNewPaxInput] = useState(50)
  const [addingCompanyLoading, setAddingCompanyLoading] = useState(false)

  const handleAddCompanyToEvent = async () => {
    if (!selectedEventId || !newCompanyInput.trim()) return
    setAddingCompanyLoading(true)

    try {
      const companyName = newCompanyInput.trim()
      const pax = Number(newPaxInput) || 50

      // 1. Insert projection row into DB
      const { data: newProj, error } = await supabase
        .from('event_projections')
        .insert([{
          event_id: selectedEventId,
          company_name: companyName,
          projected_pax: pax
        }])
        .select()
        .single()

      if (error) throw error

      // 2. Update local state
      setEvents(prev => prev.map(e => {
        if (e.id !== selectedEventId) return e
        const existing = e.event_projections || []
        if (existing.some(p => p.company_name?.toLowerCase() === companyName.toLowerCase())) return e
        return {
          ...e,
          event_projections: [...existing, { id: newProj.id, company_name: companyName, projected_pax: pax }]
        }
      }))

      // 3. Select newly added company
      setSelectedCompany(companyName)
      setShowAddCompanyModal(false)
      setMessage({ type: 'success', text: `¡Empresa ${companyName} vinculada al evento con ${pax} pax!` })
    } catch (err: any) {
      console.error("Error al agregar empresa al evento:", err)
      alert("Error al agregar la empresa al evento: " + (err.message || 'Error desconocido'))
    } finally {
      setAddingCompanyLoading(false)
    }
  }

  // Edición en caliente
  const [savedHeaderId, setSavedHeaderId] = useState<string | null>(null)
  const [isFetchingData, setIsFetchingData] = useState(false)
  const [onlineSalesData, setOnlineSalesData] = useState<any>(null)

  // Form state
  const [skipStock, setSkipStock] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState("22:00")
  const [deliveryPoint, setDeliveryPoint] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [units, setUnits] = useState<UnitRecord[]>([newUnit("Micro 1")])
  const [paxOverride, setPaxOverride] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load events_master on mount
  useEffect(() => {
    supabase
      .from("events_master")
      .select("*, venues(name, address, meeting_point), coordinators(id, name, phone), event_projections(id, company_name, projected_pax)")
      .order("event_date", { ascending: true }) // Chronological order
      .then(({ data }) => {
        setEvents(data || [])
        setLoadingEvents(false)
      })
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // --- Derived Data ---
  const selectableEvents = useMemo(() => {
    if (skipStock) {
      // Historical mode: Show past events
      return events.filter(e => e.event_date < today)
    } else {
      // Normal mode: Show today + future events with specific active statuses
      const activeStatuses = ["pendiente", "confirmado", "proyectado", "Pendiente", "Confirmado"]
      return events.filter(e => e.event_date >= today && activeStatuses.includes(e.status))
    }
  }, [events, skipStock, today])

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId) || null, [events, selectedEventId])
  const availableCompanies = useMemo(() => selectedEvent?.event_projections?.map(p => p.company_name) || [], [selectedEvent])
  const projectedPax = useMemo(() => selectedEvent?.event_projections?.find(p => p.company_name === selectedCompany)?.projected_pax || 0, [selectedEvent, selectedCompany])

  // Pre-populate delivery point from venue or existing header
  useEffect(() => {
    if (!savedHeaderId) {
      if (selectedEvent?.venues?.meeting_point) {
        setDeliveryPoint(selectedEvent.venues.meeting_point)
      } else if (selectedEvent?.venues?.name) {
        setDeliveryPoint(selectedEvent.venues.name)
      }
      if (selectedEvent?.venues?.address) {
        setDeliveryAddress(selectedEvent.venues.address)
      }
    }
  }, [selectedEvent, savedHeaderId])

  // Reset company when event changes IF it wasn't pre-filled by link
  useEffect(() => {
    if (initialEventId === selectedEventId && initialCompany) return
    setSelectedCompany("")
  }, [selectedEventId])

  
  const applyOnlineSalesToUnits = (salesInfo: any, fallbackAssignedBuses: any[] = []) => {
    if (!salesInfo || !salesInfo.ordersByBus) return

    const busKeys = Object.keys(salesInfo.ordersByBus)
    if (busKeys.length === 0) return

    setUnits(prevUnits => {
      return busKeys.map((busName, idx) => {
        const b = salesInfo.ordersByBus[busName]
        const totalViandas = (b.trad || 0) + (b.veg || 0) + (b.vegan || 0) + (b.st || 0)
        
        // Preserve already assigned vehicle and coordinator if set, or pick from assignedBuses
        const existingU = prevUnits[idx] || prevUnits[0]
        const fallbackBus = fallbackAssignedBuses[idx] || fallbackAssignedBuses[0]
        const vId = existingU?.vehicle_id || fallbackBus?.vehicle_id || ""
        const cId = existingU?.coordinator_id || fallbackBus?.coordinator_id || ""

        return {
          id: existingU?.id || crypto.randomUUID(),
          name: busName || existingU?.name || `Micro ${idx + 1}`,
          vehicle_id: vId,
          coordinator_id: cId,
          sold: totalViandas,
          liberated: existingU?.liberated || 0,
          traditional: b.trad || 0,
          vegetarian: b.veg || 0,
          vegana: b.vegan || 0,
          sin_tacc: b.st || 0,
          water: totalViandas,
          observations: `Importado de Tienda Online (${salesInfo.totalOrders} pedidos)`,
          details: existingU?.details || [],
          isExpanded: true
        }
      })
    })

    setMessage({
      type: 'success',
      text: `¡Se importaron con éxito ${salesInfo.totalViandas} viandas desde la Tienda Online conservando chofer y coordinador!`
    })
  }

  // Auto-fetch data para Edición en Caliente
  useEffect(() => {
    const fetchExistingSale = async () => {
      if (!selectedEventId || !selectedCompany) {
        setSavedHeaderId(null)
        setOnlineSalesData(null)
        setUnits([newUnit("Micro 1")])
        return
      }

      setIsFetchingData(true)
      try {
        // 1. FETCH ASIGNACIONES LOGISTICAS PLANIFICADAS ANTES QUE NADA
        const cRecord = clients.find((c: any) => c.name?.toLowerCase() === selectedCompany.toLowerCase())
        let assignedBuses: any[] = []
        if (cRecord?.id) {
           const { data: ab } = await supabase
             .from('event_bus_assignments')
             .select('*')
             .eq('event_id', selectedEventId)
             .eq('client_id', cRecord.id)
           if (ab) assignedBuses = ab
        }

        // 2. FETCH ONLINE STORE ORDERS FOR THIS EVENT & COMPANY (Resilient multi-store search)
        let detectedOnlineSales: any = null
        try {
          const { data: stores } = await supabase
            .from('online_store_events')
            .select('id, title, slug')
            .eq('event_master_id', selectedEventId)

          const cleanSelected = (selectedCompany || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
          const matchedStores = (stores || []).filter(s => {
            const sTitle = (s.title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            const sSlug = (s.slug || '').toLowerCase()
            const sClean = cleanSelected.replace(/[^a-z0-9]/g, '')
            const sSlugComp = cleanSelected.replace(/\s+/g, '-')
            return sTitle.includes(cleanSelected) || sSlug.includes(sSlugComp) || (sClean && sSlug.includes(sClean))
          })

          const storeIds = matchedStores.map(s => s.id)

          if (storeIds.length > 0) {
            const { data: oOrders } = await supabase
              .from('online_orders')
              .select('*, online_customers(*)')
              .in('store_event_id', storeIds)
              .eq('status', 'paid')
              .order('created_at', { ascending: true })

            if (oOrders && oOrders.length > 0) {
              const ordersByBus: Record<string, { trad: number; veg: number; vegan: number; st: number; total: number }> = {}
              let trad = 0, veg = 0, vegan = 0, st = 0

              oOrders.forEach(o => {
                const rawBus = o.bus_identifier?.trim()
                const bName = (!rawBus || rawBus.toUpperCase() === 'N/A' || rawBus === '') ? "Micro 1" : rawBus
                if (!ordersByBus[bName]) {
                  ordersByBus[bName] = { trad: 0, veg: 0, vegan: 0, st: 0, total: 0 }
                }
                const t = Number(o.qty_tradicional) || 0
                const v = Number(o.qty_vegetariano) || 0
                const vg = Number(o.qty_vegano) || 0
                const s = Number(o.qty_sintacc) || 0
                
                ordersByBus[bName].trad += t
                ordersByBus[bName].veg += v
                ordersByBus[bName].vegan += vg
                ordersByBus[bName].st += s
                ordersByBus[bName].total += (t + v + vg + s)

                trad += t
                veg += v
                vegan += vg
                st += s
              })

              detectedOnlineSales = {
                storeTitle: matchedStores[0]?.title || selectedCompany,
                totalOrders: oOrders.length,
                totalViandas: trad + veg + vegan + st,
                trad, veg, vegan, stacc: st,
                ordersByBus,
                orders: oOrders
              }
              setOnlineSalesData(detectedOnlineSales)
            } else {
              setOnlineSalesData(null)
            }
          } else {
            setOnlineSalesData(null)
          }
        } catch (e) {
          console.error("Error checking online store orders:", e)
        }

        // 3. BUSCAR CABECERA MANUAL EXISTENTE
        const { data: header, error: hErr } = await supabase
          .from('event_sales_headers')
          .select('*')
          .eq('event_master_id', selectedEventId)
          .eq('company_name', selectedCompany)
          .maybeSingle()

        if (hErr) throw hErr

        if (header) {
          setSavedHeaderId(header.id)
          if (header.delivery_time) setDeliveryTime(header.delivery_time)
          if (header.delivery_point) setDeliveryPoint(header.delivery_point)
          if (header.delivery_address) setDeliveryAddress(header.delivery_address)
          if (header.pax_projected) setPaxOverride(header.pax_projected)

          // Buscar Unidades
          const { data: dbUnits, error: uErr } = await supabase
            .from('event_sales_units')
            .select('*')
            .eq('header_id', header.id)
            .order('created_at', { ascending: true })
          
          if (uErr) throw uErr

          if (dbUnits && dbUnits.length > 0) {
            const mappedUnits: UnitRecord[] = dbUnits.map(du => {
              let parsedDetails = []
              try {
                if (du.special_breakdown) {
                  parsedDetails = JSON.parse(du.special_breakdown).map((d: any) => ({
                    id: crypto.randomUUID(),
                    category: d.type,
                    qty: d.qty,
                    obs: d.note
                  }))
                }
              } catch (e) {}

              // Mapear el micro asignado
              let v_id = ""
              let c_id = ""
              if (assignedBuses.length > 0) {
                 const busRecord = assignedBuses.shift()
                 v_id = busRecord.vehicle_id || ""
                 c_id = busRecord.coordinator_id || ""
              }

              return {
                id: crypto.randomUUID(),
                name: du.unit_name || "Micro",
                vehicle_id: v_id,
                coordinator_id: c_id,
                sold: Number(du.sold_qty) || 0,
                liberated: Number(du.liberated_qty) || 0,
                traditional: Number(du.traditional) || 0,
                vegetarian: Number(du.vegetarian) || 0,
                vegana: Number(du.vegana) || 0,
                sin_tacc: Number(du.sin_tacc) || 0,
                water: Number(du.water_qty) || 0,
                observations: du.observations || "",
                details: parsedDetails,
                isExpanded: true
              }
            })
            setUnits(mappedUnits)
          } else {
            if (assignedBuses.length > 0) {
              setUnits(assignedBuses.map((ab, idx) => ({
                ...newUnit(`Micro ${idx + 1}`),
                vehicle_id: ab.vehicle_id || "",
                coordinator_id: ab.coordinator_id || ""
              })))
            } else {
              setUnits([newUnit("Micro 1")])
            }
          }
        } else {
          // NO HAY CABECERA MANUAL GUARDADA
          setSavedHeaderId(null)
          if (detectedOnlineSales && detectedOnlineSales.totalViandas > 0) {
            applyOnlineSalesToUnits(detectedOnlineSales, assignedBuses)
          } else if (assignedBuses.length > 0) {
            setUnits(assignedBuses.map((ab, idx) => ({
              ...newUnit(`Micro ${idx + 1}`),
              vehicle_id: ab.vehicle_id || "",
              coordinator_id: ab.coordinator_id || ""
            })))
          } else {
            setUnits([newUnit("Micro 1")])
          }
          setDeliveryTime("22:00")
        }
      } catch (err: any) {
        console.error("Error cargando venta existente", err)
      } finally {
        setIsFetchingData(false)
      }
    }

    fetchExistingSale()
    setPaxOverride(null)
  }, [selectedEventId, selectedCompany, clients])
  // --- Commercial Rule ---
  const activeRule = useMemo(() => {
    if (!selectedCompany) return null
    // Primero buscar por ID (más seguro)
    const cRecord = clients.find((c: any) => c.name?.toLowerCase().trim() === selectedCompany?.toLowerCase().trim())
    const cRule = commercialRules.find((r: any) => 
      (r.client_id && r.client_id === cRecord?.id) || 
      (r.company_name?.toLowerCase().trim() === selectedCompany?.toLowerCase().trim())
    )
    
    let rule = cRule ? { ...cRule } : null

    // Fallback si no hay regla en commercial_rules pero existe cliente
    if (!rule && cRecord) {
      rule = {
        company_name: cRecord.name,
        price_base: cRecord.vianda_price || 8500,
        price_sintacc_base: cRecord.sintacc_price || cRecord.vianda_price || 8500,
        price_sintacc_threshold: 10000,
        sintacc_limit_pct: cRecord.sintacc_included_pct || 5,
        free_unit_step: cRecord.free_unit_step || null,
        coordinator_included: true,
        driver_included: true,
        includes_water: true,
        noRuleFound: false
      }
    }

    if (rule) {
      // Load custom tier config from localStorage if available
      let customConfig: any = {}
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`commercial_tier_config_${rule.id}`) || 
                      localStorage.getItem(`commercial_tier_config_${selectedCompany.trim().toLowerCase()}`)
          if (raw) customConfig = JSON.parse(raw)
        } catch (e) {
          console.error(e)
        }
      }

      const isMayoristaDefault = Boolean(
        selectedCompany?.toLowerCase().includes("rock") || 
        selectedCompany?.toLowerCase().includes("terco") || 
        cRecord?.sale_type?.toLowerCase() === 'mayorista'
      )

      rule.is_mayorista = customConfig.is_mayorista ?? isMayoristaDefault
      rule.tier_10_enabled = customConfig.tier_10_enabled ?? rule.coordinator_included ?? true
      rule.tier_10_water = customConfig.tier_10_water ?? false
      rule.tier_30_enabled = customConfig.tier_30_enabled ?? rule.driver_included ?? true
      rule.tier_50_enabled = customConfig.tier_50_enabled ?? rule.includes_water ?? true
      rule.tier_70_enabled = customConfig.tier_70_enabled ?? true
      rule.tier_70_bonus = customConfig.tier_70_bonus !== undefined ? Number(customConfig.tier_70_bonus) : 10000
      rule.commission_per_unit = customConfig.commission_per_unit !== undefined ? Number(customConfig.commission_per_unit) : 1000
    }

    // Terco Tour NUNCA incluye agua
    if (rule && (selectedCompany.toLowerCase().includes("terco tour") || rule.company_name?.toLowerCase().includes("terco tour"))) {
      rule.includes_water = false
      rule.tier_50_enabled = false
    }

    return rule
  }, [selectedCompany, commercialRules, clients])

  // --- Unit Handlers ---
  const addUnit = () => setUnits(prev => [...prev, newUnit(`Micro ${prev.length + 1}`)])
  const removeUnit = (id: string) => setUnits(prev => prev.length > 1 ? prev.filter(u => u.id !== id) : prev)

  const updateUnit = useCallback((id: string, field: keyof UnitRecord, value: any) => {
    setUnits(prev => prev.map(u => {
      if (u.id !== id) return u
      const updated = { ...u, [field]: value }
      
      // Auto-logic: If liberated units change, add/subtract from traditional category by default
      if (field === 'liberated') {
        const diff = (Number(value) || 0) - (Number(u.liberated) || 0)
        updated.traditional = (Number(updated.traditional) || 0) + diff
      }

      if (field === 'sold' || field === 'liberated') {
        const isNoWater = selectedCompany?.toLowerCase().includes("terco") || (activeRule && activeRule.includes_water === false)
        const isMayorista = Boolean(activeRule?.is_mayorista) || selectedCompany?.toLowerCase().includes("rock") || selectedCompany?.toLowerCase().includes("terco")
        const pax = paxOverride !== null ? paxOverride : (projectedPax || 0)
        const soldNum = Number(updated.sold) || 0
        const libNum = Number(updated.liberated) || 0
        const ocupationPct = pax > 0 ? (soldNum / pax) * 100 : 0
        
        if (isNoWater) {
          updated.water = 0
        } else if (isMayorista) {
          updated.water = soldNum + libNum
        } else {
          // Minorista por escala
          if (ocupationPct >= 50 && (activeRule?.tier_50_enabled ?? true)) {
            updated.water = soldNum + libNum
          } else {
            const coordiWater = (activeRule?.tier_10_enabled ?? true) && Boolean(activeRule?.tier_10_water) && ocupationPct >= 10 && libNum > 0 ? 1 : 0
            updated.water = soldNum + coordiWater
          }
        }
      }
      return updated
    }))
  }, [activeRule, selectedCompany, paxOverride, projectedPax])

  // Recalcular agua si cambia la regla o la ocupación
  useEffect(() => {
    const isNoWater = selectedCompany?.toLowerCase().includes("terco") || (activeRule && activeRule.includes_water === false)
    const isMayorista = Boolean(activeRule?.is_mayorista) || selectedCompany?.toLowerCase().includes("rock") || selectedCompany?.toLowerCase().includes("terco")
    const pax = paxOverride !== null ? paxOverride : (projectedPax || 0)

    setUnits(prev => prev.map(u => {
      const soldNum = Number(u.sold) || 0
      const libNum = Number(u.liberated) || 0
      const ocupationPct = pax > 0 ? (soldNum / pax) * 100 : 0

      let expectedWater = 0
      if (isNoWater) {
        expectedWater = 0
      } else if (isMayorista) {
        expectedWater = soldNum + libNum
      } else {
        // Minorista por escala
        if (ocupationPct >= 50 && (activeRule?.tier_50_enabled ?? true)) {
          expectedWater = soldNum + libNum
        } else {
          const coordiWater = (activeRule?.tier_10_enabled ?? true) && Boolean(activeRule?.tier_10_water) && ocupationPct >= 10 && libNum > 0 ? 1 : 0
          expectedWater = soldNum + coordiWater
        }
      }
      
      if (u.water !== expectedWater) return { ...u, water: expectedWater }
      return u
    }))
  }, [activeRule, selectedCompany, projectedPax, paxOverride])

  // --- Totals & Validation ---
  const totals = useMemo(() => {
    const consolidated = units.reduce((acc, u) => ({
      sold: acc.sold + (Number(u.sold) || 0),
      liberated: acc.liberated + (Number(u.liberated) || 0),
      trad: acc.trad + (Number(u.traditional) || 0),
      veg: acc.veg + (Number(u.vegetarian) || 0),
      vegan: acc.vegan + (Number(u.vegana) || 0),
      st: acc.st + (Number(u.sin_tacc) || 0),
      water: acc.water + (Number(u.water) || 0)
    }), { sold: 0, liberated: 0, trad: 0, veg: 0, vegan: 0, st: 0, water: 0 })

    const unitsValidity = units.map(u => {
      const sumCat = (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0)
      const sumOp = (Number(u.sold) || 0) + (Number(u.liberated) || 0)
      return { id: u.id, isValid: sumCat === sumOp }
    })

    const isRVTraslados = selectedCompany?.toLowerCase().includes("rv traslados") || activeRule?.company_name?.toLowerCase().includes("rv traslados")
    const isProximaEstacion = selectedCompany?.toLowerCase().includes("proxima") || selectedCompany?.toLowerCase().includes("próxima") || activeRule?.company_name?.toLowerCase().includes("proxima") || activeRule?.company_name?.toLowerCase().includes("próxima")
    const isValBus = selectedCompany?.toLowerCase().includes("valbus") || activeRule?.company_name?.toLowerCase().includes("valbus")
    const isRockEnLasVenas = selectedCompany?.toLowerCase().includes("rock") || activeRule?.company_name?.toLowerCase().includes("rock")
    const isTercoTour = selectedCompany?.toLowerCase().includes("terco") || activeRule?.company_name?.toLowerCase().includes("terco")
    const isMayorista = Boolean(activeRule?.is_mayorista) || isRockEnLasVenas || isTercoTour

    const pax = paxOverride !== null ? paxOverride : (projectedPax || 0)
    const ocupationPct = pax > 0 ? (consolidated.sold / pax) * 100 : 0

    let CupoGratis = 0
    let SinTaccExcedentes = 0
    let SinTaccFacturables = 0
    let price_base = Number(activeRule?.price_base) || (isRVTraslados || isProximaEstacion ? 10000 : isValBus ? 8500 : isRockEnLasVenas ? 7000 : isTercoTour ? 6000 : 7000)
    let price_sintacc_effective = Number(activeRule?.price_sintacc_base) || (isRVTraslados || isProximaEstacion ? 13000 : isValBus ? 10000 : price_base)
    let price_sintacc_threshold = Number(activeRule?.price_sintacc_threshold) || 10000

    let amount = 0
    let rvValidationErrors: string[] = []

    // Dynamic scale settings from activeRule / localStorage
    const tier10Enabled = activeRule?.tier_10_enabled ?? true
    const tier10Water = Boolean(activeRule?.tier_10_water)
    const tier30Enabled = activeRule?.tier_30_enabled ?? true
    const tier50Enabled = activeRule?.tier_50_enabled ?? (!isTercoTour)
    const tier70Enabled = activeRule?.tier_70_enabled ?? true
    const tier70Bonus = activeRule?.tier_70_bonus !== undefined ? Number(activeRule.tier_70_bonus) : 10000
    const commissionPerUnit = activeRule?.commission_per_unit !== undefined ? Number(activeRule.commission_per_unit) : 1000
    const commissionAmount = (consolidated.sold * commissionPerUnit) + (tier70Enabled && ocupationPct >= 70 ? tier70Bonus : 0)

    if (isMayorista) {
      // MAYORISTA: Tripulación SIEMPRE liberada (1 a 3 por coche sin umbral de ocupación)
      const commonViandas = consolidated.trad + consolidated.veg + consolidated.vegan

      // Check if liberadas exceeds common viandas (Sin TACC cannot be liberated!)
      if (consolidated.liberated > commonViandas) {
        rvValidationErrors.push(
          `Las viandas Sin TACC no pueden liberarse. Tenés ${consolidated.liberated} liberadas pero solo ${commonViandas} viandas comunes (Trad/Veg/Vegan) para absorberlas.`
        )
      }

      const totalUnitsCount = units.length
      const maxLiberadasAllowed = totalUnitsCount * 3

      if (consolidated.liberated > maxLiberadasAllowed) {
        rvValidationErrors.push(
          `Se liberan únicamente tripulación (máximo 3 por coche: ${maxLiberadasAllowed} para ${totalUnitsCount} coche(s)). Tenés ${consolidated.liberated} asignadas.`
        )
      }

      // Cupo Sin TACC % de tolerancia:
      SinTaccFacturables = consolidated.st
      const limitPct = Number(activeRule?.sintacc_limit_pct || 5)
      CupoGratis = Math.ceil(pax * (limitPct / 100))
      SinTaccExcedentes = Math.max(0, SinTaccFacturables - CupoGratis)
      const sinTaccEnCupo = Math.min(SinTaccFacturables, CupoGratis)

      const commonFacturables = Math.max(0, commonViandas - consolidated.liberated)
      amount = (commonFacturables * price_base) + 
               (sinTaccEnCupo * price_base) + 
               (SinTaccExcedentes * price_sintacc_threshold)

    } else if (isRVTraslados || isProximaEstacion) {
      const companyLabel = isProximaEstacion ? 'Próxima Estación' : 'RV Traslados'

      // 1. Common viandas (Trad + Veg + Vegan)
      const commonViandas = consolidated.trad + consolidated.veg + consolidated.vegan

      // Check if liberadas exceeds common viandas (Sin TACC cannot be liberated!)
      if (consolidated.liberated > commonViandas) {
        rvValidationErrors.push(
          `En ${companyLabel} las viandas Sin TACC no pueden liberarse ($${price_sintacc_effective.toLocaleString('es-AR')} c/u). Tenés ${consolidated.liberated} liberadas pero solo ${commonViandas} viandas comunes (Trad/Veg/Vegan) para absorberlas.`
        )
      }

      // 2. Occupation scale limit:
      let maxLiberadasAllowed = 0
      if (tier30Enabled && ocupationPct >= 30) {
        maxLiberadasAllowed = 3
      } else if (tier10Enabled && ocupationPct >= 10) {
        maxLiberadasAllowed = 1
      }

      if (consolidated.liberated > maxLiberadasAllowed) {
        rvValidationErrors.push(
          `Con ${ocupationPct.toFixed(1)}% de ocupación (${consolidated.sold} vendidos de ${pax} pax proyectados), ${companyLabel} permite como máximo ${maxLiberadasAllowed} vianda(s) liberada(s). Tenés ${consolidated.liberated} asignada(s).`
        )
      }

      const commonFacturables = Math.max(0, commonViandas - consolidated.liberated)
      amount = (commonFacturables * price_base) + (consolidated.st * price_sintacc_effective)

      SinTaccFacturables = consolidated.st
      SinTaccExcedentes = 0
      CupoGratis = 0

    } else if (isValBus) {
      // 1. Common viandas (Trad + Veg + Vegan)
      const commonViandas = consolidated.trad + consolidated.veg + consolidated.vegan

      // Check if liberadas exceeds common viandas (Sin TACC cannot be liberated!)
      if (consolidated.liberated > commonViandas) {
        rvValidationErrors.push(
          `En ValBus las viandas Sin TACC no pueden liberarse ($${price_sintacc_effective.toLocaleString('es-AR')} c/u). Tenés ${consolidated.liberated} liberadas pero solo ${commonViandas} viandas comunes (Trad/Veg/Vegan) para absorberlas.`
        )
      }

      // 2. Max 1 liberada per vehicle at >=10% occupation (no coordinators, driver only)
      const totalUnitsCount = units.length
      const maxLiberadasAllowed = (tier10Enabled && ocupationPct >= 10) ? totalUnitsCount : 0

      if (consolidated.liberated > maxLiberadasAllowed) {
        if (ocupationPct < 10) {
          rvValidationErrors.push(
            `Con ${ocupationPct.toFixed(1)}% de ocupación (<10%), ValBus no permite liberar viandas.`
          )
        } else {
          rvValidationErrors.push(
            `ValBus trabaja únicamente con chofer, permitiendo como máximo 1 vianda liberada por coche (${maxLiberadasAllowed} para ${totalUnitsCount} coche(s)). Tenés ${consolidated.liberated} asignada(s).`
          )
        }
      }

      const commonFacturables = Math.max(0, commonViandas - consolidated.liberated)
      amount = (commonFacturables * price_base) + (consolidated.st * price_sintacc_effective)

      SinTaccFacturables = consolidated.st
      SinTaccExcedentes = 0
      CupoGratis = 0

    } else {
      // Standard calculation for other companies
      SinTaccFacturables = Math.max(0, consolidated.st - consolidated.liberated)
      const limitPct = Number(activeRule?.sintacc_limit_pct || 0)
      CupoGratis = Math.ceil(pax * (limitPct / 100))
      SinTaccExcedentes = Math.max(0, SinTaccFacturables - CupoGratis)

      price_sintacc_effective = Number(activeRule?.special_sintacc_price) > 0
        ? Number(activeRule.special_sintacc_price)
        : Number(activeRule?.price_sintacc_base || price_base)

      amount = (consolidated.sold * price_base) +
        (SinTaccFacturables * (price_sintacc_effective - price_base)) +
        (SinTaccExcedentes * (price_sintacc_threshold - price_sintacc_effective))
    }

    const allValid = unitsValidity.every(v => v.isValid) && 
                     selectedEventId !== "" && 
                     selectedCompany !== "" && 
                     rvValidationErrors.length === 0

    return {
      ...consolidated,
      totalViandas: consolidated.sold + consolidated.liberated,
      CupoGratis,
      SinTaccExcedentes,
      SinTaccFacturables,
      amount,
      commissionAmount,
      commissionPerUnit,
      tier10Enabled,
      tier10Water,
      tier30Enabled,
      tier50Enabled,
      tier70Enabled,
      tier70Bonus,
      allValid,
      unitsValidity,
      price_base,
      price_sintacc_effective,
      price_sintacc_threshold,
      hasSpecialSinTaccPrice: Number(activeRule?.special_sintacc_price) > 0,
      isRVTraslados,
      isProximaEstacion,
      isValBus,
      isRockEnLasVenas,
      isTercoTour,
      isMayorista,
      pax,
      ocupationPct,
      rvValidationErrors
    }
  }, [units, activeRule, projectedPax, paxOverride, selectedEventId, selectedCompany])

  // --- Save / Update ---
  const saveAll = async () => {
    if (!totals?.allValid) return
    setLoading(true)
    setMessage(null)
    try {
      const payload = {
        event_id: selectedEventId,
        event_master_id: selectedEventId,
        company: selectedCompany,
        company_name: selectedCompany,
        event_date: selectedEvent?.event_date,
        venue: selectedEvent?.venues?.name,
        coordinator_name: selectedEvent?.coordinators?.name,
        delivery_time: deliveryTime,
        delivery_point: deliveryPoint,
        delivery_address: deliveryAddress,
        pax_projected: paxOverride !== null ? paxOverride : projectedPax,
        total_amount: totals.amount
      }

      let headerId = savedHeaderId

      let header
      if (savedHeaderId) {
        const { data, error: hErr } = await supabase
          .from('event_sales_headers')
          .update(payload)
          .eq('id', savedHeaderId)
          .select()
          .single()
        if (hErr) throw hErr
        header = data
      } else {
        const { data, error: hErr } = await supabase
          .from('event_sales_headers')
          .insert([payload])
          .select()
          .single()
        if (hErr) throw hErr
        header = data
      }

      // Sync updated pax_projected to event_projections table in database
      const finalPax = paxOverride !== null ? paxOverride : projectedPax
      if (selectedEventId && selectedCompany) {
        await supabase
          .from('event_projections')
          .update({ projected_pax: finalPax })
          .eq('event_id', selectedEventId)
          .eq('company_name', selectedCompany)
      }

      headerId = header.id

      // LIMPIAR DEPENDENCIAS ANTERIORES SI ESTAMOS ACTUALIZANDO
      if (savedHeaderId) {
         await supabase.from('event_sales_units').delete().eq('header_id', savedHeaderId)
      }

      // SIEMPRE LIMPIAR BUS ASSIGNMENTS VIEJOS (Vengan de planning o de ventas anteriores)
      const validClientRecord = clients.find((c: any) => c.name?.toLowerCase() === selectedCompany?.toLowerCase())
      const cId = validClientRecord?.id
      if (cId) {
         await supabase.from('event_bus_assignments').delete()
           .eq('event_id', selectedEventId)
           .eq('client_id', cId)
      }

      // INSERTAR NUEVAS UNIDADES
      const unitsToInsert = units.map(u => {
        const breakdown = u.details.map(d => ({
          type: d.category,
          qty: d.qty,
          note: d.obs
        }))
        return {
          header_id: headerId,
          unit_name: u.name,
          sold_qty: u.sold,
          liberated_qty: u.liberated,
          traditional: u.traditional,
          vegetarian: u.vegetarian,
          vegana: u.vegana,
          sin_tacc: u.sin_tacc,
          water_qty: u.water,
          special_breakdown: breakdown.length > 0 ? JSON.stringify(breakdown) : null,
          traditional_special: breakdown.filter(b => b.type === 'traditional').reduce((a, b) => a + b.qty, 0),
          vegetarian_special: breakdown.filter(b => b.type === 'vegetarian').reduce((a, b) => a + b.qty, 0),
          vegana_special: breakdown.filter(b => b.type === 'vegana').reduce((a, b) => a + b.qty, 0),
          observations: u.observations,
          recipe_trad_id: activeRule?.recipe_trad_id,
          recipe_veg_id: activeRule?.recipe_veg_id,
          recipe_vegan_id: activeRule?.recipe_vegan_id,
          recipe_sintacc_id: activeRule?.recipe_sintacc_id,
          coordinator_id: u.coordinator_id || null
        }
      })

      const { error: uErr } = await supabase.from('event_sales_units').insert(unitsToInsert)
      if (uErr) throw uErr

      // DEDUCT STOCK FOR NEW UNITS
      if (headerId && !skipStock) {
         await syncStockForSaleAction(headerId)
      }

      // INSERTAR NUEVA FLOTA
      const busesToSave = units.filter(u => u.vehicle_id || u.coordinator_id).map(u => ({
         event_id: selectedEventId,
         client_id: cId,
         vehicle_id: u.vehicle_id || null,
         coordinator_id: u.coordinator_id || null
      }))
      
      if (busesToSave.length > 0) {
         const { error: bErr } = await supabase.from('event_bus_assignments').insert(busesToSave)
         if (bErr) throw bErr
      }
      
      // ACTUALIZAR COMISIONES EN EL MAESTRO DE EVENTOS
      if (selectedCompany?.toUpperCase().includes('RV TRASLADOS')) {
        const totalSold = units.reduce((acc, u) => acc + (Number(u.sold) || 0), 0)
        const pax = paxOverride !== null ? paxOverride : (projectedPax || 0)
        const ocupationPct = pax > 0 ? (totalSold / pax) * 100 : 0
        let commission = totalSold * 1000
        if (ocupationPct >= 70) {
          commission += 10000 // Bonus $10.000 por superar 70% ocupación
        }
        await supabase
          .from('events_master')
          .update({ commissions_cost: commission })
          .eq('id', selectedEventId)
      } else if (selectedCompany?.toUpperCase().includes('PROXIMA ESTACION') || selectedCompany?.toUpperCase().includes('PRÓXIMA ESTACIÓN')) {
        // En Próxima Estación la comisión es $1.000 por vianda a la EMPRESA, SIN bonus al 70%
        const totalSold = units.reduce((acc, u) => acc + (Number(u.sold) || 0), 0)
        const commission = totalSold * 1000
        await supabase
          .from('events_master')
          .update({ commissions_cost: commission })
          .eq('id', selectedEventId)
      }

      // Persistir estado de edición
      setSavedHeaderId(headerId)
      setMessage({ type: 'success', text: `¡Venta ${savedHeaderId ? 'actualizada' : 'guardada'} para ${selectedCompany}!` })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Error al guardar" })
    } finally {
      setLoading(false)
    }
  }

  // --- Delete ---
  const handleDelete = async () => {
    if (!savedHeaderId) return
    const sure = window.confirm(`ATENCIÓN DOBLE SEGURO:\n¿Estás absolutamente seguro de eliminar toda la carga y asignaciones de flota de ${selectedCompany} para este evento? Esta acción no se puede deshacer.`)
    if (!sure) return

    setLoading(true)
    setMessage(null)
    try {
      // 1. Borrar Flota
      const validClientRecord = clients.find((c: any) => c.name?.toLowerCase() === selectedCompany?.toLowerCase())
      if (validClientRecord?.id) {
          await supabase.from('event_bus_assignments').delete()
            .eq('event_id', selectedEventId)
            .eq('client_id', validClientRecord.id)
      }
      
      // 2. Borrar Units primero para que la sincronización calcule consumo deseado = 0
      await supabase.from('event_sales_units').delete().eq('header_id', savedHeaderId)

      // 3. Sincronizar stock (calculará reversión delta total automática)
      await syncStockForSaleAction(savedHeaderId)

      // 4. Borrar Header
      const { error: dErr } = await supabase.from('event_sales_headers').delete().eq('id', savedHeaderId)
      if (dErr) throw dErr

      // Reset
      setSavedHeaderId(null)
      setUnits([newUnit("Micro 1")])
      setDeliveryTime("")
      setMessage({ type: 'success', text: `Carga eliminada por completo.` })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Error al eliminar" })
    } finally {
      setLoading(false)
    }
  }

  // --- PDF Export Controller (Direct Instant Vector Download) ---
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)

  const handlePrint = async (mode: any = 'all') => {
    const selectedMode: 'all' | 'remito' | 'passengers' = (mode === 'remito' || mode === 'passengers') ? mode : 'all'

    if (!selectedEvent) {
      alert("Por favor selecciona un evento primero.")
      return
    }

    setDownloadingPdf(selectedMode)

    try {
      // Fetch all paid online orders directly from database for absolute certainty
      let onlineOrdersList: any[] = []
      if (selectedEventId && selectedCompany) {
        try {
          const { data: stores } = await supabase
            .from('online_store_events')
            .select('id, title, slug')
            .eq('event_master_id', selectedEventId)

          const cleanSelected = (selectedCompany || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          const matchedStores = (stores || []).filter(s => {
            const sTitle = (s.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            const sSlug = (s.slug || '').toLowerCase()
            const sClean = cleanSelected.replace(/[^a-z0-9]/g, '')
            const sSlugComp = cleanSelected.replace(/\s+/g, '-')
            return sTitle.includes(cleanSelected) || sSlug.includes(sSlugComp) || (sClean && sSlug.includes(sClean))
          })

          const storeIds = matchedStores.map(s => s.id)
          if (storeIds.length > 0) {
            const { data: oOrders } = await supabase
              .from('online_orders')
              .select('*, online_customers(*)')
              .in('store_event_id', storeIds)
              .eq('status', 'paid')
              .order('created_at', { ascending: true })

            if (oOrders) onlineOrdersList = oOrders
          }
        } catch (e) {
          console.error("Error fetching online orders for PDF:", e)
        }
      }

      if (selectedMode === 'passengers' && onlineOrdersList.length === 0) {
        alert(`No se encontraron pedidos online pagados para ${selectedCompany} en este evento.`)
        setDownloadingPdf(null)
        return
      }

      // Generate and trigger direct instant browser download!
      generateAndDownloadSalesPdf({
        mode: selectedMode,
        selectedEvent,
        selectedCompany,
        deliveryTime,
        deliveryPoint,
        units,
        vehicles,
        coordinators,
        onlineOrders: onlineOrdersList
      })
    } catch (err: any) {
      console.error("Error generating PDF:", err)
      alert("Error al generar PDF: " + (err.message || 'Error desconocido'))
    } finally {
      setDownloadingPdf(null)
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-32">

      {/* BANNER DE IMPORTACIÓN DESDE TIENDA ONLINE */}
      {onlineSalesData && (
        <div id="online-sales-import-banner" className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-[2rem] p-6 shadow-lg shadow-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-2.5 py-0.5 rounded-md">
              🛒 Tienda Online Detectada
            </span>
            <h3 className="text-xl font-black uppercase tracking-tight">
              {onlineSalesData.totalOrders} Pedidos Pagados ({onlineSalesData.totalViandas} Viandas Totales)
            </h3>
            <p className="text-xs font-semibold text-white/90">
              Desglose: 🥪 {onlineSalesData.trad} Tradicionales | 🥗 {onlineSalesData.veg} Veg | 🌾 {onlineSalesData.stacc} Sin TACC | 🌱 {onlineSalesData.vegan} Veganas
            </p>
          </div>

          <button
            type="button"
            onClick={() => applyOnlineSalesToUnits(onlineSalesData)}
            className="px-5 py-3 bg-white hover:bg-slate-50 text-amber-900 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer shrink-0 flex items-center gap-2"
          >
            <span>⚡ Importar / Cargar a Unidades</span>
          </button>
        </div>
      )}

      {/* SECTION 1: EVENTO + EMPRESA */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-900">Selección de Evento</h2>
          </div>
          <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all">
             <div className="text-right">
                <p className={`text-[10px] font-black uppercase tracking-widest ${skipStock ? 'text-indigo-600' : 'text-slate-400'} transition`}>Carga Histórica</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">No afecta stock actual</p>
             </div>
             <input type="checkbox" checked={skipStock} onChange={e => setSkipStock(e.target.checked)} 
                    className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer" />
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          {/* Overlay loading indicador */}
          {isFetchingData && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-200 text-indigo-600 font-bold text-sm">
                <Loader2 className="animate-spin" size={16} /> Consultando base...
              </div>
            </div>
          )}

          {/* Event Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Calendar size={10} /> Evento Maestro
            </label>
            {loadingEvents ? (
              <div className="flex items-center gap-2 p-4 text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Cargando eventos...
              </div>
            ) : (
              <select
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition font-bold"
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
              >
                <option value="">-- Seleccionar Evento --</option>
                {selectableEvents.map(e => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.event_date + 'T12:00:00').toLocaleDateString('es-AR')} — {e.show_name} @ {e.venues?.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Company Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Building2 size={10} /> Empresa
              </label>
              {selectedEventId && (
                <button
                  type="button"
                  onClick={() => {
                    setNewCompanyInput(clients?.[0]?.name || '')
                    setNewPaxInput(50)
                    setShowAddCompanyModal(true)
                  }}
                  className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 transition"
                >
                  <Plus size={12} /> Agregar Empresa al Evento
                </button>
              )}
            </div>
            <select
              disabled={!selectedEventId}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition font-bold disabled:opacity-50 cursor-pointer"
              value={selectedCompany}
              onChange={e => {
                if (e.target.value === '__ADD_NEW__') {
                  setNewCompanyInput(clients?.[0]?.name || '')
                  setNewPaxInput(50)
                  setShowAddCompanyModal(true)
                } else {
                  setSelectedCompany(e.target.value)
                }
              }}
            >
              <option value="">-- Seleccionar Empresa --</option>
              {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              {selectedEventId && (
                <option value="__ADD_NEW__" className="font-bold text-indigo-600 bg-indigo-50">
                  + Agregar nueva empresa a este evento...
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Warning: No Rule */}
        {activeRule?.noRuleFound && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 animate-pulse">
            <AlertCircle size={20} />
            <div className="text-sm">
              <p className="font-bold uppercase">Falta Configuración Comercial</p>
              <p className="font-medium opacity-80">Esta empresa no tiene reglas de precios definidas. Contacte al administrador para evitar errores de liquidación.</p>
            </div>
          </div>
        )}

        {/* Event Info Banner */}
        {selectedEvent && selectedCompany && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">PAX Proyectados (Editable)</p>
              <input 
                type="text" inputMode="numeric"
                className="w-full bg-transparent text-2xl font-bold text-slate-900 outline-none border-b-2 border-transparent focus:border-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={paxOverride !== null ? paxOverride : projectedPax}
                onChange={e => setPaxOverride(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                onFocus={e => e.target.select()}
              />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Venue</p>
              <p className="text-sm font-bold text-slate-700">{selectedEvent.venues?.name || "S/D"}</p>
            </div>
            {userRole !== 'cocina' && (
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Precio Sin TACC</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  {totals?.price_sintacc_effective ? `$${Number(totals.price_sintacc_effective).toLocaleString('es-AR')}` : '—'}
                  {totals?.hasSpecialSinTaccPrice && (
                    <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">especial</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Delivery */}
        {selectedEvent && selectedCompany && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Horario Entrega (HH:MM)</label>
              <input type="time"
                className="w-full p-3 border border-slate-200 rounded-2xl bg-white outline-none font-bold text-indigo-600"
                value={deliveryTime}
                onChange={e => setDeliveryTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><MapPin size={10} /> Punto de Encuentro</label>
              <input className="w-full p-3 border border-slate-200 rounded-2xl bg-white outline-none"
                placeholder="Ej: Portón 4"
                value={deliveryPoint}
                onChange={e => setDeliveryPoint(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección / Referencia</label>
              <input className="w-full p-3 border border-slate-200 rounded-2xl bg-white outline-none"
                placeholder="Ej: Av. Figueroa Alcorta..."
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: UNITS */}
      {selectedEventId && selectedCompany && (
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          <div className="flex-1 space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Truck size={18} className="text-indigo-500" /> Unidades de Transporte
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {units.map((u) => {
                const validity = totals?.unitsValidity.find(v => v.id === u.id)
                // Filter dropdowns by Master selectedCompany
                const selectedClientName = selectedCompany.toLowerCase()
                const cRecord = clients.find((c: any) => c.name?.toLowerCase() === selectedClientName)
                const clientId = cRecord?.id
                const filteredVehicles = vehicles.filter((v: any) => v.client_id === clientId)
                const filteredCoordinators = coordinators.filter((c: any) => c.company?.toLowerCase() === selectedClientName)
                return (
                  <div key={u.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {/* Card Header */}
                    <div className={`p-5 flex justify-between items-center ${validity?.isValid ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${validity?.isValid ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                        <input
                          className="bg-transparent font-bold text-slate-900 outline-none w-36"
                          value={u.name}
                          onChange={e => updateUnit(u.id, 'name', e.target.value)} />
                      </div>
                      <button onClick={() => removeUnit(u.id)} className="text-slate-400 hover:text-rose-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      
                      {/* Logística integrada */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Vehículo Físico</label>
                          <div className="flex gap-1">
                            <select
                              className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-indigo-400 transition"
                              value={u.vehicle_id}
                              onChange={e => updateUnit(u.id, 'vehicle_id', e.target.value)}
                            >
                              <option value="">-- Seleccionar --</option>
                              {filteredVehicles.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  {v.internal_name} {v.plate ? `(${v.plate})` : ''}
                                </option>
                              ))}
                            </select>
                            <button type="button" onClick={() => setFleetModal(true)} className="px-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-50 transition">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Coordinador M.</label>
                          <div className="flex gap-1">
                            <select
                              className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-indigo-400 transition"
                              value={u.coordinator_id}
                              onChange={e => updateUnit(u.id, 'coordinator_id', e.target.value)}
                            >
                              <option value="">-- Seleccionar --</option>
                              {filteredCoordinators.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <button type="button" onClick={() => setCoordModal(true)} className="px-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-50 transition">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Operatividad */}
                      <div className="grid grid-cols-2 gap-4 border-b pb-6">
                        {['sold', 'liberated'].map(field => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">{field === 'sold' ? 'Vendidos' : 'Liberados'}</label>
                            <input type="text" inputMode="numeric"
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-center font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={(u as any)[field]}
                              onChange={e => updateUnit(u.id, field as any, parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                              onFocus={e => e.target.select()} />
                          </div>
                        ))}
                      </div>

                      {/* Categories */}
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        {[
                          { key: 'traditional', label: 'Tradicional', price: activeRule?.price_base },
                          { key: 'vegetarian', label: 'Vegetariana', price: activeRule?.price_base },
                          { key: 'vegana', label: 'Vegana', price: activeRule?.price_base },
                          { key: 'sin_tacc', label: 'Sin TACC', price: totals?.price_sintacc_effective },
                        ].map(({ key, label, price }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</label>
                            <input type="text" inputMode="numeric"
                              disabled={activeRule?.noRuleFound}
                              className="w-full p-2 border border-slate-200 rounded-xl text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-slate-100"
                              value={(u as any)[key]}
                              onChange={e => updateUnit(u.id, key as any, parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                              onFocus={e => e.target.select()} />
                            {userRole !== 'cocina' && (
                              <p className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-tighter">
                                 ${Number(price || 0).toLocaleString('es-AR')} c/u
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Water & Specials */}
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                            {totals?.isTercoTour ? 'Agua (No incluida)' : `Agua Sugerida${activeRule?.includes_water ? ' (V+L)' : ''}`}
                          </label>
                          <input type="text" inputMode="numeric"
                            disabled={totals?.isTercoTour}
                            className={`w-20 p-2 rounded-xl text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${totals?.isTercoTour ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' : 'bg-indigo-50 border border-indigo-100 text-indigo-700'}`}
                            value={totals?.isTercoTour ? 0 : u.water}
                            onChange={e => updateUnit(u.id, 'water', parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                            onFocus={e => e.target.select()} />
                        </div>

                        {/* Special Orders */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-indigo-600 border-b border-indigo-50 pb-2">
                            <label className="text-[10px] font-bold uppercase">Pedidos Especiales</label>
                            <button onClick={() => updateUnit(u.id, 'details', [...u.details, { id: crypto.randomUUID(), category: 'traditional', qty: 0, obs: '' }])}
                              className="p-1 hover:bg-indigo-50 rounded-lg transition">
                              <Plus size={14} />
                            </button>
                          </div>

                          {u.details.map(det => (
                            <div key={det.id} className="grid grid-cols-12 items-center bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden divide-x divide-slate-100">
                              <select
                                className="col-span-3 bg-transparent text-[9px] font-bold px-2 h-8 outline-none uppercase text-slate-400 appearance-none"
                                value={det.category}
                                onChange={e => updateUnit(u.id, 'details', u.details.map(d => d.id === det.id ? { ...d, category: e.target.value } : d))}>
                                <option value="traditional">TRAD.</option>
                                <option value="vegetarian">VEGIE</option>
                                <option value="vegana">VEGAN</option>
                                <option value="sin_tacc">ST</option>
                              </select>
                              <input type="text" inputMode="numeric"
                                className="col-span-2 bg-white text-center font-bold text-indigo-600 text-xs h-8 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={det.qty || 0}
                                onChange={e => updateUnit(u.id, 'details', u.details.map(d => d.id === det.id ? { ...d, qty: parseInt(e.target.value.replace(/\D/g, '')) || 0 } : d))}
                                onFocus={e => e.target.select()} />
                              <input
                                placeholder="Sin Cebolla, Sin Mayo..."
                                className="col-span-6 bg-transparent text-[10px] px-3 h-8 outline-none text-slate-600 italic placeholder:text-slate-300"
                                value={det.obs}
                                onChange={e => updateUnit(u.id, 'details', u.details.map(d => d.id === det.id ? { ...d, obs: e.target.value } : d))} />
                              <button
                                onClick={() => updateUnit(u.id, 'details', u.details.filter(d => d.id !== det.id))}
                                className="col-span-1 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Observaciones Generales</label>
                            <textarea rows={1}
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none resize-none"
                              placeholder="Otras notas..."
                              value={u.observations}
                              onChange={e => updateUnit(u.id, 'observations', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {!validity?.isValid && (
                      <div className="bg-rose-500 text-white text-[10px] font-bold py-1 text-center">
                        ERROR: {(Number(u.traditional||0)+Number(u.vegetarian||0)+Number(u.vegana||0)+Number(u.sin_tacc||0))} categorías ≠ {(Number(u.sold||0)+Number(u.liberated||0))} producción
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add Unit Button */}
              <button onClick={addUnit}
                className="flex flex-col items-center justify-center gap-3 border-4 border-dashed border-slate-200 rounded-[2rem] p-8 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                <div className="p-4 bg-slate-100 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition shadow-sm">
                  <Plus size={32} />
                </div>
                <span className="font-bold text-sm uppercase tracking-widest">Añadir Micro / Traffic</span>
              </button>
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
              {totals?.rvValidationErrors && totals.rvValidationErrors.length > 0 && (
                <div className="mb-6 space-y-2">
                  {totals.rvValidationErrors.map((err, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-start gap-3 shadow-xs">
                      <AlertCircle className="shrink-0 text-rose-600 mt-0.5" size={18} />
                      <div>
                        <p className="uppercase text-[9px] font-black tracking-widest text-rose-800">Bloqueo por Regla Comercial — RV Traslados</p>
                        <p className="mt-0.5 text-xs font-semibold leading-relaxed">{err}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {message && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-bold text-center ${message?.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                  {message?.type === 'success' ? <CheckCircle2 className="inline mr-2" size={14} /> : <AlertCircle className="inline mr-2" size={14} />}
                  {message?.text}
                </div>
              )}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {userRole === 'cocina' ? 'Total Viandas' : 'Total a Liquidar'}
                    </p>
                    <p className="text-3xl font-bold text-slate-900">
                      {userRole === 'cocina' ? `${totals?.totalViandas || 0} u.` : `$${totals?.amount.toLocaleString("es-AR")}`}
                    </p>
                  </div>
                  <div className="h-10 w-px bg-slate-200 hidden md:block" />
                  <div>
                    <span className={`text-xs font-bold flex items-center gap-2 ${totals?.allValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {totals?.allValid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {totals?.allValid ? 'Datos Validados' : (totals?.rvValidationErrors?.length ? 'Bloqueo Regla Comercial' : 'Error en Distribución')}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {totals?.allValid ? 'Listo para persistir' : 'Revisá las advertencias rojas arriba'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  {savedHeaderId && (
                     <button onClick={handleDelete} disabled={loading}
                       className="px-5 py-2.5 rounded-xl border-2 border-rose-100 text-rose-500 font-bold hover:bg-rose-50 transition flex items-center gap-2 text-sm">
                       <Trash2 size={16} /> ELIMINAR CARGA
                     </button>
                  )}
                  {/* BOTÓN DE DESCARGA DIRECTA PACK COMPLETO PDF */}
                  <button 
                    type="button"
                    onClick={() => handlePrint('all')}
                    disabled={downloadingPdf !== null}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl transition flex items-center justify-center text-xs uppercase tracking-wider shadow-md gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Descargar directamente el Pack Completo (Remito + Planilla de Pasajeros) en PDF"
                  >
                    {downloadingPdf ? <Loader2 size={16} className="animate-spin text-white" /> : <Printer size={16} />}
                    <span>{downloadingPdf ? 'Generando PDF...' : 'Pack Completo PDF'}</span>
                  </button>
                  <button onClick={saveAll} disabled={!totals?.allValid || loading}
                    className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${totals?.allValid ? 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-emerald-600/30 hover:-translate-y-0.5' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}>
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {loading ? 'GUARDANDO...' : (savedHeaderId ? 'ACTUALIZAR CARGA' : 'GUARDAR Y CONFIRMAR')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[380px] flex flex-col gap-6 sticky top-24">
            <div className="bg-[#1e293b] text-white p-8 rounded-[3rem] shadow-2xl space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Calculator className="text-indigo-400" />
                <h2 className="text-xl font-bold">{userRole === 'cocina' ? 'Resumen de Viandas' : 'Liquidación Global'}</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Vendidos</p>
                  <p className="text-3xl font-bold">{totals?.sold}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Liberados</p>
                  <p className="text-3xl font-bold">{totals?.liberated}</p>
                </div>
              </div>

              {userRole !== 'cocina' && (
                <>
                  {activeRule ? (
                    <div className="bg-indigo-950/70 p-5 rounded-2xl border border-indigo-500/30 space-y-3 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-white/10">
                        <span className="text-indigo-300 font-extrabold uppercase text-[9px] tracking-widest">
                          {activeRule.company_name || selectedCompany}
                        </span>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${
                          totals.isMayorista ? 'bg-purple-500/30 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {totals.isMayorista ? 'Mayorista' : 'Minorista'}
                        </span>
                      </div>

                      {/* Ocupación */}
                      <div className="flex justify-between">
                        <span className="text-white/60">Ocupación Pax</span>
                        <span className="font-bold text-white">
                          {totals.ocupationPct.toFixed(1)}% ({totals.sold} / {totals.pax})
                        </span>
                      </div>

                      {/* Escala de Liberados & Bonificaciones */}
                      <div className="bg-black/30 p-2.5 rounded-xl space-y-1.5 border border-white/5">
                        <div className="text-[9px] font-black uppercase text-indigo-400 tracking-wider mb-1">
                          {totals.isMayorista ? 'Régimen Mayorista' : 'Escala Comercial Alcanzada'}
                        </div>

                        {totals.isMayorista ? (
                          <div className="space-y-1.5 text-[10px]">
                            <div className="flex justify-between items-center">
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                ✓ Tripulación:
                              </span>
                              <span className="font-bold text-emerald-400">
                                SIEMPRE LIBERADA
                              </span>
                            </div>
                            <p className="text-[9px] text-white/50">Hasta 3 viandas (choferes + coordis) por coche incluidas.</p>
                            
                            <div className="flex justify-between items-center pt-1 border-t border-white/5">
                              <span className="text-white/70">Cupo Sin TACC ({activeRule.sintacc_limit_pct || 5}%):</span>
                              <span className="font-bold text-white">{totals.CupoGratis} un.</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* 10% Venta */}
                            {totals.tier10Enabled && (
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-white/70 flex items-center gap-1">
                                  {totals.ocupationPct >= 10 ? (
                                    <span className="text-emerald-400 font-bold">✓ 10% Venta:</span>
                                  ) : (
                                    <span className="text-white/40">○ 10% Venta:</span>
                                  )}
                                  <span>Libera Coordi ({totals.tier10Water ? 'Vianda + Agua' : 'Solo Vianda'})</span>
                                </span>
                                <span className={`font-bold ${totals.ocupationPct >= 10 ? 'text-emerald-400' : 'text-white/40'}`}>
                                  {totals.ocupationPct >= 10 ? '1 vianda' : 'Bloqueado'}
                                </span>
                              </div>
                            )}

                            {/* 30% Venta */}
                            {totals.tier30Enabled && (
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-white/70 flex items-center gap-1">
                                  {totals.ocupationPct >= 30 ? (
                                    <span className="text-emerald-400 font-bold">✓ 30% Venta:</span>
                                  ) : (
                                    <span className="text-white/40">○ 30% Venta:</span>
                                  )}
                                  <span>Libera Chofer/es</span>
                                </span>
                                <span className={`font-bold ${totals.ocupationPct >= 30 ? 'text-emerald-400' : 'text-white/40'}`}>
                                  {totals.ocupationPct >= 30 ? '1-2 viandas' : 'Bloqueado'}
                                </span>
                              </div>
                            )}

                            {/* 50% Venta */}
                            {totals.tier50Enabled && (
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-white/70 flex items-center gap-1">
                                  {totals.ocupationPct >= 50 ? (
                                    <span className="text-blue-400 font-bold">✓ 50% Venta:</span>
                                  ) : (
                                    <span className="text-white/40">○ 50% Venta:</span>
                                  )}
                                  <span>Aguas Bonificadas</span>
                                </span>
                                <span className={`font-bold ${totals.ocupationPct >= 50 ? 'text-blue-400' : 'text-white/40'}`}>
                                  {totals.ocupationPct >= 50 ? '100% Gratis' : 'Solo Vendidas'}
                                </span>
                              </div>
                            )}

                            {/* 70% Venta */}
                            {totals.tier70Enabled && (
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-white/70 flex items-center gap-1">
                                  {totals.ocupationPct >= 70 ? (
                                    <span className="text-amber-400 font-bold">✓ 70% Venta:</span>
                                  ) : (
                                    <span className="text-white/40">○ 70% Venta:</span>
                                  )}
                                  <span>Bono Extra Alto Rend.</span>
                                </span>
                                <span className={`font-bold ${totals.ocupationPct >= 70 ? 'text-amber-300' : 'text-white/40'}`}>
                                  {totals.ocupationPct >= 70 ? `+$${(totals.tier70Bonus || 10000).toLocaleString('es-AR')}` : 'Sin Bono'}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Sin TACC Detalle */}
                      <div className="flex justify-between text-amber-300">
                        <span className="text-white/60">Sin TACC ($/un)</span>
                        <span className="font-bold">${Number(totals.price_sintacc_effective).toLocaleString('es-AR')}</span>
                      </div>

                      {/* Comisiones */}
                      <div className="flex justify-between border-t border-white/10 pt-2">
                        <span className="text-white/60">Comisión Total</span>
                        <div className="text-right">
                          <span className="font-bold text-sky-300 text-sm">
                            ${totals.commissionAmount.toLocaleString('es-AR')}
                          </span>
                          <span className="text-[9px] text-white/50 block font-normal">
                            (${totals.commissionPerUnit.toLocaleString('es-AR')} / vianda vendida)
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {userRole === 'cocina' ? (
                <div className="pt-4 border-t border-white/10 text-center">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Total Viandas a Producir</p>
                  <p className="text-6xl font-bold tracking-tighter text-emerald-400">
                    {totals?.totalViandas || 0}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Unidades Totales</p>
                </div>
              ) : (
                <div className="pt-4 border-t border-white/10 text-center">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Monto Total</p>
                  <p className="text-6xl font-bold tracking-tighter text-white">
                    ${totals?.amount.toLocaleString("es-AR")}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-b border-indigo-200 pb-3">Resumen Cocina</h4>
              <div className="space-y-2">
                {[
                  { key: 'trad', label: 'Tradicional' },
                  { key: 'veg', label: 'Vegetariana' },
                  { key: 'vegan', label: 'Vegana' },
                  { key: 'st', label: 'Sin TACC' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-sm font-bold text-indigo-800">{label}</span>
                    <span className="text-2xl font-bold text-indigo-950">{(totals as any)?.[key]}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-indigo-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-400">AGUA TOTAL</span>
                  <span className="text-2xl font-bold text-indigo-600">{totals?.water}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Empty State */}
      {(!selectedEventId || !selectedCompany) && (
        <div className="text-center py-24 bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-200">
          <Truck className="mx-auto text-slate-200 mb-6" size={80} />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-2">Seleccioná un Evento y una Empresa</h3>
          <p className="text-slate-400">Una vez seleccionados, podrás cargar los micros y sus viandas.</p>
        </div>
      )}

      {/* QUICK ADD COMPANY MODAL */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Agregar Empresa al Evento</h3>
                  <p className="text-xs text-slate-400">Vincular una empresa sin ir a Gestión de Eventos</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Seleccionar Empresa *
                </label>
                <select
                  value={newCompanyInput}
                  onChange={e => setNewCompanyInput(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-slate-800 text-sm"
                >
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  O Escribir Nombre Personalizado
                </label>
                <input
                  type="text"
                  placeholder="Ej: Nueva Empresa SA"
                  value={newCompanyInput}
                  onChange={e => setNewCompanyInput(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-slate-800 text-sm placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Pasajeros Proyectados (Pax) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPaxInput}
                  onChange={e => setNewPaxInput(parseInt(e.target.value) || 0)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-slate-800 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCompanyModal(false)}
                className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCompanyToEvent}
                disabled={addingCompanyLoading || !newCompanyInput.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {addingCompanyLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Agregar al Evento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <FleetModal 
        isOpen={fleetModal} 
        onClose={() => setFleetModal(false)} 
        onSuccess={() => {
          supabase.from("vehicles").select("id, internal_name, plate, client_id").order("internal_name").then(({ data }) => setVehicles(data || []))
        }} 
        clients={clients.map((c: any) => ({ id: c.id, name: c.name }))} 
      />
      <CoordinatorModal 
        isOpen={coordModal} 
        onClose={() => setCoordModal(false)} 
        onSuccess={() => {
          supabase.from("coordinators").select("id, name, company, phone").order("name").then(({ data }) => setCoordinators(data || []))
        }} 
      />
    </div>
  )
}