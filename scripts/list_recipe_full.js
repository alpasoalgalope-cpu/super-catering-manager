const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1]

async function run() {
  const recipeId = 'd18eff57-23be-400b-a605-47c9bb442906'
  const res = await fetch(`${url}/rest/v1/receta_insumos?receta_id=eq.${recipeId}&select=producto_id,cantidad_necesaria,productos(nombre)`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  const json = await res.json()
  json.forEach(i => console.log(`${i.productos.nombre} (ID: ${i.producto_id}) -> Qty: ${i.cantidad_necesaria}`))
}
run()
