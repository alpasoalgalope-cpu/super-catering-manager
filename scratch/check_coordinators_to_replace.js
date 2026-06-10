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
  console.log("--- CHECKING COORDINATORS TO REPLACE ---");

  const names = ['Martu', 'Martina', 'Lauti', 'Lautaro', 'Flor', 'Flor Ribecco'];
  const { data: coords, error } = await supabase
    .from('coordinators')
    .select('*')
    .in('name', names);

  if (error) {
    console.error("Error fetching coordinators:", error);
    return;
  }

  console.log("Coordinators found:", coords);

  const tables = ['event_sales_units', 'event_bus_assignments'];
  for (const c of coords) {
    console.log(`\nReferences for "${c.name}" (ID: ${c.id}):`);
    for (const t of tables) {
      const { count, error: countErr } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true })
        .eq('coordinator_id', c.id);
      console.log(`  Table "${t}": ${count} records`);
    }
  }
}

run().catch(console.error);
