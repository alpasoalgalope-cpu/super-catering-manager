/**
 * Migration Script: recitales_staging → events_master + event_projections
 * Run: node scratch/migrate_to_master_model.mjs
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

// Parse .env.local manually
const envContent = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('🚀 Starting migration to Master Event Model...\n')

  // 1. Fetch all staging records
  const { data: staging, error: stagErr } = await supabase
    .from('recitales_staging')
    .select('*')

  if (stagErr) { console.error('❌ Error fetching staging:', stagErr.message); return }
  console.log(`📦 Found ${staging.length} records in recitales_staging`)

  // 2. Extract unique venues
  const uniqueVenues = [...new Set(staging.map(r => r.venue).filter(Boolean).map(v => v.trim()))]
  console.log(`\n🏟️  Inserting ${uniqueVenues.length} unique venues...`)
  for (const name of uniqueVenues) {
    const { error } = await supabase.from('venues').upsert({ name }, { onConflict: 'name' })
    if (error) console.warn(`  ⚠️  Venue "${name}": ${error.message}`)
    else console.log(`  ✅ Venue: ${name}`)
  }

  // 3. Fetch all venues to build name → id map
  const { data: venues } = await supabase.from('venues').select('id, name')
  const venueMap = Object.fromEntries((venues || []).map(v => [v.name.trim(), v.id]))

  // 4. Build unique events (date + show + venue)
  const eventKeys = new Set()
  const uniqueEvents = []
  for (const r of staging) {
    if (!r.event_date || !r.show_name) continue
    const key = `${r.event_date}|${r.show_name}|${r.venue?.trim() || ''}`
    if (!eventKeys.has(key)) {
      eventKeys.add(key)
      uniqueEvents.push({
        event_date: r.event_date.split('T')[0],
        show_name: r.show_name,
        venue_id: venueMap[r.venue?.trim()] || null,
        status: r.status || 'pendiente',
        _staging_id: r.id,
        _company: r.company,
        _pax: r.pax_projected || 0
      })
    }
  }
  console.log(`\n🎵 Inserting ${uniqueEvents.length} unique events...`)

  // 5. Fetch existing events_master to avoid duplicates
  const { data: existingMaster } = await supabase.from('events_master').select('id, event_date, show_name, venue_id')
  const masterMap = {}
  for (const e of (existingMaster || [])) {
    const key = `${e.event_date}|${e.show_name}|${e.venue_id || ''}`
    masterMap[key] = e.id
  }

  // 6. Insert new events and build mapping from staging_id to master_id
  const stagingToMasterMap = {}
  for (const ev of uniqueEvents) {
    const masterKey = `${ev.event_date}|${ev.show_name}|${ev.venue_id || ''}`
    let masterId = masterMap[masterKey]

    if (!masterId) {
      const { data, error } = await supabase
        .from('events_master')
        .insert({ event_date: ev.event_date, show_name: ev.show_name, venue_id: ev.venue_id, status: ev.status })
        .select('id')
        .single()
      if (error) { console.warn(`  ⚠️  Event "${ev.show_name}": ${error.message}`); continue }
      masterId = data.id
      masterMap[masterKey] = masterId
      console.log(`  ✅ Event: ${ev.event_date} | ${ev.show_name}`)
    } else {
      console.log(`  ⏭️  Exists: ${ev.event_date} | ${ev.show_name}`)
    }
    stagingToMasterMap[ev._staging_id] = masterId
  }

  // Build full stagingId → masterId map for ALL records
  for (const r of staging) {
    if (!r.event_date || !r.show_name) continue
    const venueId = venueMap[r.venue?.trim()] || null
    const key = `${r.event_date.split('T')[0]}|${r.show_name}|${venueId || ''}`
    if (masterMap[key]) stagingToMasterMap[r.id] = masterMap[key]
  }

  // 7. Insert projections (one per staging_record = one per company per event)
  console.log('\n📊 Inserting event_projections...')
  for (const r of staging) {
    const masterId = stagingToMasterMap[r.id]
    if (!masterId || !r.company) continue
    const { error } = await supabase
      .from('event_projections')
      .upsert({ event_id: masterId, company_name: r.company, projected_pax: r.pax_projected || 0 }, { onConflict: 'event_id,company_name' })
    if (error) console.warn(`  ⚠️  Projection "${r.company}": ${error.message}`)
    else console.log(`  ✅ Projection: ${r.show_name} → ${r.company} (${r.pax_projected} PAX)`)
  }

  // 8. Update event_sales_headers to reference events_master
  console.log('\n🔗 Linking event_sales_headers to events_master...')
  const { data: headers } = await supabase.from('event_sales_headers').select('id, event_id, event_master_id').is('event_master_id', null)
  let linked = 0
  for (const h of (headers || [])) {
    const masterId = stagingToMasterMap[h.event_id]
    if (masterId) {
      await supabase.from('event_sales_headers').update({ event_master_id: masterId }).eq('id', h.id)
      linked++
    }
  }
  console.log(`  ✅ Linked ${linked} / ${(headers || []).length} headers`)

  console.log('\n🎉 Migration complete!')
}

run().catch(console.error)
