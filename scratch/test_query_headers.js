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
  console.log("Testing join query with events_master!event_master_id...");
  
  const { data, error } = await supabase
    .from('event_sales_headers')
    .select('id, event_master_id, coordinator_name, total_amount, pax_projected, event_date, events_master!event_master_id(show_name, event_date)')
    .eq('company_name', 'RV Traslados')
    .order('event_date', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Query succeeded! Retrieved records:", data.length);
    console.log("Sample records:", data);
  }
}

run().catch(console.error);
