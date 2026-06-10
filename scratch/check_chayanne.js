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

async function checkChayanne() {
  console.log("--- CHAYANNE 04/03/2026 DIAGNOSTIC ---");
  
  // Find event id for Chayanne on 04/03/2026
  const { data: events, error: eErr } = await supabase
    .from('events_master')
    .select('id, show_name, event_date')
    .eq('event_date', '2026-03-04');

  if (eErr) {
    console.error("Error fetching events:", eErr);
    return;
  }
  console.log("Events on 2026-03-04:", events);

  for (const ev of events) {
    // Fetch projections
    const { data: projections, error: pErr } = await supabase
      .from('event_projections')
      .select('company_name, projected_pax')
      .eq('event_id', ev.id);
    console.log(`Projections for ${ev.show_name}:`, projections);

    // Fetch sales headers
    const { data: headers, error: hErr } = await supabase
      .from('event_sales_headers')
      .select('id, company, company_name, total_amount')
      .eq('event_master_id', ev.id);
    console.log(`Sales headers for ${ev.show_name}:`, headers);

    // Fetch bus assignments
    const { data: buses, error: bErr } = await supabase
      .from('event_bus_assignments')
      .select('id, client_id, vehicle_id, coordinator_id, unit_name')
      .eq('event_id', ev.id);
    console.log(`Bus assignments for ${ev.show_name}:`, buses);
  }
}

checkChayanne();
