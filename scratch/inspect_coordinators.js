const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/coordinators?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const coords = await res.json();
  console.log("Registered Coordinators:", coords.length);
  coords.forEach(c => {
    console.log(`- ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | Company: ${c.company}`);
  });
}

run().catch(console.error);
