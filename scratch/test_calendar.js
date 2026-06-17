const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all vencimientos_servicios...");
  const { data: servs, error: servErr } = await supabase.from('vencimientos_servicios').select('*, servicios(nombre)');
  if (servErr) {
    console.error("vencimientos_servicios error:", servErr);
  } else {
    console.log(`vencimientos_servicios count: ${servs.length}`);
    console.log("First 3:", servs.slice(0, 3));
  }

  console.log("Fetching all vencimientos_impuestos...");
  const { data: taxes, error: taxErr } = await supabase.from('vencimientos_impuestos').select('*, impuestos(nombre)');
  if (taxErr) {
    console.error("vencimientos_impuestos error:", taxErr);
  } else {
    console.log(`vencimientos_impuestos count: ${taxes.length}`);
    console.log("First 3:", taxes.slice(0, 3));
  }
}

run();
