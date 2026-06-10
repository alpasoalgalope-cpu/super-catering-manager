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
  const { data: clients } = await supabase.from('clients').select('name');
  const clientNames = new Set(clients.map(c => c.name));

  const { data: projections } = await supabase.from('event_projections').select('id, company_name, event_id, events_master(show_name, event_date)');

  console.log("Checking projections casing mismatches...");
  let count = 0;
  projections.forEach(p => {
    if (!clientNames.has(p.company_name)) {
      console.log(`Mismatch found: "${p.company_name}" on Event "${p.events_master?.show_name}" (${p.events_master?.event_date})`);
      count++;
    }
  });

  console.log(`Total mismatched projections: ${count}`);
}

run().catch(console.error);
