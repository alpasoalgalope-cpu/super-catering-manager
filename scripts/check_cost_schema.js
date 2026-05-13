const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf-8')
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/precios_historicos?limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  })
  const json = await res.json()
  console.log("HISTORICOS:", json.length > 0 ? Object.keys(json[0]) : "No data")

  const resP = await fetch(`${supabaseUrl}/rest/v1/productos?limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  })
  const jsonP = await resP.json()
  console.log("PRODUCTOS:", jsonP.length > 0 ? Object.keys(jsonP[0]) : "No data")
}

run()
