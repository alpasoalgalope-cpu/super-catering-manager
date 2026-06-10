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
  const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'event_bus_assignments' });
  
  if (error) {
    // If inspect_table_columns RPC does not exist, let's query via REST endpoint /rest/v1/
    console.log("RPC check failed, let's fetch table definition or run direct SQL if we have execution tool.");
    const { data: cols, error: cErr } = await supabase
      .from('event_bus_assignments')
      .select('*')
      .limit(1);
    if (cErr) {
      console.error("Direct fetch failed:", cErr);
    } else {
      console.log("Sample record or columns:", cols);
    }
  } else {
    console.log("Columns:", data);
  }
}

run().catch(console.error);
