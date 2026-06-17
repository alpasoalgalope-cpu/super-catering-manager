const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  console.log("Checking OpenAPI exposed functions with proper headers...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { 
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const spec = await res.json();
    const paths = Object.keys(spec.paths || {});
    const rpcPaths = paths.filter(p => p.startsWith('/rpc/'));
    console.log("Found RPC paths:", rpcPaths);
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
