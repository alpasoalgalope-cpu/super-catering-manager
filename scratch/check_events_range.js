const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/events_master?select=event_date,status&order=event_date.asc`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const events = await res.json();
  console.log("Total events in events_master:", events.length);
  if (events.length > 0) {
    console.log("First event date:", events[0].event_date);
    console.log("Last event date:", events[events.length - 1].event_date);
    
    // Count status
    const statusCounts = {};
    events.forEach(e => {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });
    console.log("Event statuses:", statusCounts);
  }
}

run().catch(console.error);
