const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envFile.split(/\r?\n/).forEach(line => {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith("#")) return;
  const parts = cleanLine.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, '');
    envVars[key] = val;
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const query = `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'profiles';`;
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: query });
  if (error) {
    console.error("Error fetching policies:", error);
  } else {
    console.log("Policies on profiles:");
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
