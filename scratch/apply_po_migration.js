const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Reading migration file...");
  const sql = fs.readFileSync('supabase/migrations/015_purchase_orders_accounting_fields.sql', 'utf8');
  console.log("Executing migration via exec_sql RPC...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error applying migration:', error);
  } else {
    console.log('Migration applied successfully. Success:', data);
  }
}

run();
