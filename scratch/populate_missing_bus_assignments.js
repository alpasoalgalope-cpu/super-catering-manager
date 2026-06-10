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
  console.log("--- POPULATING MISSING BUS ASSIGNMENTS ---");

  // 1. Fetch all clients to map name -> id
  const { data: clients, error: clErr } = await supabase.from('clients').select('id, name');
  if (clErr) {
    console.error("Error fetching clients:", clErr);
    return;
  }
  const clientMap = {};
  clients.forEach(c => {
    clientMap[c.name.trim().toLowerCase()] = c.id;
  });

  // 2. Fetch all sales headers to map header_id -> (event_id, company_name)
  const { data: headers, error: hErr } = await supabase
    .from('event_sales_headers')
    .select('id, event_master_id, company_name');
  if (hErr) {
    console.error("Error fetching sales headers:", hErr);
    return;
  }
  const headerMap = {};
  headers.forEach(h => {
    headerMap[h.id] = {
      event_id: h.event_master_id,
      company_name: h.company_name
    };
  });

  // 3. Fetch all sales units
  const { data: units, error: uErr } = await supabase
    .from('event_sales_units')
    .select('id, header_id, coordinator_id');
  if (uErr) {
    console.error("Error fetching sales units:", uErr);
    return;
  }

  // 4. Fetch all existing bus assignments to avoid duplicates
  const { data: existingBuses, error: bErr } = await supabase
    .from('event_bus_assignments')
    .select('event_id, client_id, coordinator_id');
  if (bErr) {
    console.error("Error fetching existing bus assignments:", bErr);
    return;
  }
  
  const existingSet = new Set();
  existingBuses.forEach(b => {
    existingSet.add(`${b.event_id}_${b.client_id}_${b.coordinator_id}`);
  });

  console.log(`Found ${units.length} sales units total. Checking for missing bus assignments...`);
  
  let insertedCount = 0;

  for (const unit of units) {
    if (!unit.coordinator_id) continue;

    const header = headerMap[unit.header_id];
    if (!header) continue;

    const clientId = clientMap[header.company_name.trim().toLowerCase()];
    if (!clientId) {
      console.warn(`No client found for company "${header.company_name}"`);
      continue;
    }

    const key = `${header.event_id}_${clientId}_${unit.coordinator_id}`;
    if (!existingSet.has(key)) {
      console.log(`Adding missing assignment: Event ID ${header.event_id} | Client: ${header.company_name} | Coordinator: ${unit.coordinator_id}`);
      
      const { error: insErr } = await supabase
        .from('event_bus_assignments')
        .insert({
          event_id: header.event_id,
          client_id: clientId,
          coordinator_id: unit.coordinator_id,
          crew_count: 0
        });

      if (insErr) {
        console.error("Failed to insert assignment:", insErr);
      } else {
        existingSet.add(key);
        insertedCount++;
      }
    }
  }

  console.log(`Success! Inserted ${insertedCount} missing bus assignments.`);
}

run().catch(console.error);
