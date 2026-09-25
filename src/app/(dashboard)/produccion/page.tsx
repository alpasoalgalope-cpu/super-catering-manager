"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  ChefHat, Printer, Calendar, ChevronRight,
  Calculator, Loader2, Table as TableIcon, Building2, Users,
  Truck, Package, Copy, MessageSquare
} from "lucide-react"
import ReceivePOModal from "@/components/inventory/ReceivePOModal"

export default function ProduccionPage() {
  const [eventos, setEventos] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [consolidado, setConsolidado] = useState<any>(null)
  const [eventsForSelectedDate, setEventsForSelectedDate] = useState<any[]>([])
  const [incomingPOs, setIncomingPOs] = useState<any[]>([])
  const [poLoading, setPoLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])
  const fetchPOs = async () => {
    setPoLoading(true)
    try {
      const today = new Date()
      const currentDay = today.getDay()
      const endOfThisWeek = new Date(today)
      const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
      endOfThisWeek.setDate(today.getDate() + daysToSunday)
      endOfThisWeek.setHours(23,59,59,999)

      const { data: poData, error: poErr } = await supabase
        .from('purchase_orders')
        .select(`
           id,
           fecha_esperada,
           costo_total,
           estado,
           proveedores (nombre),
           purchase_order_items (
             cantidad,
             productos (nombre, unidad_medida, gramos_por_unidad)
           )
        `)
        .eq('estado', 'PENDIENTE')
        .order('fecha_esperada', { ascending: true })

      if (poErr) {
        console.error("Error fetching POs for kitchen:", poErr)
        return
      }

      const filteredPOs = poData ? poData.filter((po: any) => {
        if (!po.fecha_esperada) return false
        const poDate = new Date(po.fecha_esperada + 'T12:00:00')
        return poDate <= endOfThisWeek
      }) : []

      setIncomingPOs(filteredPOs)
    } catch (err) {
      console.error("Error in fetchPOs:", err)
    } finally {
      setPoLoading(false)
    }
  }

  const handlePORecievedSuccess = () => {
    setReceivingPoId(null)
    fetchPOs()
  }

  const handleCopyPendingPOs = () => {
    if (incomingPOs.length === 0) return
    
    let text = `📦 *ENTREGAS PENDIENTES - RECIBIR ESTA SEMANA*\n\n`
    
    // Group POs by fecha_esperada
    const grouped: { [date: string]: any[] } = {}
    incomingPOs.forEach(po => {
      if (!grouped[po.fecha_esperada]) {
        grouped[po.fecha_esperada] = []
      }
      grouped[po.fecha_esperada].push(po)
    })
    
    // Sort dates
    const sortedDates = Object.keys(grouped).sort()
    
    const daysOfWeek = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']

    sortedDates.forEach(dateStr => {
      const d = new Date(dateStr + 'T12:00:00')
      const weekday = daysOfWeek[d.getDay()]
      const day = d.getDate()
      const month = d.getMonth() + 1
      
      text += `📅 *${weekday} ${day}-${month}*\n`
      
      grouped[dateStr].forEach(po => {
        text += `  • *${(po.proveedores?.nombre || 'PROVEEDOR').toUpperCase()}*:\n`
        po.purchase_order_items?.forEach((item: any) => {
          const prod = item.productos
          const name = (prod?.nombre || 'Insumo').toUpperCase()
          const qty = Number(item.cantidad) || 0
          const um = prod?.unidad_medida || 'un'
          const unitSize = Number(prod?.gramos_por_unidad) || 1
          
          if (unitSize > 1 && (um === 'gr' || um === 'ml')) {
            const bultos = (qty / unitSize) % 1 === 0 ? (qty / unitSize).toString() : (qty / unitSize).toFixed(2)
            text += `    - ${name}: ${bultos} bultos x ${unitSize} = ${qty} ${um}\n`
          } else {
            text += `    - ${name}: ${qty} ${um}\n`
          }
        })
      })
      text += `\n`
    })
    
    navigator.clipboard.writeText(text.trim())
    alert("Copiado al portapapeles (Entregas de la semana)")
  }

  // Load events from events_master (with fallback to recitales_staging)
  useEffect(() => {
    const fetchEventos = async () => {
      // Try events_master first
      const { data: masterData, error: masterErr } = await supabase
        .from("events_master")
        .select("*, venues(name), event_projections(company_name, projected_pax)")
        .in("status", ["pendiente", "confirmado", "proyectado", "Pendiente", "Confirmado", "Proyectado"])
        .order("event_date", { ascending: true })

      if (!masterErr && masterData && masterData.length > 0) {
        setEventos(masterData.map((e: any) => ({
          ...e,
          _source: 'master',
          venue_name: e.venues?.name || '',
          total_projected_pax: (e.event_projections || []).reduce((acc: number, p: any) => acc + (p.projected_pax || 0), 0),
          companies: (e.event_projections || []).map((p: any) => p.company_name).join(', ')
        })))
      } else {
        // Fallback to recitales_staging
        const { data } = await supabase
          .from("recitales_staging")
          .select("*")
          .in("status", ["pendiente", "confirmado", "proyectado", "Pendiente", "Confirmado", "Proyectado"])
          .order("event_date", { ascending: true })
        setEventos((data || []).map((e: any) => ({ ...e, _source: 'staging', venue_name: e.venue, total_projected_pax: e.pax_projected })))
      }
      setInitialLoading(false)
    }
    fetchEventos()
  }, [])

  // Load pending purchase orders for the current week
  useEffect(() => {

    fetchPOs()
  }, [])

  // Consolidation logic
  useEffect(() => {
    if (!selectedDate) { setConsolidado(null); setEventsForSelectedDate([]); return }

    const fetchConsolidado = async () => {
      setLoading(true)
      try {
        const eventsForDate = eventos.filter(e => e.event_date === selectedDate)
        setEventsForSelectedDate(eventsForDate)
        
        if (eventsForDate.length === 0) {
           setConsolidado({ total: 0, items: [], specials: {}, companies: [], headerCount: 0, headers: [], units: [] })
           return
        }
        
        const eventIds = eventsForDate.map(e => e.id)

        // 1. Find all sales headers for these events (Manual Wholesale)
        const [{ data: headers, error: hErr }, { data: rulesData }, { data: recipesData }] = await Promise.all([
          supabase
            .from("event_sales_headers")
            .select("id, company, company_name, coordinator_name, total_amount, event_master_id, pax_projected")
            .or(`event_id.in.(${eventIds.join(',')}),event_master_id.in.(${eventIds.join(',')})`),
          supabase.from("commercial_rules").select("company_name, recipe_trad_id, recipe_veg_id, recipe_vegan_id, recipe_sintacc_id"),
          supabase.from("recetas").select("id, nombre")
        ])

        if (hErr) throw hErr
        const currentHeaders = headers || []
        const headerIds = currentHeaders.map((h: any) => h.id)

        const recipeNameMap: Record<string, string> = {}
        ;(recipesData || []).forEach((r: any) => {
          recipeNameMap[r.id] = r.nombre
        })

        const ruleMap: Record<string, any> = {}
        ;(rulesData || []).forEach((r: any) => {
          if (r.company_name) {
            const clean = r.company_name.toLowerCase().trim()
            ruleMap[clean] = r
          }
        })

        const headerCompMap: Record<string, string> = {}
        currentHeaders.forEach((h: any) => {
          headerCompMap[h.id] = (h.company_name || h.company || "").trim()
        })

        // 2. Fetch all units linked to those headers
        let units: any[] = []
        if (headerIds.length > 0) {
          const { data: uData, error: uErr } = await supabase
            .from("event_sales_units")
            .select("traditional, vegetarian, vegana, sin_tacc, water_qty, water, special_breakdown, sold_qty, liberated_qty, unit_name, header_id, recipe_trad_id, recipe_veg_id, recipe_vegan_id, recipe_sintacc_id")
            .in("header_id", headerIds)
          if (uErr) throw uErr
          units = uData || []
        }

        // 3. Find any pending Online Orders for informational purposes only
        const { data: storeEvents } = await supabase
          .from("online_store_events")
          .select("id, title, slug, event_master_id")
          .in("event_master_id", eventIds)

        const storeIds = (storeEvents || []).map((s: any) => s.id)
        let pendingOnlineOrders: any[] = []
        if (storeIds.length > 0) {
          const { data: oOrders } = await supabase
            .from("online_orders")
            .select("*, online_store_events(title, slug)")
            .eq("status", "paid")
            .in("store_event_id", storeIds)
          pendingOnlineOrders = oOrders || []
        }

        if (currentHeaders.length === 0) {
          setConsolidado({ 
            total: 0, 
            sold: 0, 
            liberated: 0, 
            items: [
              { key: "trad_ciabatta", label: "TRADICIONAL CIABATTA", bread: "CIABATTA", qty: 0, color: "bg-slate-900", isPbt: false },
              { key: "trad_pebete", label: "TRADICIONAL PEBETE", bread: "PEBETE", qty: 0, color: "bg-amber-600", isPbt: true },
              { key: "veg_ciabatta", label: "VEGETARIANA CIABATTA", bread: "CIABATTA", qty: 0, color: "bg-emerald-600", isPbt: false },
              { key: "veg_pebete", label: "VEGETARIANA PEBETE", bread: "PEBETE", qty: 0, color: "bg-amber-600", isPbt: true },
              { key: "vegan_ciabatta", label: "VEGANA CIABATTA", bread: "CIABATTA", qty: 0, color: "bg-emerald-500", isPbt: false },
              { key: "vegan_pebete", label: "VEGANA PEBETE", bread: "PEBETE", qty: 0, color: "bg-amber-600", isPbt: true },
              { key: "sin_tacc", label: "SIN TACC", bread: "SIN TACC", qty: 0, color: "bg-indigo-600", isPbt: false },
              { key: "water", label: "AGUA MINERAL", bread: "BEBIDA", qty: 0, color: "bg-sky-500", isPbt: false },
            ], 
            specials: {
              trad_ciabatta: [], trad_pebete: [],
              veg_ciabatta: [], veg_pebete: [],
              vegan_ciabatta: [], vegan_pebete: [],
              sin_tacc: []
            }, 
            companies: [], 
            headerCount: 0, 
            headers: [], 
            units: [],
            pendingOnlineOrdersCount: pendingOnlineOrders.length
          })
          return
        }

        // 4. Aggregation ONLY from Ventas por Evento (event_sales_units)
        const isPbtRecipe = (name: string): boolean => {
          const norm = (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          return norm.includes("pbt") || norm.includes("pebete")
        }

        let tradCiabatta = 0
        let tradPbt = 0
        let vegCiabatta = 0
        let vegPbt = 0
        let veganCiabatta = 0
        let veganPbt = 0
        let sinTacc = 0
        let water = 0
        let sold = 0
        let liberated = 0

        const specialsMap: Record<string, { qty: number; note: string }[]> = {
          trad_ciabatta: [],
          trad_pebete: [],
          veg_ciabatta: [],
          veg_pebete: [],
          vegan_ciabatta: [],
          vegan_pebete: [],
          sin_tacc: []
        }

        units.forEach((u: any) => {
          const comp = headerCompMap[u.header_id] || ""
          const compClean = comp.toLowerCase()
          const rule = ruleMap[compClean]

          // Traditional
          const tradQty = Number(u.traditional) || 0
          const tradRId = u.recipe_trad_id || rule?.recipe_trad_id
          const tradRName = (tradRId && recipeNameMap[tradRId]) || "Vianda Tradicional"
          const tradIsPbt = isPbtRecipe(tradRName)
          if (tradQty > 0) {
            if (tradIsPbt) tradPbt += tradQty
            else tradCiabatta += tradQty
          }

          // Vegetarian
          const vegQty = Number(u.vegetarian) || 0
          const vegRId = u.recipe_veg_id || rule?.recipe_veg_id
          const vegRName = (vegRId && recipeNameMap[vegRId]) || "Vianda Vegetariana"
          const vegIsPbt = isPbtRecipe(vegRName)
          if (vegQty > 0) {
            if (vegIsPbt) vegPbt += vegQty
            else vegCiabatta += vegQty
          }

          // Vegana
          const veganQty = Number(u.vegana) || 0
          const veganRId = u.recipe_vegan_id || rule?.recipe_vegan_id
          const veganRName = (veganRId && recipeNameMap[veganRId]) || "Vianda Vegana"
          const veganIsPbt = isPbtRecipe(veganRName)
          if (veganQty > 0) {
            if (veganIsPbt) veganPbt += veganQty
            else veganCiabatta += veganQty
          }

          // Sin TACC
          const sinQty = Number(u.sin_tacc) || 0
          if (sinQty > 0) {
            sinTacc += sinQty
          }

          // Other counts
          water += (Number(u.water_qty) || Number(u.water) || 0)
          sold += (Number(u.sold_qty) || 0)
          liberated += (Number(u.liberated_qty) || 0)

          // Specials
          if (u.special_breakdown) {
            try {
              const details = JSON.parse(u.special_breakdown)
              if (Array.isArray(details)) {
                details.forEach((d: any) => {
                  const sQty = Number(d.qty) || 0
                  const sNote = (d.note || '').trim()
                  if (sQty > 0 || sNote !== '') {
                    if (d.type === 'traditional') {
                      const targetKey = tradIsPbt ? 'trad_pebete' : 'trad_ciabatta'
                      specialsMap[targetKey].push({ qty: sQty, note: sNote })
                    } else if (d.type === 'vegetarian') {
                      const targetKey = vegIsPbt ? 'veg_pebete' : 'veg_ciabatta'
                      specialsMap[targetKey].push({ qty: sQty, note: sNote })
                    } else if (d.type === 'vegana') {
                      const targetKey = veganIsPbt ? 'vegan_pebete' : 'vegan_ciabatta'
                      specialsMap[targetKey].push({ qty: sQty, note: sNote })
                    } else if (d.type === 'sin_tacc') {
                      specialsMap.sin_tacc.push({ qty: sQty, note: sNote })
                    }
                  }
                })
              }
            } catch (e) { /* ignore parse error */ }
          }
        })

        const items = [
          {
            key: "trad_ciabatta",
            label: "TRADICIONAL CIABATTA",
            bread: "CIABATTA",
            qty: tradCiabatta,
            color: "bg-slate-900",
            isPbt: false
          },
          {
            key: "trad_pebete",
            label: "TRADICIONAL PEBETE",
            bread: "PEBETE",
            qty: tradPbt,
            color: "bg-amber-600",
            isPbt: true
          },
          {
            key: "veg_ciabatta",
            label: "VEGETARIANA CIABATTA",
            bread: "CIABATTA",
            qty: vegCiabatta,
            color: "bg-emerald-600",
            isPbt: false
          },
          {
            key: "veg_pebete",
            label: "VEGETARIANA PEBETE",
            bread: "PEBETE",
            qty: vegPbt,
            color: "bg-amber-600",
            isPbt: true
          },
          {
            key: "vegan_ciabatta",
            label: "VEGANA CIABATTA",
            bread: "CIABATTA",
            qty: veganCiabatta,
            color: "bg-emerald-500",
            isPbt: false
          },
          {
            key: "vegan_pebete",
            label: "VEGANA PEBETE",
            bread: "PEBETE",
            qty: veganPbt,
            color: "bg-amber-600",
            isPbt: true
          },
          {
            key: "sin_tacc",
            label: "SIN TACC",
            bread: "SIN TACC",
            qty: sinTacc,
            color: "bg-indigo-600",
            isPbt: false
          },
          { 
            key: "water", 
            label: "AGUA MINERAL", 
            bread: "BEBIDA", 
            qty: water, 
            color: "bg-sky-500",
            isPbt: false
          },
        ]

        setConsolidado({
          total: tradCiabatta + tradPbt + vegCiabatta + vegPbt + veganCiabatta + veganPbt + sinTacc,
          sold,
          liberated,
          items,
          specials: specialsMap,
          companies: [],
          headerCount: currentHeaders.length,
          headers: currentHeaders,
          units,
          pendingOnlineOrdersCount: pendingOnlineOrders.length
        })
      } catch (err) {
        console.error("Error consolidando producción:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchConsolidado()
  }, [selectedDate, eventos])

  if (initialLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
    </div>
  )

  const uniqueDates = Array.from(new Set(eventos.map(e => e.event_date))).sort()
  const totalProjectedPax = eventsForSelectedDate.reduce((acc, e) => acc + (e.total_projected_pax || e.pax_projected || 0), 0)

  const handleCopyCocina = () => {
    if (!consolidado || !selectedDate) return
    
    const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')
    const artists = eventsForSelectedDate.map(e => e.show_name).filter(Boolean).join(' + ')
    const venues = eventsForSelectedDate.map(e => e.venue_name || e.venue).filter(Boolean).join(' + ')
    
    const getItemQty = (k: string) => consolidado.items.find((i: any) => i.key === k)?.qty || 0
    
    const tradCiabatta = getItemQty('trad_ciabatta')
    const tradPbt = getItemQty('trad_pebete')
    const vegCiabatta = getItemQty('veg_ciabatta')
    const vegPbt = getItemQty('veg_pebete')
    const veganCiabatta = getItemQty('vegan_ciabatta')
    const veganPbt = getItemQty('vegan_pebete')
    const sinTacc = getItemQty('sin_tacc')
    const water = getItemQty('water')
    
    const totalFood = consolidado.total

    // Specials extraction
    const specialsLines: string[] = []
    const specialsLabels: Record<string, string> = {
      trad_ciabatta: 'Tradicional Ciabatta',
      trad_pebete: 'Tradicional Pebete',
      veg_ciabatta: 'Vegetariana Ciabatta',
      veg_pebete: 'Vegetariana Pebete',
      vegan_ciabatta: 'Vegana Ciabatta',
      vegan_pebete: 'Vegana Pebete',
      sin_tacc: 'Sin TACC'
    }

    Object.entries(consolidado.specials || {}).forEach(([catKey, list]: [string, any]) => {
      if (Array.isArray(list)) {
        list.forEach((s: any) => {
          const qty = Number(s.qty) || 1
          const note = (s.note || '').trim()
          if (note) {
            const catName = specialsLabels[catKey] || 'Vianda'
            specialsLines.push(`• ${qty > 0 ? `*${qty}x* ` : ''}${catName}: _"${note}"_`)
          }
        })
      }
    })

    const lines: string[] = [
      `👨‍🍳 *PLAN DE COCINA — ${formattedDate}*`,
      `📍 *${artists}* ${venues ? `(${venues})` : ''}`,
      ``,
      `🥪 *TOTAL SÁNDWICHES: ${totalFood} un.*`,
      `───────────────────`
    ]

    if (tradCiabatta > 0) lines.push(`• *${tradCiabatta} un.* TRADICIONAL CIABATTA`)
    if (tradPbt > 0) lines.push(`• *${tradPbt} un.* TRADICIONAL PEBETE 🚨 *(PAN PEBETE)*`)
    if (vegCiabatta > 0) lines.push(`• *${vegCiabatta} un.* VEGETARIANA CIABATTA`)
    if (vegPbt > 0) lines.push(`• *${vegPbt} un.* VEGETARIANA PEBETE 🚨 *(PAN PEBETE)*`)
    if (veganCiabatta > 0) lines.push(`• *${veganCiabatta} un.* VEGANA CIABATTA`)
    if (veganPbt > 0) lines.push(`• *${veganPbt} un.* VEGANA PEBETE 🚨 *(PAN PEBETE)*`)
    if (sinTacc > 0) lines.push(`• *${sinTacc} un.* SIN TACC`)

    lines.push(`───────────────────`)
    lines.push(`💧 *AGUAS MINERALES: ${water} un.*`)

    if (specialsLines.length > 0) {
      lines.push(``)
      lines.push(`⚠️ *Pedidos Especiales:*`)
      lines.push(...specialsLines)
    }

    const text = lines.join('\n')
    navigator.clipboard.writeText(text)
    alert("Copiado al portapapeles para WhatsApp (Cocina)")
  }

  const handleCopyFletero = () => {
    if (!consolidado || !selectedDate) return
    
    const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')
    const artists = eventsForSelectedDate.map(e => e.show_name).filter(Boolean).join(' + ')
    const venues = eventsForSelectedDate.map(e => e.venue_name || e.venue).filter(Boolean).join(' + ')
    
    const getItemQty = (k: string) => consolidado.items.find((i: any) => i.key === k)?.qty || 0
    const trad = getItemQty('trad_ciabatta') + getItemQty('trad_pebete')
    const veg = getItemQty('veg_ciabatta') + getItemQty('veg_pebete')
    const vegan = getItemQty('vegan_ciabatta') + getItemQty('vegan_pebete')
    const st = getItemQty('sin_tacc')
    const water = getItemQty('water')
    const totalFood = consolidado.total

    let text = `*Hoja de Ruta Fletero* - ${formattedDate}\n`
    text += `*Destino (Venue):* ${venues}\n`
    text += `*Detalle de Carga:* Desglose simplificado para el envío del Artista: ${artists}.\n`
    text += `- Total Comida: ${totalFood} sándwiches (Tradicional: ${trad}, Vegetariana: ${veg}, Vegana: ${vegan}, Sin TACC: ${st})\n`
    text += `- Aguas: ${water} unidades`

    navigator.clipboard.writeText(text)
    alert("Copiado al portapapeles para WhatsApp (Fletero)")
  }

  const handleCopyLogistica = () => {
    if (!consolidado || !selectedDate) return
    
    const fecha = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')
    const artista = eventsForSelectedDate.map(e => e.show_name).join(' + ')
    const venue = eventsForSelectedDate.map(e => e.venue_name || e.venues?.name || e.venue).join(' + ')
    
    const rawTime = eventsForSelectedDate[0]?.load_time || eventsForSelectedDate[0]?.event_time || eventsForSelectedDate[0]?.horario_carga || eventsForSelectedDate[0]?.horario || "21:30"
    const loadTime = rawTime.replace(':', '.')
    
    const waterQty = consolidado.items.find((i: any) => i.key === "water")?.qty || 0
    
    const text = `*Hoja de Ruta Logistica* - ${fecha}\n` +
      `*Horario de carga:* ${loadTime} hs\n` +
      `*Destino (Venue):* ${venue}\n` +
      `*Detalle de Carga:* Desglose simplificado para el envío del Artista: ${artista}.\n` +
      `- Total Comida: ${consolidado.total} sándwiches\n` +
      `- Aguas: ${waterQty} unidades`
      
    navigator.clipboard.writeText(text)
    alert("Copiado para WhatsApp (Logística) con éxito!")
  }

  const handlePrint = () => {
    if (!consolidado || !selectedDate) return
    const docFileTitle = `CONSOLIDADO-COCINA-${selectedDate}`
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Generar Remitos por Empresa / Unidad
    const remitosHtml = (consolidado.headers || []).flatMap((h: any) => {
      const event = eventsForSelectedDate.find(e => e.id === h.event_master_id || e.id === h.event_id)
      const headerUnits = (consolidado.units || []).filter((u: any) => u.header_id === h.id)
      
      const client = (consolidado.clients || []).find((c: any) => c.name?.toLowerCase() === h.company_name?.toLowerCase())
      const headerAssignments = [...(consolidado.assignments || [])].filter((a: any) => a.event_id === h.event_master_id && a.client_id === client?.id)

      return headerUnits.map((u: any) => {
        const assign = headerAssignments.shift()
        const vehName = assign?.vehicles?.internal_name || 'Desconocido'
        const vehPlate = assign?.vehicles?.plate || 'Sin Patente'
        const coordName = assign?.coordinators?.name || 'S/D'
        const coordPhone = assign?.coordinators?.phone || 'S/D'
        
        const totalSandwiches = (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0)
        const totalLiquids = Number(u.water_qty) || Number(u.water) || 0

        let specialNotes: string[] = []
        try {
          if (u.special_breakdown) {
            const details = JSON.parse(u.special_breakdown)
            if (Array.isArray(details)) {
              details.forEach((d: any) => {
                if (d.note && d.note.trim() !== '') {
                  specialNotes.push(`• ${d.qty > 0 ? d.qty + 'x ' : ''}${d.type === 'traditional' ? 'traditional' : d.type} - ${d.note.toUpperCase()}`)
                }
              })
            }
          }
        } catch (e) {}

        const obsText = u.observations || ''
        const showObs = obsText.trim() !== '' || specialNotes.length > 0

        return `
          <!-- Salto de página para el remito -->
          <div style="page-break-before: always; padding-top: 10px;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 4px solid #000; padding-bottom: 5px;">
            <div>
              <h2 style="font-size: 24px; font-weight: 900; margin: 0; color: #000; text-transform: uppercase; letter-spacing: -0.5px;">REMITO DE DESCARGA POR EMPRESA</h2>
              <h3 style="font-size: 16px; font-weight: 900; margin: 4px 0 0 0; color: #2563eb; text-transform: uppercase;">UNIDAD: ${u.unit_name || 'MICRO 1'}</h3>
            </div>
          </div>

          <div style="border: 2px solid #cbd5e1; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; background-color: #f8fafc; font-family: Arial, sans-serif;">
            <div>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">EMPRESA DE TRANSPORTE</span> <strong style="font-size: 14px; color: #0f172a;">${h.company_name || h.company || 'S/D'}</strong></p>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">VEHÍCULO / PATENTE</span> <strong style="font-size: 14px; color: #0f172a;">${vehName} (${vehPlate})</strong></p>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">COORDINADOR / RESPONSABLE</span> <strong style="font-size: 14px; color: #0f172a;">${coordName}</strong></p>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">TELÉFONO COORDINADOR</span> <strong style="font-size: 14px; color: #0f172a;">${coordPhone}</strong></p>
            </div>
            <div>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">EVENTO / SHOW</span> <strong style="font-size: 14px; color: #0f172a;">${event?.show_name || 'S/D'}</strong></p>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">FECHA</span> <strong style="font-size: 14px; color: #0f172a;">${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')}</strong></p>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">HORARIO DE DESCARGA</span> <strong style="font-size: 14px; color: #0f172a;">${h.delivery_time || 'S/D'}</strong></p>
              <p style="margin: 4px 0;"><span style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8px; display: block; margin-bottom: 2px;">PUNTO DE ENTREGA / VENUE</span> <strong style="font-size: 13px; color: #0f172a;">${h.delivery_point || 'S/D'} ${h.delivery_address ? '- ' + h.delivery_address : ''}</strong></p>
            </div>
          </div>

          <h4 style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 15px 0 8px 0; border-bottom: 2px solid #000; padding-bottom: 4px;">1. DETALLE DE VIANDAS (SÓLIDOS)</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; font-family: Arial, sans-serif;">
            <thead>
              <tr style="border-bottom: 2px solid #000;">
                <th style="text-align: left; padding: 6px 0; text-transform: uppercase; font-size: 9px; color: #64748b;">TIPO DE MENÚ</th>
                <th style="text-align: right; padding: 6px 10px; background: #000; color: #fff; font-size: 9px; width: 100px;">CANTIDAD</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; font-weight: bold;">Menú Tradicional</td>
                <td style="text-align: right; padding: 8px 10px; font-weight: bold; font-size: 14px;">${u.traditional || 0}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; font-weight: bold;">Menú Vegetariano</td>
                <td style="text-align: right; padding: 8px 10px; font-weight: bold; font-size: 14px;">${u.vegetarian || 0}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; font-weight: bold;">Menú Vegano</td>
                <td style="text-align: right; padding: 8px 10px; font-weight: bold; font-size: 14px;">${u.vegana || 0}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; font-weight: bold;">Menú Sin TACC</td>
                <td style="text-align: right; padding: 8px 10px; font-weight: bold; font-size: 14px;">${u.sin_tacc || 0}</td>
              </tr>
              <tr style="background: #e2e8f0; font-weight: bold;">
                <td style="padding: 0 10px; text-transform: uppercase; font-size: 11px; vertical-align: middle;">TOTAL SANDWICHES</td>
                <td style="text-align: right; padding: 0; width: 100px; vertical-align: middle;">
                  <div style="background: #000; color: #fff; padding: 10px; font-size: 16px; font-weight: 900; text-align: right;">${totalSandwiches}</div>
                </td>
              </tr>
            </tbody>
          </table>

          <h4 style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 15px 0 8px 0; border-bottom: 2px solid #000; padding-bottom: 4px;">2. DETALLE DE BEBIDAS (LÍQUIDOS)</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; font-family: Arial, sans-serif;">
            <thead>
              <tr style="border-bottom: 2px solid #000;">
                <th style="text-align: left; padding: 6px 0; text-transform: uppercase; font-size: 9px; color: #64748b;">TIPO DE BEBIDA</th>
                <th style="text-align: right; padding: 6px 10px; background: #000; color: #fff; font-size: 9px; width: 100px;">CANTIDAD</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; font-weight: bold;">Agua Sin Gas (500ml)</td>
                <td style="text-align: right; padding: 8px 10px; font-weight: bold; font-size: 14px;">${totalLiquids}</td>
              </tr>
              <tr style="background: #e2e8f0; font-weight: bold;">
                <td style="padding: 0 10px; text-transform: uppercase; font-size: 11px; vertical-align: middle;">TOTAL BEBIDAS</td>
                <td style="text-align: right; padding: 0; width: 100px; vertical-align: middle;">
                  <div style="background: #000; color: #fff; padding: 10px; font-size: 16px; font-weight: 900; text-align: right;">${totalLiquids}</div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style="border: 2px dashed #000; border-radius: 12px; padding: 15px; margin-top: 15px; font-size: 11px; background-color: #fff; font-family: Arial, sans-serif;">
            <span style="font-weight: 900; text-transform: uppercase; display: block; margin-bottom: 6px; font-size: 9px; color: #64748b;">OBSERVACIONES OPERATIVAS</span>
            ${showObs ? `
              ${obsText.trim() !== '' ? `<p style="margin: 2px 0; font-style: italic; font-weight: bold;">${obsText}</p>` : ''}
              ${specialNotes.map(n => `<p style="margin: 2px 0; font-weight: bold; text-transform: uppercase;">${n}</p>`).join('')}
            ` : '<p style="margin: 2px 0; font-style: italic; color: #64748b;">Sin observaciones...</p>'}
          </div>

          <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 10px; font-family: Arial, sans-serif;">
            Generado por Super Catering Manager — ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        `
      })
    }).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>${docFileTitle}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; background: white; }
            .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
            .date-title { font-size: 42px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1; }
            .show-info { font-size: 16px; font-weight: 700; color: #64748b; margin-top: 10px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; border-top: 1px solid #eee; padding-top: 10px; }
            .stat-box { text-align: center; }
            .stat-label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
            .stat-value { font-size: 24px; font-weight: 900; }
            .items-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
            .item-card { border: 2px solid #0f172a; border-radius: 15px; padding: 15px; text-align: center; }
            .item-card.pbt-card { border-color: #d97706; background-color: #fffbeb; }
            .item-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; }
            .item-qty { font-size: 42px; font-weight: 900; display: block; margin: 4px 0; line-height: 1; }
            .special-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 8px; margin-top: 8px; text-align: left; }
            .special-item { font-size: 11px; font-weight: 800; color: #92400e; margin-bottom: 2px; }
            .total-banner { grid-column: 1 / -1; background: #0f172a; color: white; padding: 16px 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
            .total-label { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #94a3b8; }
            .total-value { font-size: 42px; font-weight: 900; line-height: 1; }
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; font-style: italic; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <p style="margin:0; font-size:12px; font-weight:900; color:#6366f1; letter-spacing:0.2em; text-transform:uppercase;">Centro de Producción Consolidado</p>
            <h1 class="date-title">${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')}</h1>
            <div class="show-info">
              ${eventsForSelectedDate.map(e => e.show_name + ' @ ' + (e.venue_name || e.venue)).join(' + ')}
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <p class="stat-label">PAX Proyectados</p>
              <p class="stat-value">${totalProjectedPax}</p>
            </div>
            <div class="stat-box">
              <p class="stat-label">Unidades en Venta</p>
              <p class="stat-value">${consolidado.sold + consolidado.liberated}</p>
            </div>
          </div>

          <div class="items-grid">
            ${consolidado.items.map((item:any) => `
              <div class="item-card ${item.isPbt && item.qty > 0 ? 'pbt-card' : ''}">
                <span class="item-label">${item.label}</span>
                <span class="item-qty" style="${item.isPbt && item.qty > 0 ? 'color: #b45309;' : ''}">${item.qty}</span>
                ${(consolidado.specials?.[item.key] || []).length > 0 ? `
                  <div class="special-box">
                    ${consolidado.specials[item.key].map((s:any) => `<div class="special-item">▸ ${s.qty > 0 ? s.qty + 'x ' : ''}"${s.note}"</div>`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}

            <div class="total-banner">
              <div>
                <p class="total-label">Total Producción Comida</p>
                <p style="margin:0; font-size:11px; color:#a5b4fc; font-weight:bold;">Suma consolidada de todas las viandas</p>
              </div>
              <span class="total-value">${consolidado.total}</span>
            </div>
          </div>

          <div class="footer">
            Generado por Super Catering Manager — ${new Date().toLocaleString('es-AR')} — ${docFileTitle}.pdf
          </div>

          ${remitosHtml}

          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
          <script>
            window.onload = function() {
              var element = document.body;
              var opt = {
                margin:       10,
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



  const today = new Date()
  const todayDate = new Date(today)
  todayDate.setHours(0,0,0,0)
  const formatCurrency = (val: any) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(num)
  }

  return (
    <div className="max-w-7xl mx-auto p-2 sm:p-6 md:p-10 space-y-6 md:space-y-10">
      
      {/* Estilos locales para inyectar CSS que oculte barras de scroll nativas en paneles verticales */}
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
      <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
        
        {/* COLUMNA 1 y 2: PLAN DE COCINA CONSOLIDADO */}
        <div className="lg:col-span-2 space-y-6 md:space-y-10">
          
          {/* CONTROL PANEL */}
          <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-5 sm:p-8 shadow-xs border border-slate-100 print:hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 md:gap-6">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <ChefHat size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Centro de Producción</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">Plan de Cocina Consolidado</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Agrupado por Evento — suma de TODAS las empresas</p>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto items-stretch sm:items-center">
                <select
                  className="bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-2xl font-bold w-full md:w-72 outline-none focus:ring-2 focus:ring-indigo-50 transition text-base md:text-sm"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}>
                  <option value="">-- Seleccionar Día de Producción --</option>
                  {uniqueDates.map(date => {
                    const evs = eventos.filter(e => e.event_date === date)
                    const showNames = evs.map(e => e.show_name).join(' + ')
                    return (
                      <option key={date} value={date}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('es-AR')} — {showNames}
                      </option>
                    )
                  })}
                </select>
                
                {consolidado && (
                  <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handleCopyCocina}
                      className="bg-emerald-600 text-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl hover:bg-emerald-700 transition shadow-md text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                      title="Copiar pedido para WhatsApp (Cocina)"
                    >
                      <MessageSquare size={16} /> Cocina
                    </button>
                    
                    <button 
                      onClick={handleCopyLogistica}
                      className="bg-blue-600 text-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl hover:bg-blue-700 transition shadow-md text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                      title="Copiar hoja de ruta para WhatsApp (Logística)"
                    >
                      <Truck size={16} /> Logística
                    </button>
                  </div>
                )}

                <button onClick={handlePrint}
                  className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl hover:bg-slate-800 transition shadow-lg flex items-center justify-center shrink-0 min-h-[44px]"
                  title="Imprimir PDF Consolidado">
                  <Printer size={20} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
          ) : consolidado ? (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Date Header */}
              <div className="text-center space-y-3 border-b-4 border-slate-900 pb-6 md:pb-8">
                <h2 className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR')}
                </h2>
                <div className="flex flex-col justify-center items-center gap-2 mt-4">
                  {eventsForSelectedDate.map(e => (
                     <span key={e.id} className="flex flex-wrap items-center justify-center gap-1.5 text-sm sm:text-lg font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl text-center">
                       <Calendar size={15} /> {e.show_name} <ChevronRight size={15} /> {e.venue_name || e.venues?.name || e.venue}
                     </span>
                  ))}
                </div>

                {/* PAX Summary */}
                <div className="flex justify-center gap-4 sm:gap-6 mt-4">
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase">PAX Proyectados</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800">{totalProjectedPax}</p>
                  </div>
                  <div className="w-px bg-slate-200" />
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase">Unidades Cargadas</p>
                    <p className="text-2xl sm:text-3xl font-black text-indigo-600">{consolidado.sold + consolidado.liberated}</p>
                  </div>
                </div>
              </div>

              {/* Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {consolidado.items.map((item: any) => {
                  const itemSpecials = consolidado.specials?.[item.key] || []
                  const isZero = item.qty === 0
                  const isPbt = !!item.isPbt
                  
                  return (
                    <div 
                      key={item.key} 
                      className={`rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-between text-center transition-all ${
                        isPbt && !isZero 
                          ? 'bg-amber-50/50 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/20' 
                          : isZero
                            ? 'bg-slate-50/70 border border-slate-200 opacity-60'
                            : 'bg-white border-2 border-slate-900 shadow-xs'
                      }`}
                    >
                      {/* Header Badge & Label */}
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <div className="flex items-center gap-1.5">
                          {isPbt ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isZero ? 'bg-slate-200 text-slate-500' : 'bg-amber-500 text-white animate-pulse'
                            }`}>
                              🚨 Pan Pebete
                            </span>
                          ) : item.bread === 'CIABATTA' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                              🥖 Pan Ciabatta
                            </span>
                          ) : item.key === 'sin_tacc' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                              🌾 Sin TACC
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-700">
                              💧 Bebida
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-black text-slate-600 uppercase tracking-wider leading-tight min-h-[32px] flex items-center justify-center">
                          {item.label}
                        </span>
                      </div>

                      {/* Big Quantity */}
                      <div className="my-3 sm:my-4">
                        <span className={`text-6xl sm:text-7xl font-black tabular-nums tracking-tighter ${
                          isZero ? 'text-slate-200' : isPbt ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {item.qty}
                        </span>
                        <span className="text-[11px] font-extrabold text-slate-400 block -mt-1 uppercase tracking-wider">unidades</span>
                      </div>

                      {/* Specials */}
                      {itemSpecials.length > 0 ? (
                        <div className="w-full border-t border-dashed border-amber-300 pt-2 flex flex-col gap-1 text-left">
                          {itemSpecials.map((s: any, i: number) => (
                            <div key={i} className="bg-amber-100/90 px-2.5 py-1.5 rounded-xl border border-amber-300 text-amber-900 text-xs font-black flex items-center justify-between">
                              {s.qty > 0 && <span className="text-amber-700 mr-1.5 font-black">{s.qty}x</span>}
                              <span className="italic uppercase truncate">"{s.note}"</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-1" />
                      )}
                    </div>
                  )
                })}

                {/* Total */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-slate-900 text-white rounded-3xl md:rounded-[2.5rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="p-3.5 sm:p-5 bg-white/10 rounded-2xl">
                      <Calculator size={32} className="sm:w-12 sm:h-12 text-indigo-400" />
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-base sm:text-xl font-black uppercase tracking-widest text-slate-300">Total Producción Comida</h3>
                      <p className="text-xs sm:text-sm font-semibold text-indigo-300">Suma consolidada de todas las viandas para el evento</p>
                    </div>
                  </div>
                  <div className="text-center sm:text-right">
                    <span className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter tabular-nums text-white">{consolidado.total}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block -mt-1">sándwiches en total</span>
                  </div>
                </div>
              </div>

              <div className="text-center p-6 sm:p-10 border-t-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-widest italic">
                  Sistema Super Catering Manager — {isMounted ? new Date().toLocaleString('es-AR') : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 sm:py-40 space-y-4 sm:space-y-6 bg-slate-50 rounded-3xl md:rounded-[4rem] border-4 border-dashed border-slate-200 print:hidden p-4">
              <TableIcon className="mx-auto text-slate-200" size={64} />
              <div>
                <h3 className="text-lg sm:text-2xl font-black text-slate-400 uppercase tracking-widest">Esperando Selección</h3>
                <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-sm mx-auto">Elegí una fecha para generar la hoja de producción consolidada para todo ese día.</p>
              </div>
            </div>
          )}
        </div>
        {/* COLUMNA 3: MERCADERÍA A RECIBIR (1/3 de ancho) - Solo visible en pantalla (print:hidden) */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-8 shadow-xl shadow-slate-200/50 print:hidden">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                <Truck className="text-indigo-600 animate-pulse" size={28} /> 
                Recibir esta Semana
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Mercadería a recibir de proveedores.</p>
            </div>
            {incomingPOs.length > 0 && (
              <button
                onClick={handleCopyPendingPOs}
                className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition shadow-sm"
                title="Copiar entregas de la semana"
              >
                <Copy size={16} />
              </button>
            )}
          </div>
          
          {/* Contenedor con scroll vertical limpio para entregas de mercadería */}
          <div className="relative group/scroll-po">
             <div className="space-y-4 max-h-[780px] overflow-y-auto pr-2 scrollbar-none scroll-smooth pb-10">
                {poLoading || !isMounted ? (
                   <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando entregas...</p>
                   </div>
                ) : incomingPOs.length === 0 ? (
                   <div className="py-16 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                      <Package className="mx-auto text-slate-300 mb-3" size={32} />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin entregas pendientes</p>
                   </div>
                ) : (
                   incomingPOs.map((po, index) => {
                      const poDate = new Date(po.fecha_esperada + 'T12:00:00')
                      const isOverdue = poDate < todayDate
                      const isPoToday = po.fecha_esperada === today.toISOString().split('T')[0]
                      
                      const weekday = poDate.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '')
                      const dayNum = poDate.getDate()
                      const monthName = poDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '')
                      
                      return (
                         <div 
                            key={po.id} 
                            className={`p-4 rounded-[1.5rem] border transition-all duration-300 relative hover:shadow-md ${
                               isPoToday 
                                  ? 'border-emerald-400 bg-emerald-50/10 ring-2 ring-emerald-50 shadow-sm' 
                                  : isOverdue 
                                     ? 'border-rose-300 bg-rose-50/10' 
                                     : 'border-slate-200 hover:border-indigo-300 bg-white shadow-sm'
                            }`}
                         >
                            <div className="flex justify-between items-start gap-2">
                               <div className="flex gap-3 min-w-0 flex-1 items-center">
                                  <div className={`flex flex-col items-center justify-center w-10 h-12 rounded-xl border text-center shrink-0 ${
                                     isPoToday 
                                        ? 'bg-emerald-500 border-emerald-600 text-white' 
                                        : isOverdue 
                                           ? 'bg-rose-500 border-rose-600 text-white animate-pulse' 
                                           : 'bg-slate-50 border-slate-100 text-slate-700'
                                  }`}>
                                     <span className="text-[8px] font-black leading-none uppercase">{weekday}</span>
                                     <span className="text-sm font-black leading-none mt-0.5">{dayNum}</span>
                                  </div>
                                  
                                  <div className="min-w-0 flex-1">
                                     <div className="flex items-center gap-1.5 flex-wrap">
                                        {isOverdue && (
                                           <span className="bg-rose-100 text-rose-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                              Atrasado
                                           </span>
                                        )}
                                        {isPoToday && (
                                           <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                              Hoy
                                           </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-400">
                                           {monthName}
                                        </span>
                                     </div>
                                     
                                     <h4 className="font-black text-slate-800 text-sm uppercase mt-0.5 leading-tight truncate" title={po.proveedores?.nombre}>
                                        {po.proveedores?.nombre || 'Proveedor Eliminado'}
                                     </h4>
                                  </div>
                               </div>
                            </div>
                            
                            <div className="mt-3 pt-2.5 border-t border-slate-100">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Insumos Solicitados:</p>
                               <ul className="space-y-1">
                                  {po.purchase_order_items?.map((item: any, idx: number) => (
                                     <li key={idx} className="text-[11px] font-semibold text-slate-600 flex items-center justify-between gap-1.5">
                                        <span className="flex items-center gap-1.5 min-w-0">
                                           <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                                           <span className="truncate max-w-[130px] md:max-w-[150px]" title={item.productos?.nombre}>{item.productos?.nombre}</span>
                                        </span>
                                        <span className="font-black text-indigo-700 tabular-nums shrink-0">{item.cantidad} {item.productos?.unidad_medida || 'un'}</span>
                                     </li>
                                  ))}
                               </ul>
                            </div>
                            
                            {/* Costo Est. visible para la cocina */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
                               <span className="font-black text-slate-400 uppercase tracking-widest">Costo Est.</span>
                               <span className="font-black text-slate-800 tabular-nums">{formatCurrency(po.costo_total)}</span>
                            </div>
                            <button
                              onClick={() => setReceivingPoId(po.id)}
                              className="mt-3 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Truck size={14} />
                              Recibir
                            </button>
                         </div>
                      )
                   })
                )}
             </div>
             {/* Gradiente sutil indicador al final de la columna scrollable */}
             <div className="absolute left-0 right-2 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none opacity-90" />
          </div>
        </div>

      </div>
      {receivingPoId && (
        <ReceivePOModal
          orderId={receivingPoId}
          onClose={() => setReceivingPoId(null)}
          onSuccess={handlePORecievedSuccess}
        />
      )}

      <style jsx global>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .max-w-7xl { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
          nav, aside, header, .print\\:hidden { display: none !important; }
          .shadow-sm, .shadow-lg, .shadow-2xl { box-shadow: none !important; }
          .bg-slate-900 { background-color: black !important; -webkit-print-color-adjust: exact; }
          .rounded-\\[3rem\\] { border-radius: 0 !important; border: 4px solid black !important; }
        }
      `}</style>
    </div>
  )
}