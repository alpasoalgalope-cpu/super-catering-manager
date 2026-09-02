import { supabase } from '@/lib/supabase'
import CoordinatorPortal from '@/components/tienda/CoordinatorPortal'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function resolveStoreBySlug(slug: string) {
  const { data: existing } = await supabase
    .from('online_store_events')
    .select('*, events_master(id, event_date, show_name, status, venues(name, address, meeting_point))')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return existing

  const dateMatch = slug.match(/\d{4}-\d{2}-\d{2}$/)
  if (!dateMatch) return null
  const eventDate = dateMatch[0]

  const { data: events } = await supabase
    .from('events_master')
    .select('id, show_name, event_date, venues(name, address, meeting_point), event_projections(company_name)')
    .eq('event_date', eventDate)

  if (!events || events.length === 0) return null

  for (const ev of events) {
    const matchedComp = (ev.event_projections || []).find((p: any) => {
      const cSlug = slugify(p.company_name)
      return slug.includes(cSlug)
    })
    
    const compName = matchedComp?.company_name || 'Pasajeros'
    const venueName = (ev.venues as any)?.name || ''

    const storeData = {
      event_master_id: ev.id,
      slug: slug,
      title: `${ev.show_name} — ${compName}`,
      subtitle: venueName ? `Venue: ${venueName}` : 'Cena de Regreso',
      description: `Viandas oficiales para el regreso del show ${ev.show_name}.`,
      is_active: true,
      available_dates: [eventDate],
      combo_trad_enabled: true,
      combo_trad_price: 10000,
      combo_trad_name: 'Combo Tradicional + Agua sin Gas',
      combo_trad_desc: 'Sándwich Gigante de Jamón y Queso en pan Ciabatta de manteca fresco del día + Agua Mineral.',
      combo_veg_enabled: true,
      combo_veg_price: 10000,
      combo_veg_name: 'Combo Vegetariano + Agua sin Gas',
      combo_veg_desc: 'Sándwich en Ciabatta de Manteca de Queso, Huevo, Lechuga y Tomate + Agua Mineral.',
      combo_sintacc_enabled: true,
      combo_sintacc_price: 13000,
      combo_sintacc_name: 'Combo Sin TACC + Agua sin Gas',
      combo_sintacc_desc: 'Árabe de Jamón y Queso envasado al vacío (Apto Celíacos) + Agua Mineral.',
      combo_vegan_enabled: true,
      combo_vegan_price: 10000,
      combo_vegan_name: 'Combo Vegano + Agua sin Gas',
      combo_vegan_desc: 'Sándwich Vegano en Ciabatta con vegetales asados + Agua Mineral.'
    }

    const { data: created } = await supabase
      .from('online_store_events')
      .insert([storeData])
      .select('*, events_master(id, event_date, show_name, status, venues(name, address, meeting_point))')
      .single()

    if (created) return created
  }

  return null
}

interface Props {
  params: {
    slug: string
  }
}

export default async function CoordinatorStorePage({ params }: Props) {
  const store = await resolveStoreBySlug(params.slug)

  if (!store) {
    notFound()
  }

  // Extract company name
  const title = store.title || ''
  const parts = title.split('—').map((x: string) => x.trim())
  const companyName = parts.length > 1 ? parts[1] : title.split('-').pop()?.trim() || ''

  // Fetch all paid orders for this store
  const { data: orders } = await supabase
    .from('online_orders')
    .select('*, online_customers(*)')
    .eq('store_event_id', store.id)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })

  // Fetch coordinator assigned in Gestión de Eventos
  let defaultCoordName = ''
  let defaultCoordPhone = ''

  if (store.event_master_id) {
    const { data: assignments } = await supabase
      .from('event_bus_assignments')
      .select(`
        coordinators (
          name,
          phone,
          company
        )
      `)
      .eq('event_id', store.event_master_id)

    if (assignments && assignments.length > 0) {
      const targetComp = (companyName || '').toLowerCase().trim()
      const matchingAssign: any = assignments.find((a: any) => {
        const cObj: any = Array.isArray(a.coordinators) ? a.coordinators[0] : a.coordinators
        const cComp = (cObj?.company || '').toLowerCase().trim()
        return cComp && targetComp && (cComp === targetComp || cComp.includes(targetComp) || targetComp.includes(cComp))
      })

      if (matchingAssign) {
        const coordObj: any = Array.isArray(matchingAssign.coordinators) ? matchingAssign.coordinators[0] : matchingAssign.coordinators
        if (coordObj) {
          defaultCoordName = coordObj.name || ''
          defaultCoordPhone = coordObj.phone || ''
        }
      }
    }
  }

  // Fetch existing bus logistics record
  let busLogistic: any = null
  if (store.event_master_id) {
    const { data: existingBus } = await supabase
      .from('bus_logistics')
      .select('*')
      .eq('event_master_id', store.event_master_id)
      .ilike('company_name', `%${companyName}%`)
      .maybeSingle()

    if (existingBus) {
      busLogistic = existingBus
    }
  }

  return (
    <CoordinatorPortal
      store={store}
      companyName={companyName}
      orders={orders || []}
      initialBus={busLogistic}
      defaultCoordName={defaultCoordName}
      defaultCoordPhone={defaultCoordPhone}
    />
  )
}
