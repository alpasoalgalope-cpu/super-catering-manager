const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const res = await fetch(`${url}/rest/v1/event_sales_units?select=id,sold_qty,liberated_qty,traditional,vegetarian,vegana,sin_tacc&order=created_at.desc&limit=10`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const units = await res.json()
  console.log("RECENT UNITS DATA:")
  units.forEach(u => {
    const sumCat = (u.traditional||0)+(u.vegetarian||0)+(u.vegana||0)+(u.sin_tacc||0)
    const sumOp = (u.sold_qty||0)+(u.liberated_qty||0)
    console.log(`ID: ${u.id} -> Sold: ${u.sold_qty}, Lib: ${u.liberated_qty} (Total: ${sumOp}) | Categories Sum: ${sumCat}`)
  })
}
run()
