import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log("--- TEST: REGISTRO COMPRAS ---")
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const dateLimit = ninetyDaysAgo.toISOString();

  const { data, error } = await supabase
    .from('registro_compras')
    .select(`
      costo_unidad,
      fecha,
      productos ( name )
    `)
    .gte('fecha', dateLimit)
    .order('fecha', { ascending: true });

  if (error) {
    console.error("ERROR FETCHING:", error)
    return
  }

  console.log(`TOTAL REGISTROS ENCONTRADOS: ${data?.length || 0}`)
  if (data && data.length > 0) {
    console.log("PRIMER REGISTRO:", JSON.stringify(data[0], null, 2))
    console.log("ULTIMO REGISTRO:", JSON.stringify(data[data.length - 1], null, 2))
  } else {
    console.log("LA TABLA REGISTRO_COMPRAS ESTA VACIA O RLS ESTA BLOQUEANDO.")
  }
}

test()
