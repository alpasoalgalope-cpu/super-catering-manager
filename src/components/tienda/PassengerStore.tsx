'use client'

import { useState, useMemo, useEffect } from 'react'
import { OnlineStoreEvent } from '@/types/online-sales'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  Minus, 
  User, 
  Mail, 
  Phone, 
  Bus, 
  Calendar, 
  Loader2, 
  CreditCard,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react'

interface PassengerStoreProps {
  store: OnlineStoreEvent
  busAssignments?: any[]
  coordinators?: any[]
}

const COMBO_ICONS = {
  tradicional: { emoji: "🥪", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  vegetariano: { emoji: "🥗", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  sintacc: { emoji: "🌾", bg: "bg-sky-50 text-sky-700 border-sky-200" },
  vegano: { emoji: "🌱", bg: "bg-teal-50 text-teal-700 border-teal-200" },
}

function cleanNormalizedString(str: string) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getStoreCompany(title: string = '', slug: string = ''): string {
  const parts = title.split(/[—–-]/).map((x: string) => x.trim())
  if (parts.length > 1) {
    return parts[parts.length - 1]
  }
  return slug
}

export default function PassengerStore({ store, busAssignments = [] }: PassengerStoreProps) {
  const [combos, setCombos] = useState({
    tradicional: 0,
    vegetariano: 0,
    sintacc: 0,
    vegano: 0,
  })

  const [liveAssignments, setLiveAssignments] = useState<any[] | null>(busAssignments || null)

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    travelDate: store.available_dates?.[0] || store.events_master?.event_date || '',
    busIdentifier: '',
  })

  // Sync live assignments from props
  useEffect(() => {
    if (busAssignments) {
      setLiveAssignments(busAssignments)
    }
  }, [busAssignments])

  // Client-side fallback to guarantee assignments load even with aggressive SSR caching
  useEffect(() => {
    async function fetchLiveAssignments() {
      try {
        const rawStoreCompany = getStoreCompany(store.title, store.slug)
        const cleanStoreComp = cleanNormalizedString(rawStoreCompany)

        const eventIds: string[] = []
        if (store.event_master_id) {
          eventIds.push(store.event_master_id)
        } else if (store.available_dates && store.available_dates.length > 0) {
          const showName = (store.title || '').split(/[—–-]/)[0]?.trim()
          const { data: dateEvents } = await supabase
            .from('events_master')
            .select('id')
            .in('event_date', store.available_dates)
            .ilike('show_name', `%${showName}%`)

          if (dateEvents) {
            dateEvents.forEach(e => {
              if (!eventIds.includes(e.id)) eventIds.push(e.id)
            })
          }
        }

        if (eventIds.length === 0) {
          setLiveAssignments([])
          return
        }

        const { data: assignments, error } = await supabase
          .from('event_bus_assignments')
          .select(`
            id,
            event_id,
            crew_count,
            events_master (
              id,
              event_date,
              show_name
            ),
            clients (
              id,
              name,
              company
            ),
            vehicles (
              id,
              internal_name,
              vehicle_type
            ),
            coordinators (
              id,
              name,
              phone,
              company
            )
          `)
          .in('event_id', eventIds)

        if (assignments && assignments.length > 0) {
          if (cleanStoreComp) {
            const filtered = assignments.filter((a: any) => {
              const clientObj = Array.isArray(a.clients) ? a.clients[0] : a.clients
              const coordObj = Array.isArray(a.coordinators) ? a.coordinators[0] : a.coordinators

              const clientNameClean = cleanNormalizedString(clientObj?.name || clientObj?.company || '')
              const coordCompClean = cleanNormalizedString(coordObj?.company || '')

              const matchClient = clientNameClean && cleanStoreComp && (
                clientNameClean === cleanStoreComp ||
                clientNameClean.includes(cleanStoreComp) ||
                cleanStoreComp.includes(clientNameClean)
              )

              const matchCoord = coordCompClean && cleanStoreComp && (
                coordCompClean === cleanStoreComp ||
                coordCompClean.includes(cleanStoreComp) ||
                cleanStoreComp.includes(coordCompClean)
              )

              return matchClient || matchCoord
            })
            setLiveAssignments(filtered)
          } else {
            setLiveAssignments(assignments)
          }
        } else {
          setLiveAssignments([])
        }
      } catch (err) {
        console.error('Error fetching live assignments:', err)
      }
    }

    fetchLiveAssignments()
  }, [store])

  // Build options for Micro / Coordinator dropdown filtered strictly for this event's assignments
  const busOptions = useMemo(() => {
    const list: string[] = []
    const targetAssignments = liveAssignments !== null ? liveAssignments : (busAssignments || [])

    if (targetAssignments && targetAssignments.length > 0) {
      // Filter assignments by selected travelDate if available
      const matchingDate = targetAssignments.filter((b: any) => {
        const evDate = b.event_date || (Array.isArray(b.events_master) ? b.events_master[0]?.event_date : b.events_master?.event_date)
        if (!evDate || !formData.travelDate) return true
        return evDate === formData.travelDate
      })

      const targetList = matchingDate.length > 0 ? matchingDate : targetAssignments

      targetList.forEach((b: any) => {
        const vehicleObj = Array.isArray(b.vehicles) ? b.vehicles[0] : b.vehicles
        const coordObj = Array.isArray(b.coordinators) ? b.coordinators[0] : b.coordinators

        const vehicleName = vehicleObj?.internal_name?.trim() || ''
        const coorName = coordObj?.name?.trim() || ''

        let label = ''
        if (vehicleName && coorName) {
          label = `${vehicleName} (${coorName})`
        } else if (vehicleName) {
          label = vehicleName
        } else if (coorName) {
          label = coorName
        }

        if (label && !list.includes(label)) {
          list.push(label)
        }
      })
    }

    // If no specific bus/coordinator assignments are planned for this event & company, default to General / A coordinar
    if (list.length === 0) {
      list.push("General / A coordinar")
    }

    return list
  }, [liveAssignments, busAssignments, formData.travelDate])

  // Sync busIdentifier with busOptions
  useEffect(() => {
    if (busOptions.length > 0) {
      if (!formData.busIdentifier || !busOptions.includes(formData.busIdentifier)) {
        setFormData(prev => ({ ...prev, busIdentifier: busOptions[0] }))
      }
    }
  }, [busOptions])

  const [isLoading, setIsLoading] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState<string | null>(null)

  const isCircus = useMemo(() => {
    const t = cleanNormalizedString(store.title || '')
    const s = cleanNormalizedString(store.slug || '')
    return t.includes('circustour') || s.includes('circustour')
  }, [store.title, store.slug])

  const isWaterIncluded = useMemo(() => {
    if (isCircus) return false
    const trad = (store.combo_trad_name || '').toLowerCase()
    const desc = (store.combo_trad_desc || '').toLowerCase()
    return trad.includes('agua') || trad.includes('bebida') || desc.includes('agua')
  }, [store, isCircus])

  const formatProductTitle = (rawName?: string, defaultTitle: string = '') => {
    let text = rawName || defaultTitle
    if (isCircus || !isWaterIncluded) {
      text = text.replace(/^Combo\s+/i, 'Sándwich ').replace(/\s*\+\s*(Agua|Bebida).*$/i, '')
    } else {
      text = text.replace(/\+\s*Bebida/gi, '+ Agua sin Gas').replace(/\+\s*Agua(?!\s*sin\s*Gas)/gi, '+ Agua sin Gas')
    }
    return text
  }

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const updateQuantity = (type: keyof typeof combos, delta: number) => {
    setCombos(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta)
    }))
  }

  const calculateTotal = () => {
    return (
      combos.tradicional * (store.combo_trad_price || 0) +
      combos.vegetariano * (store.combo_veg_price || 0) +
      combos.sintacc * (store.combo_sintacc_price || 0) +
      combos.vegano * (store.combo_vegan_price || 0)
    )
  }

  const total = calculateTotal()
  const totalItems = Object.values(combos).reduce((a, b) => a + b, 0)
  
  // Validation checks
  const isTotalSelected = total > 0
  const isFormFilled = formData.fullName.trim() !== '' && formData.email.trim() !== '' && formData.phone.trim() !== '' && formData.travelDate !== '' && formData.busIdentifier !== ''
  const isValid = isTotalSelected && isFormFilled

  const handlePay = async () => {
    if (!isValid || isLoading) return
    setIsLoading(true)

    try {
      // 1. Upsert Customer
      const email = formData.email.toLowerCase().trim()
      const { data: existingCustomer } = await supabase
        .from('online_customers')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      let customerId

      if (existingCustomer) {
        await supabase
          .from('online_customers')
          .update({ 
            full_name: formData.fullName, 
            phone: formData.phone || null, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existingCustomer.id)
        customerId = existingCustomer.id
      } else {
        const { data: newCust, error: custError } = await supabase
          .from('online_customers')
          .insert([{ 
            email, 
            full_name: formData.fullName, 
            phone: formData.phone || null 
          }])
          .select()
          .single()
        
        if (custError) throw custError
        customerId = newCust.id
      }

      // 2. Create Order
      const { data: order, error: orderError } = await supabase
        .from('online_orders')
        .insert([{ 
          store_event_id: store.id, 
          customer_id: customerId, 
          travel_date: formData.travelDate, 
          bus_identifier: formData.busIdentifier || null, 
          qty_tradicional: combos.tradicional, 
          qty_vegetariano: combos.vegetariano, 
          qty_sintacc: combos.sintacc, 
          qty_vegano: combos.vegano, 
          price_trad_unit: store.combo_trad_price || 0, 
          price_veg_unit: store.combo_veg_price || 0, 
          price_sintacc_unit: store.combo_sintacc_price || 0, 
          price_vegan_unit: store.combo_vegan_price || 0, 
          total_amount: total, 
          status: 'pending_payment' 
        }])
        .select()
        .single()

      if (orderError) throw orderError

      // 3. Call MP API
      const response = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          storeSlug: store.slug,
          storeTitle: store.title,
          items: [
            ...(combos.tradicional > 0 ? [{ title: formatProductTitle(store.combo_trad_name, isCircus ? "Sándwich Tradicional" : "Combo Tradicional"), quantity: combos.tradicional, unit_price: store.combo_trad_price }] : []),
            ...(combos.vegetariano > 0 ? [{ title: formatProductTitle(store.combo_veg_name, isCircus ? "Sándwich Vegetariano" : "Combo Vegetariano"), quantity: combos.vegetariano, unit_price: store.combo_veg_price }] : []),
            ...(combos.sintacc > 0 ? [{ title: formatProductTitle(store.combo_sintacc_name, isCircus ? "Sándwich Sin TACC" : "Combo Sin TACC"), quantity: combos.sintacc, unit_price: store.combo_sintacc_price }] : []),
            ...(combos.vegano > 0 ? [{ title: formatProductTitle(store.combo_vegan_name, isCircus ? "Sándwich Vegano" : "Combo Vegano"), quantity: combos.vegano, unit_price: store.combo_vegan_price }] : []),
          ],
          customer: {
            name: formData.fullName,
            email: formData.email,
          }
        })
      })

      const mpData = await response.json()
      const redirectUrl = mpData.initPoint || mpData.sandboxInitPoint

      if (redirectUrl) {
        window.location.href = redirectUrl
      } else {
        throw new Error(mpData.error || 'No se pudo obtener el link de pago de Mercado Pago')
      }

    } catch (error: any) {
      console.error('Error creating order:', error)
      alert(`Error al procesar el pedido: ${error.message || 'Intente nuevamente'}`)
      setIsLoading(false)
    }
  }

  const renderProductCard = (
    type: keyof typeof combos,
    enabled: boolean | undefined,
    name: string,
    desc: string | null | undefined,
    price: number
  ) => {
    const isOutOfStock = enabled === false
    const qty = combos[type]
    const iconMeta = COMBO_ICONS[type] || COMBO_ICONS.tradicional

    return (
      <div 
        key={type}
        className={`bg-white rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${qty > 0 ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md' : 'border-slate-200 shadow-sm hover:shadow'}`}
      >
        <div>
          {/* Header Badge + Info button */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-xl p-2.5 rounded-xl border ${iconMeta.bg}`}>
              {iconMeta.emoji}
            </span>
            {desc && (
              <button
                type="button"
                onClick={() => setShowInfoModal(desc)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"
                title="Ver detalle de ingredientes"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>

          <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2">{name}</h3>
          {desc && <p className="text-[10px] sm:text-xs text-slate-400 mt-1 line-clamp-2 leading-tight">{desc}</p>}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{formatPrice(price)}</span>

          {/* Stepper Buttons */}
          {isOutOfStock ? (
            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-black uppercase tracking-wider">
              Sin Stock
            </span>
          ) : (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200/80">
            {qty > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => updateQuantity(type, -1)}
                  className="w-7 h-7 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-xs active:bg-slate-200 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-black text-xs sm:text-sm text-slate-900 w-5 text-center">{qty}</span>
              </>
            )}
            <button
              type="button"
              onClick={() => updateQuantity(type, 1)}
              className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs active:bg-indigo-600 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          )} 
        </div>
      </div>
    )
  }

  const renderFormData = () => (
    <div className="space-y-3">
      {/* Fecha & Micro en desplegables filtrados por empresa */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Fecha Viaje *
          </label>
          <select
            value={formData.travelDate}
            onChange={(e) => setFormData(d => ({ ...d, travelDate: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            {store.available_dates?.map((date) => (
              <option key={date} value={date}>
                {new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Micro / Coor *
          </label>
          <select
            value={formData.busIdentifier}
            onChange={(e) => setFormData(d => ({ ...d, busIdentifier: e.target.value }))}
            disabled={busOptions.length === 1 && (busOptions[0] === 'N/A' || busOptions[0] === 'General / A coordinar')}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
          >
            {busOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Nombre y Apellido */}
      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
          Nombre y Apellido *
        </label>
        <input
          type="text"
          placeholder="Ej: Juan Pérez"
          value={formData.fullName}
          onChange={(e) => setFormData(d => ({ ...d, fullName: e.target.value }))}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
        />
      </div>

      {/* Email & Telefono (WhatsApp) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Email *
          </label>
          <input
            type="email"
            placeholder="juan@email.com"
            value={formData.email}
            onChange={(e) => setFormData(d => ({ ...d, email: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Teléfono (WhatsApp) *
          </label>
          <input
            type="tel"
            placeholder="11 1234-5678"
            value={formData.phone}
            onChange={(e) => setFormData(d => ({ ...d, phone: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-28 lg:pb-12 font-sans">
      
      {/* PEDIDOSYA CLEAN RESPONSIVE HEADER */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hidden sm:block">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block leading-tight">
                Viandas Oficiales para el Viaje
              </span>
              <h1 className="text-base lg:text-lg font-black italic tracking-tight text-slate-900 uppercase">
                {store.title}
              </h1>
            </div>
          </div>
          
          {store.subtitle && (
            <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
              {store.subtitle}
            </span>
          )}
        </div>
      </header>

      {/* RESPONSIVE LAYOUT CONTAINER */}
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: MENU & PROMO BANNER (7 COLUMNS ON DESKTOP) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* BANNER PROMO */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 rounded-2xl p-5 text-white shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 block">
                  {isCircus || !isWaterIncluded ? "Sándwich Oficial de Regreso" : "Combo Oficial de Regreso"}
                </span>
                <h2 className="text-base sm:text-lg font-black uppercase italic">
                  {isWaterIncluded ? "Sándwich en Ciabatta + Agua Mineral" : "Sándwich Artesanal en Ciabatta"}
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Reservá tu vianda para el viaje de regreso con confirmación inmediata.
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-amber-400 shrink-0 ml-3 hidden sm:block" />
            </div>

            {/* CIABATTA PHOTO SHOWCASE */}
            <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200/90 group bg-slate-100">
              <img 
                src="/images/ciabatta_combo.jpg" 
                alt={isWaterIncluded ? "Combo Ciabatta + Agua Mineral" : "Sándwich en Ciabatta Artesanal"} 
                className="w-full h-48 sm:h-64 md:h-72 object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-4">
                <div className="text-white">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                    Elaboración Fresca del Día
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-100 mt-1">
                    {isWaterIncluded 
                      ? "Pan Ciabatta artesanal crocante, fiambre premium, vegetales frescos y agua mineral 500ml"
                      : "Pan Ciabatta artesanal crocante de manteca, fiambre premium y vegetales frescos del día"}
                  </p>
                </div>
              </div>
            </div>

            {/* 2x2 GRID PRODUCT CATALOG */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-black uppercase tracking-wider text-xs sm:text-sm text-slate-800">
                  Menú Disponible
                </h2>
                <span className="text-xs text-slate-500 font-semibold">
                  {totalItems > 0 ? `${totalItems} seleccionado(s)` : 'Elegí tus ítems'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {renderProductCard('tradicional', store.combo_trad_enabled, formatProductTitle(store.combo_trad_name, isCircus ? "Sándwich Tradicional" : "Combo Tradicional"), store.combo_trad_desc, store.combo_trad_price || 0)}
                {renderProductCard('vegetariano', store.combo_veg_enabled, formatProductTitle(store.combo_veg_name, isCircus ? "Sándwich Vegetariano" : "Combo Vegetariano"), store.combo_veg_desc, store.combo_veg_price || 0)}
                {renderProductCard('sintacc', store.combo_sintacc_enabled, formatProductTitle(store.combo_sintacc_name, isCircus ? "Sándwich Sin TACC" : "Combo Sin TACC"), store.combo_sintacc_desc, store.combo_sintacc_price || 0)}
                {renderProductCard('vegano', store.combo_vegan_enabled, formatProductTitle(store.combo_vegan_name, isCircus ? "Sándwich Vegano" : "Combo Vegano"), store.combo_vegan_desc, store.combo_vegan_price || 0)}
              </div>
            </section>

            {/* MOBILE ONLY: PASSENGER FORM IN LEFT COLUMN */}
            <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm lg:hidden space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="font-black uppercase tracking-wider text-xs text-slate-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" /> Datos para la Entrega
                </h2>
                {isValid ? (
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completo
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Campos obligatorios *
                  </span>
                )}
              </div>
              {renderFormData()}
            </section>

          </div>

          {/* RIGHT COLUMN: DESKTOP STICKY CHECKOUT PANEL (5 COLUMNS ON DESKTOP) */}
          <div className="hidden lg:block lg:col-span-5 space-y-6 sticky top-24">
            
            {/* CHECKOUT CARD */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-black uppercase tracking-wider text-sm text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" /> Datos de Entrega y Pago
                </h2>
                {isValid && (
                  <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Listo
                  </span>
                )}
              </div>

              {/* FORM FIELDS */}
              {renderFormData()}

              {/* ORDER SUMMARY */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Resumen del Pedido</span>
                  <span>{totalItems} ítems</span>
                </div>

                {combos.tradicional > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{combos.tradicional}x {formatProductTitle(store.combo_trad_name, isCircus ? "Sándwich Tradicional" : "Combo Tradicional")}</span>
                    <span>{formatPrice(combos.tradicional * (store.combo_trad_price || 0))}</span>
                  </div>
                )}

                {combos.vegetariano > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{combos.vegetariano}x {formatProductTitle(store.combo_veg_name, isCircus ? "Sándwich Vegetariano" : "Combo Vegetariano")}</span>
                    <span>{formatPrice(combos.vegetariano * (store.combo_veg_price || 0))}</span>
                  </div>
                )}

                {combos.sintacc > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{combos.sintacc}x {formatProductTitle(store.combo_sintacc_name, isCircus ? "Sándwich Sin TACC" : "Combo Sin TACC")}</span>
                    <span>{formatPrice(combos.sintacc * (store.combo_sintacc_price || 0))}</span>
                  </div>
                )}

                {combos.vegano > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{combos.vegano}x {formatProductTitle(store.combo_vegan_name, isCircus ? "Sándwich Vegano" : "Combo Vegano")}</span>
                    <span>{formatPrice(combos.vegano * (store.combo_vegan_price || 0))}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black uppercase text-slate-900">Total a Pagar</span>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">{formatPrice(total)}</span>
                </div>
              </div>

              {/* DESKTOP PAY BUTTON */}
              <button
                type="button"
                onClick={handlePay}
                disabled={!isValid || isLoading}
                className={`w-full py-4 px-6 rounded-2xl font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${isValid ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Conectando con Mercado Pago...
                  </>
                ) : !isTotalSelected ? (
                  isCircus ? "Elegí al menos 1 sándwich" : "Elegí al menos 1 combo"
                ) : !isFormFilled ? (
                  "Completá tus datos arriba *"
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pagar con Mercado Pago
                    <ArrowRight className="w-5 h-5 ml-1" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Pago 100% Seguro procesado por Mercado Pago
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* MOBILE STICKY BOTTOM CHECKOUT BAR (PEDIDOSYA STYLE ON MOBILE) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 p-4 shadow-2xl lg:hidden">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total ({totalItems} items)
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(total)}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePay}
            disabled={!isValid || isLoading}
            className={`flex-1 py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${isValid ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </>
            ) : !isTotalSelected ? (
              isCircus ? "Elegí 1 sándwich" : "Elegí 1 combo"
            ) : !isFormFilled ? (
              "Completá tus datos *"
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pagar MP
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* INFO MODAL FOR PRODUCT DETAILS */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl">
            <h3 className="font-black text-slate-900 uppercase italic text-sm">
              {isCircus ? "Detalle del Sándwich" : "Detalle del Menú"}
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">{showInfoModal}</p>
            <button
              onClick={() => setShowInfoModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
