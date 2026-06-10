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
  // Chayanne event ID: efd4fe96-408a-461c-a678-ff92b77ac0d5
  const { data: headers } = await supabase
    .from('event_sales_headers')
    .select('id, company_name')
    .eq('event_master_id', 'efd4fe96-408a-461c-a678-ff92b77ac0d5');

  console.log("Chayanne Sales Headers:", headers);

  for (const h of headers) {
    const { data: units } = await supabase
      .from('event_sales_units')
      .select('*')
      .eq('header_id', h.id);

    console.log(`\nUnits for ${h.company_name} (Header ID: ${h.id}):`);
    units?.forEach(u => {
      console.log(`- Unit: ${u.unit_name} | Sold: ${u.sold_qty} | Trad: ${u.traditional} | Veg: ${u.vegetarian} | Vegana: ${u.vegana} | SinTacc: ${u.sin_tacc} | Water: ${u.water_qty}`);
    });
  }
}

run().catch(console.error);
