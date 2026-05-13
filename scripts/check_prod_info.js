const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const prodId = '12ccff92-1a22-465a-a8fe-a4e449454902'
  const res = await fetch(`${url}/rest/v1/productos?id=eq.${prodId}&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const json = await res.json()
  console.log("PRODUCT INFO:", json)
}
run()
