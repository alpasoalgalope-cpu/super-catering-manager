const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const res = await fetch(`${url}/rest/v1/commercial_rules?select=company_name,recipe_trad_id`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const rules = await res.json()
  const recipeIds = [...new Set(rules.map(r => r.recipe_trad_id))].filter(Boolean)
  
  for (const rid of recipeIds) {
    const iRes = await fetch(`${url}/rest/v1/receta_insumos?receta_id=eq.${rid}&select=producto_id,cantidad_necesaria,productos(nombre)`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    const insumos = await iRes.json()
    const hasBox = insumos.some(i => i.productos.nombre.toLowerCase().includes('caja media pizza'))
    console.log(`Recipe ${rid} -> Has Pizza Box: ${hasBox}`)
    if (!hasBox) {
       console.log("  Insumos:", insumos.map(i => i.productos.nombre))
    }
  }
}
run()
