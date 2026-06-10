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
  console.log("--- SEARCHING FOR FLOR REFERENCES ---");

  // 1. Search in coordinators table by name
  const { data: coords, error: cErr } = await supabase
    .from('coordinators')
    .select('*')
    .ilike('name', '%Flor%');
  console.log("Coordinators containing 'Flor':", coords || cErr);

  // 2. Search in event_sales_headers table by coordinator_name
  const { data: headers, error: hErr } = await supabase
    .from('event_sales_headers')
    .select('id, coordinator_name, company_name, event_date')
    .ilike('coordinator_name', '%Flor%');
  console.log("Sales headers coordinator_name containing 'Flor':", headers || hErr);
}

run().catch(console.error);
