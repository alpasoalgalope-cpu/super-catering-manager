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
  const { data: events } = await supabase
    .from('events_master')
    .select('*, event_projections(id, company_name, projected_pax)')
    .order('event_date', { ascending: false });

  console.log("All Events and Projections:");
  events.forEach(ev => {
    console.log(`- ID: ${ev.id} | Show: ${ev.show_name} | Date: ${ev.event_date}`);
    ev.event_projections.forEach(p => {
      console.log(`   * Projection: "${p.company_name}" | Pax: ${p.projected_pax}`);
    });
  });
}

run().catch(console.error);
