import { supabase } from '@/lib/supabase'
import PassengerStore from '@/components/tienda/PassengerStore'
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
    .select('*, events_master(id, event_date, show_name, status, venues(name))')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return existing

  // Try to resolve and create from slug pattern: show-company-YYYY-MM-DD
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
      .select('*, events_master(id, event_date, show_name, status, venues(name))')
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

export default async function TiendaPage({ params }: Props) {
  const store = await resolveStoreBySlug(params.slug)

  if (!store) {
    notFound()
  }

  // Check if store is manually paused by organizer
  if (store.is_active === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 font-black text-2xl">
            ⏸️
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase mb-3">
            Tienda Pausada
          </h1>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            La recepción de pedidos para <b className="text-white">{store.title}</b> se encuentra temporalmente pausada por el organizador.
          </p>
        </div>
      </div>
    )
  }

  // Check if sales deadline has passed
  if (store.sales_deadline) {
    const deadline = new Date(store.sales_deadline)
    const now = new Date()
    if (now > deadline) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 font-black text-2xl">
              ⏰
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase mb-4">
              Ventas Cerradas
            </h1>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Lo sentimos, el período de compras para este evento ha finalizado el <b className="text-white">{deadline.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} hs</b>.
            </p>
          </div>
        </div>
      )
    }
  }

  return (
    <PassengerStore store={store} />
  )
}
