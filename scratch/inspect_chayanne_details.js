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
  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: projections } = await supabase
    .from('event_projections')
    .select('company_name, projected_pax')
    .eq('event_id', 'efd4fe96-408a-461c-a678-ff92b77ac0d5'); // Chayanne ID

  console.log("--- CLIENTS CHAR CODES ---");
  clients.forEach(c => {
    console.log(`Name: "${c.name}" | Length: ${c.name.length} | Codes: ${[...c.name].map(ch => ch.charCodeAt(0)).join(',')}`);
  });

  console.log("--- PROJECTIONS CHAR CODES ---");
  projections.forEach(p => {
    console.log(`Name: "${p.company_name}" | Length: ${p.company_name.length} | Codes: ${[...p.company_name].map(ch => ch.charCodeAt(0)).join(',')}`);
  });
}

run().catch(console.error);
