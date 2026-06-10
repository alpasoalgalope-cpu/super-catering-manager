const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/clients?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const clients = await res.json();
  console.log("Registered Clients:");
  clients.forEach(c => {
    console.log(`- ID: ${c.id} | Name: ${c.name}`);
  });
}

run().catch(console.error);
