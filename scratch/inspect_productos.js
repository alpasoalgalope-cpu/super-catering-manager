const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching sample products...");
  const { data, error } = await supabase.from('productos').select('id, nombre, factor_merma').limit(10);
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log('Sample products:');
    data.forEach(p => {
      console.log(`  - ${p.nombre}: factor_merma = ${p.factor_merma} (type: ${typeof p.factor_merma})`);
    });
  }
}

run();
