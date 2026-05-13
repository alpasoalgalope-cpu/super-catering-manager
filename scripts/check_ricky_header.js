const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const headerId = '18807577-789c-4120-a9ee-fb0d98e9dfde'
  
  const hRes = await fetch(`${url}/rest/v1/event_sales_headers?id=eq.${headerId}&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const header = await hRes.json()
  console.log("HEADER:", header)

  const rulesRes = await fetch(`${url}/rest/v1/commercial_rules?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const rules = await rulesRes.json()
  console.log("RULES COUNT:", rules.length)
  console.log("RULES SAMPLE:", rules.slice(0, 3))
}
run()
