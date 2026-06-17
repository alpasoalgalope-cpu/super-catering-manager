const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking if table 'impuestos' exists...");
  const { data, error } = await supabase.from('impuestos').select('*').limit(1);
  if (error) {
    console.log("Table 'impuestos' error:", error.message);
  } else {
    console.log("Table 'impuestos' exists! Data:", data);
  }

  console.log("Checking if table 'vencimientos_impuestos' exists...");
  const { data: data2, error: error2 } = await supabase.from('vencimientos_impuestos').select('*').limit(1);
  if (error2) {
    console.log("Table 'vencimientos_impuestos' error:", error2.message);
  } else {
    console.log("Table 'vencimientos_impuestos' exists! Data:", data2);
  }
}

run();
