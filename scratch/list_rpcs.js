const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking OpenAPI exposed functions...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { 'apikey': supabaseKey }
    });
    const spec = await res.json();
    console.log("Exposed paths:");
    const paths = Object.keys(spec.paths || {});
    const rpcPaths = paths.filter(p => p.startsWith('/rpc/'));
    console.log(rpcPaths);
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
