"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Calculator, Truck, Users, Plus, Trash2, Calendar,
  ClipboardList, MapPin, AlertCircle, CheckCircle2,
  Save, Printer, Loader2, Building2, ChevronDown, ChevronUp
} from "lucide-react"
import FleetModal from "@/components/forms/FleetModal"
import CoordinatorModal from "@/components/forms/CoordinatorModal"
import { processStockForSaleAction } from "@/app/actions/stock"

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
  // Master event selection
  const [events, setEvents] = useState<EventMaster[]>([])
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || "")
  const [selectedCompany, setSelectedCompany] = useState(initialCompany || "")
  const [loadingEvents, setLoadingEvents] = useState(true)

  // Modals state
  const [fleetModal, setFleetModal] = useState(false)
  const [coordModal, setCoordModal] = useState(false)
  const [vehicles, setVehicles] = useState(initVehicles)
  const [coordinators, setCoordinators] = useState(initCoordinators)

  // Edición en caliente
  const [savedHeaderId, setSavedHeaderId] = useState<string | null>(null)
  const [isFetchingData, setIsFetchingData] = useState(false)

  // Form state
  const [skipStock, setSkipStock] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState("")
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

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

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

  // Auto-fetch data para Edición en Caliente
  useEffect(() => {
    const fetchExistingSale = async () => {
      if (!selectedEventId || !selectedCompany) {
        setSavedHeaderId(null)
        setUnits([newUnit("Micro 1")])
        return
      }

      setIsFetchingData(true)
      try {
        // FETCH ASIGNACIONES LOGISTICAS PLANIFICADAS ANTES QUE NADA
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

        // Buscar cabecera
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
          setSavedHeaderId(null)
          if (assignedBuses.length > 0) {
            setUnits(assignedBuses.map((ab, idx) => ({
              ...newUnit(`Micro ${idx + 1}`),
              vehicle_id: ab.vehicle_id || "",
              coordinator_id: ab.coordinator_id || ""
            })))
          } else {
            setUnits([newUnit("Micro 1")])
          }
          setDeliveryTime("")
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
    
    if (cRule) return cRule

    // Fallback simplificado si no hay regla
    if (cRecord) {
      return {
        company_name: cRecord.name,
        price_base: 0, // Indicará que no hay regla válida
        noRuleFound: true
      }
    }
    return null
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

      if ((field === 'sold' || field === 'liberated') && activeRule?.includes_water) {
        // Regla especial: Traslados solo agua para sold. Otros (Rock) para ambos.
        const isTraslados = activeRule.company_name?.toLowerCase().includes("traslados")
        updated.water = isTraslados ? (Number(updated.sold) || 0) : ((Number(updated.sold) || 0) + (Number(updated.liberated) || 0))
      }
      return updated
    }))
  }, [activeRule])

  // Recalcular agua si cambia la regla (ej: cambio de empresa)
  useEffect(() => {
    if (activeRule?.includes_water) {
      setUnits(prev => prev.map(u => {
        const isTraslados = activeRule.company_name?.toLowerCase().includes("traslados")
        const newWater = isTraslados ? (Number(u.sold) || 0) : ((Number(u.sold) || 0) + (Number(u.liberated) || 0))
        if (u.water !== newWater) return { ...u, water: newWater }
        return u
      }))
    }
  }, [activeRule])

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
    const allValid = unitsValidity.every(v => v.isValid) && selectedEventId !== "" && selectedCompany !== ""

    if (!activeRule) {
      return {
        ...consolidated,
        amount: 0,
        allValid,
        unitsValidity,
        CupoGratis: 0,
        SinTaccExcedentes: 0,
        SinTaccFacturables: 0,
        price_base: 0,
        price_sintacc_effective: 0,
        price_sintacc_threshold: 0,
        hasSpecialSinTaccPrice: false
      }
    }

    const SinTaccFacturables = Math.max(0, consolidated.st - consolidated.liberated)
    const pax = paxOverride !== null ? paxOverride : (projectedPax || 0)
    const limitPct = Number(activeRule.sintacc_limit_pct || 0)
    const CupoGratis = Math.ceil(pax * (limitPct / 100))
    const SinTaccExcedentes = Math.max(0, SinTaccFacturables - CupoGratis)

    const price_base = Number(activeRule.price_base || 0)
    // Regla de Oro: special_sintacc_price tiene prioridad absoluta
    // Si la empresa tiene precio especial (ej: RV TRASLADOS = $10.000), se usa ese.
    // Si no, se usa price_sintacc_base del evento, y si tampoco existe, se usa price_base.
    const price_sintacc_effective = Number(activeRule.special_sintacc_price) > 0
      ? Number(activeRule.special_sintacc_price)
      : Number(activeRule.price_sintacc_base || price_base)
    const price_sintacc_threshold = Number(activeRule.price_sintacc_threshold || 0)

    const amount = (consolidated.sold * price_base) +
      (SinTaccFacturables * (price_sintacc_effective - price_base)) +
      (SinTaccExcedentes * (price_sintacc_threshold - price_sintacc_effective))

    return {
      ...consolidated,
      CupoGratis,
      SinTaccExcedentes,
      SinTaccFacturables,
      amount,
      allValid,
      unitsValidity,
      price_base,
      price_sintacc_effective,
      price_sintacc_threshold,
      hasSpecialSinTaccPrice: Number(activeRule.special_sintacc_price) > 0,
    }
  }, [units, activeRule, projectedPax, selectedEventId, selectedCompany])

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

      headerId = header.id

      // LIMPIAR DEPENDENCIAS ANTERIORES SI ESTAMOS ACTUALIZANDO
      if (savedHeaderId) {
         // REVERT STOCK OF OLD UNITS FIRST (Only if not skipStock)
         if (!skipStock) {
            await processStockForSaleAction(savedHeaderId, true)
         }

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
         await processStockForSaleAction(headerId, false)
      }

      // INSERTAR NUEVA FLOTA
      
      const busesToSave = units.filter(u => u.vehicle_id).map(u => ({
         event_id: selectedEventId,
         client_id: cId,
         vehicle_id: u.vehicle_id,
         coordinator_id: u.coordinator_id || null
      }))
      
      if (busesToSave.length > 0) {
         const { error: bErr } = await supabase.from('event_bus_assignments').insert(busesToSave)
         if (bErr) throw bErr
      }
      
      // ACTUALIZAR COMISION RV TRASLADOS EN EL MAESTRO (Unidades Vendidas * 1000)
      if (selectedCompany?.toUpperCase().includes('RV TRASLADOS')) {
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
      
      // 2. REVERT STOCK
      await processStockForSaleAction(savedHeaderId, true)

      // 3. Borrar Units (Cascade puede que lo haga la db, pero lo forzamos)
      await supabase.from('event_sales_units').delete().eq('header_id', savedHeaderId)

      // 3. Borrar Header
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

  // --- PDF Print ---
  const handlePrint = () => {
    if (!selectedEvent) return
    const venueName = selectedEvent.venues?.name || "S/D"
    const dateStr = selectedEvent.event_date?.replace(/-/g, '') || "SinFecha"
    const docFileTitle = `${dateStr} - ${venueName} - ${selectedCompany}`

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>${docFileTitle}</title>
          <style>
            @page { margin: 10mm; }
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 0; color: #000; line-height: 1.2; }
            .page-break { page-break-after: always; padding: 20px; }
            .page-break:last-child { page-break-after: auto; }
            
            .header-title { border-bottom: 4px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
            .header-title h1 { margin: 0; font-size: 26px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: -1px; }
            .header-title p { margin: 0; font-size: 18px; font-weight: 900; color: #1e40af; text-transform: uppercase; }
            
            .info-grid { 
              display: grid; 
              grid-template-columns: 1.2fr 1fr; 
              gap: 12px; 
              background: #f1f5f9; 
              padding: 15px; 
              border-radius: 12px; 
              margin-bottom: 20px;
              border: 2px solid #cbd5e1;
            }
            .info-item b { display: block; text-transform: uppercase; font-size: 10px; color: #475569; margin-bottom: 1px; font-weight: 900; }
            .info-item span { font-weight: 900; font-size: 17px; color: #000; }

            .section-title { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 4px; margin: 20px 0 10px 0; }
            
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .data-table th { background: #000; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #fff; }
            .data-table td { padding: 10px 12px; font-size: 18px; font-weight: 900; border-bottom: 1px solid #cbd5e1; color: #000; }
            .data-table .qty-cell { text-align: right; width: 100px; font-size: 22px; }
            .total-row { background: #e2e8f0; color: #000; }
            .total-row td { padding: 12px; font-size: 20px; font-weight: 900; border: 2px solid #000; }
            .total-row .qty-cell { font-size: 28px; background: #000; color: #fff; }

            .obs-box { 
              margin-top: 20px; 
              border: 3px dashed #000; 
              border-radius: 12px; 
              padding: 15px; 
              min-height: 60px;
            }
            .obs-box h4 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #000; font-weight: 900; }
            .obs-content { font-size: 16px; color: #000; font-weight: 800; font-style: italic; }
            
            .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 8px; font-weight: 700; }
          </style>
        </head>
        <body>
          ${units.map((u, idx) => {
            const v = vehicles.find((v: any) => v.id === u.vehicle_id)
            const c = coordinators.find((c: any) => c.id === u.coordinator_id)
            const solidsTotal = (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0)
            const liquidsTotal = Number(u.water) || 0

            return `
              <div class="page-break">
                <div class="header-title">
                  <h1>Remito de Descarga por Empresa</h1>
                  <p>Unidad: ${u.name}</p>
                </div>

                <div class="info-grid">
                  <div class="info-item"><b>Empresa de Transporte</b><span>${selectedCompany}</span></div>
                  <div class="info-item"><b>Evento / Show</b><span>${selectedEvent.show_name}</span></div>
                  <div class="info-item"><b>Vehículo / Patente</b><span>${v?.internal_name || 'S/D'} ${v?.plate ? `(${v.plate})` : ''}</span></div>
                  <div class="info-item"><b>Fecha</b><span>${new Date(selectedEvent.event_date + 'T12:00:00').toLocaleDateString('es-AR')}</span></div>
                  <div class="info-item"><b>Coordinador / Responsable</b><span>${c?.name || 'S/D'}</span></div>
                  <div class="info-item"><b>Horario de Descarga</b><span>${deliveryTime || 'S/D'}</span></div>
                  <div class="info-item"><b>Teléfono Coordinador</b><span>${c?.phone || 'S/D'}</span></div>
                  <div class="info-item"><b>Punto de Entrega / Venue</b><span>${venueName} - ${deliveryPoint || 'S/D'}</span></div>
                </div>

                <div class="section-title">1. Detalle de Viandas (Sólidos)</div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Tipo de Menú</th>
                      <th class="qty-cell">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Menú Tradicional</td><td class="qty-cell">${u.traditional || 0}</td></tr>
                    <tr><td>Menú Vegetariano</td><td class="qty-cell">${u.vegetarian || 0}</td></tr>
                    <tr><td>Menú Vegano</td><td class="qty-cell">${u.vegana || 0}</td></tr>
                    <tr><td>Menú Sin TACC</td><td class="qty-cell">${u.sin_tacc || 0}</td></tr>
                    <tr class="total-row">
                      <td>TOTAL SANDWICHES</td>
                      <td class="qty-cell">${solidsTotal}</td>
                    </tr>
                  </tbody>
                </table>

                <div class="section-title">2. Detalle de Bebidas (Líquidos)</div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Tipo de Bebida</th>
                      <th class="qty-cell">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Agua Sin Gas (500ml)</td><td class="qty-cell">${u.water || 0}</td></tr>
                    <tr class="total-row">
                      <td>TOTAL BEBIDAS</td>
                      <td class="qty-cell">${liquidsTotal}</td>
                    </tr>
                  </tbody>
                </table>

                <div class="obs-box">
                  <h4>Observaciones Operativas</h4>
                  <div class="obs-content">
                    ${u.observations || 'Sin observaciones...'}
                    ${u.details && u.details.length > 0 ? `
                      <div style="margin-top: 8px; font-size: 11px; font-style: normal;">
                        ${u.details.filter((d:any) => d.qty > 0).map((d:any) => `<div>• ${d.qty}x ${d.category} - ${d.obs}</div>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>

                <div class="footer">
                  Página ${idx + 1} de ${units.length} | Generado por Super Catering Manager — ${new Date().toLocaleString('es-AR')}
                </div>
              </div>
            `
          }).join('')}

          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
          <script>
            window.onload = function() {
              var element = document.body;
              var opt = {
                margin:       0,
                filename:     '${docFileTitle}.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };
              html2pdf().set(opt).from(element).save();
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }


  // --- Render ---
  return (
    <div className="flex flex-col gap-8 pb-32">

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
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Building2 size={10} /> Empresa
            </label>
            <select
              disabled={!selectedEventId}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 transition font-bold disabled:opacity-50"
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
            >
              <option value="">-- Seleccionar Empresa --</option>
              {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
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
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Precio Sin TACC</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                {totals?.price_sintacc_effective ? `$${Number(totals.price_sintacc_effective).toLocaleString('es-AR')}` : '—'}
                {totals?.hasSpecialSinTaccPrice && (
                  <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">especial</span>
                )}
              </p>
            </div>
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
                            <p className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-tighter">
                               ${Number(price || 0).toLocaleString('es-AR')} c/u
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Water & Specials */}
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Agua Sugerida{activeRule?.includes_water && " (V+L)"}</label>
                          <input type="text" inputMode="numeric"
                            className="w-20 p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center font-bold text-indigo-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={u.water}
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
              {message && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-bold text-center ${message?.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                  {message?.type === 'success' ? <CheckCircle2 className="inline mr-2" size={14} /> : <AlertCircle className="inline mr-2" size={14} />}
                  {message?.text}
                </div>
              )}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total a Liquidar</p>
                    <p className="text-3xl font-bold text-slate-900">${totals?.amount.toLocaleString("es-AR")}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-200 hidden md:block" />
                  <div>
                    <span className={`text-xs font-bold flex items-center gap-2 ${totals?.allValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {totals?.allValid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {totals?.allValid ? 'Datos Validados' : 'Error en Distribución'}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {totals?.allValid ? 'Listo para persistir' : 'Revisá que categorías = producción'}
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
                  <button onClick={handlePrint}
                    className="px-5 py-2.5 border border-slate-200 bg-white rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition flex items-center justify-center text-sm shadow-sm gap-2">
                    <Printer size={16} /> REMITO PDF
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
                <h2 className="text-xl font-bold">Liquidación Global</h2>
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

              {activeRule && (
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="text-white/60 font-bold uppercase text-[9px] tracking-widest">Detalle Sin TACC</span>
                    {totals?.hasSpecialSinTaccPrice && (
                      <span className="bg-purple-500/30 text-purple-300 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Precio especial</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Precio aplicado (c/u)</span>
                    <span className="font-bold text-white">${Number(totals?.price_sintacc_effective || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Cupo libre ({activeRule.sintacc_limit_pct}% de {projectedPax})</span>
                    <span className="font-bold text-emerald-400">{totals?.CupoGratis} un.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60 italic">Facturables / Excedentes</span>
                    <span className="font-bold text-rose-400">{totals?.SinTaccFacturables} / {totals?.SinTaccExcedentes} un.</span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 text-center">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Monto Total</p>
                <p className="text-6xl font-bold tracking-tighter text-white">
                  ${totals?.amount.toLocaleString("es-AR")}
                </p>
              </div>
            </div>

            {/* Kitchen Summary */}
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