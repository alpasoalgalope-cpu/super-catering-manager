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
  console.log("Testing insert into event_bus_assignments...");
  
  // Let's get a random event, client and coordinator
  const { data: event } = await supabase.from('events_master').select('id').limit(1).single();
  const { data: client } = await supabase.from('clients').select('id').limit(1).single();
  const { data: coord } = await supabase.from('coordinators').select('id').limit(1).single();

  console.log("Using IDs:", {
    event_id: event?.id,
    client_id: client?.id,
    coordinator_id: coord?.id
  });

  if (!event || !client || !coord) {
    console.error("Missing dummy data to test insert!");
    return;
  }

  const { data, error } = await supabase
    .from('event_bus_assignments')
    .insert({
      event_id: event.id,
      client_id: client.id,
      coordinator_id: coord.id,
      unit_name: 'Test Micro 1',
      crew_count: 0
    })
    .select('*');

  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded:", data);
    // Delete it
    const { error: dErr } = await supabase
      .from('event_bus_assignments')
      .delete()
      .eq('id', data[0].id);
    console.log("Delete status:", dErr ? dErr : "deleted successfully");
  }
}

run().catch(console.error);
