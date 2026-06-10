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

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClients() {
  console.log("--- DATABASE CLIENTS DIAGNOSTIC ---");
  
  // 1. Fetch all clients
  const { data: clients, error: cErr } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');
  if (cErr) {
    console.error("Error fetching clients:", cErr);
    return;
  }
  console.log(`\nTotal clients in 'clients' table: ${clients.length}`);
  console.log("Clients:", clients.map(c => `"${c.name}" (ID: ${c.id})`).join(', '));

  // 2. Fetch projections from events where date is around April or Feb/March 2026
  const { data: projections, error: pErr } = await supabase
    .from('event_projections')
    .select('company_name, event_id, events_master(event_date, show_name)')
    .order('company_name');
  if (pErr) {
    console.error("Error fetching projections:", pErr);
  } else {
    console.log(`\nTotal projections: ${projections.length}`);
    const uniqueProjCompanies = [...new Set(projections.map(p => p.company_name))];
    console.log("Unique company names in projections:", uniqueProjCompanies.map(c => `"${c}"`));
    
    // Find projections that do NOT have a matching client in clients table (case-sensitive)
    const clientNames = clients.map(c => c.name);
    const unmatched = uniqueProjCompanies.filter(pc => !clientNames.includes(pc));
    console.log("\nUnmatched projection company names (not in 'clients' table):", unmatched.map(c => `"${c}"`));
  }

  // 3. Fetch sales headers
  const { data: headers, error: hErr } = await supabase
    .from('event_sales_headers')
    .select('company, company_name')
    .limit(100);
  if (hErr) {
    console.error("Error fetching sales headers:", hErr);
  } else {
    const uniqueHeaderCompanies = [...new Set(headers.map(h => h.company_name || h.company))];
    console.log(`\nUnique company names in sales headers:`, uniqueHeaderCompanies.map(c => `"${c}"`));
  }
}

checkClients();
