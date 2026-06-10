const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("SUPABASE_URL:", supabaseUrl);
console.log("Using Service Role Key:", !!(env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("\n--- Diagnosing profiles RLS ---");
  
  // Try querying profiles
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Successfully fetched profiles (count):", data.length);
    if (data.length > 0) {
      console.log("Sample profile:", data[0]);
    }
  }

  // Check if we can run query to get pg_policies (only works if we have service_role or a custom RPC)
  const { data: policies, error: polError } = await supabase
    .rpc('exec_sql', { sql_query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles'" });

  if (polError) {
    console.error("Could not run exec_sql RPC (standard if disabled or using anon key):", polError.message);
  } else {
    console.log("Policies on profiles via RPC:");
    console.log(JSON.stringify(policies, null, 2));
  }
}

diagnose();
