const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const ids = [
    'a2f4ce4b-f8f5-407d-b277-4689d2bbd9bf', // Jamon
    '5d19906f-ae9c-4ef8-8643-b25863d2b5e6', // Danbo
    '12ccff92-1a22-465a-a8fe-a4e449454902'  // Mayonesa
  ]
  const res = await fetch(`${url}/rest/v1/productos?id=in.(${ids.join(',')})&select=id,nombre,unidad_medida`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const json = await res.json()
  console.log("UNITS INFO:", json)
}
run()
