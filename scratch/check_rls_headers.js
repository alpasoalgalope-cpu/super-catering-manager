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
  console.log("--- CHECKING RLS POLICIES FOR EVENT_SALES_HEADERS ---");

  // Querypg_policies
  const { data: policies, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT * FROM pg_policies WHERE tablename = 'event_sales_headers'"
  });

  if (error) {
    // Fallback: execute raw query using a custom SQL runner if available,
    // or inspect by querying pg_policies via supabase.from / supabase.rpc
    console.error("RPC execute_sql failed:", error);
    
    // Let's try running direct fetch or write a query
    const { data: pols, error: pErr } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'event_sales_headers');
    
    console.log("Direct select from pg_policies:", pols || pErr);
  } else {
    console.log("Policies:", policies);
  }
}

run().catch(console.error);
