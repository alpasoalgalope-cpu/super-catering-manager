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
  const dates = ['2026-03-04', '2026-02-03'];
  for (const date of dates) {
    console.log(`\n=================== DATE: ${date} ===================`);
    const { data: events, error: eErr } = await supabase
      .from('events_master')
      .select('id, show_name, event_date')
      .eq('event_date', date);

    if (eErr) {
      console.error("Error fetching events:", eErr);
      continue;
    }

    if (!events || events.length === 0) {
      console.log("No events found for this date.");
      continue;
    }

    for (const ev of events) {
      console.log(`Event ID: ${ev.id} | Show: ${ev.show_name}`);

      // 1. Projections
      const { data: projs, error: pErr } = await supabase
        .from('event_projections')
        .select('*')
        .eq('event_id', ev.id);
      console.log(`- Projections (${projs ? projs.length : 0}):`, projs || pErr);

      // 2. Sales Headers
      const { data: headers, error: hErr } = await supabase
        .from('event_sales_headers')
        .select('*')
        .eq('event_master_id', ev.id);
      console.log(`- Sales Headers (${headers ? headers.length : 0}):`, headers || hErr);

      // 3. Sales Units
      if (headers && headers.length > 0) {
        const headerIds = headers.map(h => h.id);
        const { data: units, error: uErr } = await supabase
          .from('event_sales_units')
          .select('*, coordinators(name)')
          .in('header_id', headerIds);
        console.log(`- Sales Units (${units ? units.length : 0}):`);
        units?.forEach(u => {
          console.log(`   Header ID: ${u.header_id} | Unit: ${u.unit_name} | Coordinator: ${u.coordinators?.name} | Sold: ${u.sold_qty}`);
        });
      }

      // 4. Bus Assignments
      const { data: buses, error: bErr } = await supabase
        .from('event_bus_assignments')
        .select('*, coordinators(name), clients(name)')
        .eq('event_id', ev.id);
      console.log(`- Bus Assignments (${buses ? buses.length : 0}):`);
      buses?.forEach(b => {
        console.log(`   Client: ${b.clients?.name} | Unit: ${b.unit_name} | Coordinator: ${b.coordinators?.name} | Crew: ${b.crew_count}`);
      });
      if (bErr) console.error("   Error fetching bus assignments:", bErr);
    }
  }
}

run().catch(console.error);
