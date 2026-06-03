const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching details for Water and Napkins...");
  const { data: water } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, gramos_por_unidad, factor_merma')
    .eq('id', '2e452d5b-9d90-47a7-ae2e-134cc55ef7bd')
    .single();

  const { data: napkins } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, gramos_por_unidad, factor_merma')
    .ilike('nombre', '%Servilleta%');

  console.log("Water product:", water);
  console.log("Napkins products:", napkins);
}

run();
