import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInsert() {
  const { data: suppliers } = await supabase.from('proveedores').select('id').limit(1)
  const { data: products } = await supabase.from('productos').select('id').limit(1)

  if (!suppliers || suppliers.length === 0 || !products || products.length === 0) {
    console.log('No suppliers or products found in db to test insert.')
    return
  }

  const supplierId = suppliers[0].id
  const productId = products[0].id

  console.log('Testing insert with Supplier:', supplierId, 'and Product:', productId)

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert([{
      fecha_esperada: new Date().toISOString().split('T')[0],
      costo_total: 150.50,
      estado: 'pendiente',
      proveedor_id: supplierId
    }])
    .select()

  console.log('Inserted PO:', po, 'Error:', poErr)

  if (po && po.length > 0) {
    const poId = po[0].id
    const { data: poi, error: poiErr } = await supabase
      .from('purchase_order_items')
      .insert([{
        purchase_order_id: poId,
        producto_id: productId,
        cantidad: 10
      }])
      .select()

    console.log('Inserted PO Item:', poi, 'Error:', poiErr)

    // Clean up
    await supabase.from('purchase_order_items').delete().eq('purchase_order_id', poId)
    await supabase.from('purchase_orders').delete().eq('id', poId)
    console.log('Cleaned up mock data successfully.')
  }
}

testInsert()
