const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  // Fetch units from the last few days
  const res = await fetch(`${url}/rest/v1/event_sales_units?select=liberated_qty,header_id,event_sales_headers(event_date,company_name)&created_at=gt.2026-04-25`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const units = await res.json()
  let totalLiberados = 0
  units.forEach(u => {
    totalLiberados += (Number(u.liberated_qty) || 0)
    console.log(`Event: ${u.event_sales_headers?.event_date} - ${u.event_sales_headers?.company_name} -> Liberados: ${u.liberated_qty}`)
  })
  console.log("TOTAL LIBERADOS RECIENTES:", totalLiberados)
}
run()
