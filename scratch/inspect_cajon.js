const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, gramos_por_unidad, factor_merma')
    .ilike('nombre', '%Beef%');
  
  const { data: data2 } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, gramos_por_unidad, factor_merma')
    .ilike('nombre', '%Pechuga%');

  console.log("Beef products:", data);
  console.log("Chicken products:", data2);
}

run();
