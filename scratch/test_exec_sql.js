const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const paramsList = [
    { sql_query: "SELECT 1" },
    { sql: "SELECT 1" },
    { query: "SELECT 1" },
    { sql_string: "SELECT 1" }
  ];

  for (const params of paramsList) {
    console.log(`Trying exec_sql with parameters:`, params);
    const { data, error } = await supabase.rpc('exec_sql', params);
    if (error) {
      console.log(`  -> Failed:`, error.message);
    } else {
      console.log(`  -> Success! Data:`, data);
      return;
    }
  }

  // Also try different function names like execute_sql, run_sql
  const alternativeFuncs = ['execute_sql', 'run_sql', 'sql', 'query'];
  for (const func of alternativeFuncs) {
    for (const params of paramsList) {
      console.log(`Trying ${func} with parameters:`, params);
      const { data, error } = await supabase.rpc(func, params);
      if (error) {
        console.log(`  -> Failed:`, error.message);
      } else {
        console.log(`  -> Success! Data:`, data);
        return;
      }
    }
  }
}

run();
