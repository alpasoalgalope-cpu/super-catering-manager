const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuses() {
  console.log("--- LOGISTICS BUS ASSIGNMENTS DIAGNOSTIC ---");
  
  // 1. Fetch count and sample of event_bus_assignments
  const { data: buses, error: bErr } = await supabase
    .from('event_bus_assignments')
    .select('*, events_master(event_date, show_name), clients(name), coordinators(name)')
    .limit(20);

  if (bErr) {
    console.error("Error fetching event_bus_assignments:", bErr);
    return;
  }

  console.log(`Total assignments found: ${buses.length}`);
  buses.forEach(b => {
    console.log(`Event: ${b.events_master?.show_name} (${b.events_master?.event_date}) - Client: ${b.clients?.name} - Coordinator: ${b.coordinators?.name} - Unit: ${b.unit_name}`);
  });
}

checkBuses();
