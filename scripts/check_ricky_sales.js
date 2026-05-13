const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const eventId = '7c6bc9f9-13c7-4bb1-a418-6554f5ee560c'
  
  const hRes = await fetch(`${url}/rest/v1/event_sales_headers?event_master_id=eq.${eventId}&select=id,total_amount`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const headers = await hRes.json()
  console.log("HEADERS:", headers)

  if (headers.length > 0) {
    const hIds = headers.map(h => h.id).join(',')
    const uRes = await fetch(`${url}/rest/v1/event_sales_units?header_id=in.(${hIds})&select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    const units = await uRes.json()
    console.log("UNITS SAMPLE:", units.slice(0, 5))
    console.log("UNITS COUNT:", units.length)
  }
}
run()
