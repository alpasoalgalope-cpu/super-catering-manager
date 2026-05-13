const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf-8')
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const resH = await fetch(`${supabaseUrl}/rest/v1/event_sales_headers?limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  })
  const jsonH = await resH.json()
  console.log("HEADERS:", jsonH.length > 0 ? Object.keys(jsonH[0]) : "No headers")

  const resU = await fetch(`${supabaseUrl}/rest/v1/event_sales_units?limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  })
  const jsonU = await resU.json()
  console.log("UNITS:", jsonU.length > 0 ? Object.keys(jsonU[0]) : "No units")
}

run()
