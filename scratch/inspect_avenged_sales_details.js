const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: units, error } = await supabase
    .from('event_sales_units')
    .select('*')
    .eq('header_id', 'ab6d0296-da01-414a-abef-f09a5a53d381'); // Avenged Sevenfold / RV Traslados Header ID

  if (error) {
    console.error("Error fetching sales units:", error);
  } else {
    console.log("Sales units for Avenged Sevenfold (RV Traslados):", units);
  }
}

run().catch(console.error);
