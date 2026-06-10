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

const standardClients = [
  "Glo Traslados",
  "ModoTickets",
  "Proxima Estacion",
  "RioSil MDQ",
  "Rock en las Venas",
  "RV Traslados",
  "Terco Tour",
  "ValBus"
];

async function fixCasings() {
  console.log("--- STANDARDIZING DATABASE CASINGS ---");

  // 1. Fetch all projections
  const { data: projections, error: pErr } = await supabase
    .from('event_projections')
    .select('id, company_name, event_id');
  
  if (pErr) {
    console.error("Error fetching projections:", pErr);
    return;
  }

  console.log(`Fetched ${projections.length} projections.`);
  for (const proj of projections) {
    const matchedStandard = standardClients.find(sc => sc.toLowerCase() === proj.company_name.toLowerCase());
    if (matchedStandard && matchedStandard !== proj.company_name) {
      console.log(`Fixing projection "${proj.company_name}" -> "${matchedStandard}"`);
      
      // Before updating, check if the standard casing projection already exists for this event to avoid unique constraint conflict
      const { data: duplicate } = await supabase
        .from('event_projections')
        .select('id')
        .eq('event_id', proj.event_id)
        .eq('company_name', matchedStandard)
        .maybeSingle();

      if (duplicate) {
        // If standard casing projection already exists, delete the duplicate casing projection
        console.log(`Duplicate found for standard casing. Deleting duplicate projection ID: ${proj.id}`);
        const { error: delErr } = await supabase
          .from('event_projections')
          .delete()
          .eq('id', proj.id);
        if (delErr) console.error("Error deleting duplicate projection:", delErr);
      } else {
        // Otherwise update the casing
        const { error: updErr } = await supabase
          .from('event_projections')
          .update({ company_name: matchedStandard })
          .eq('id', proj.id);
        if (updErr) console.error("Error updating projection:", updErr);
      }
    }
  }

  // 2. Fetch all sales headers
  const { data: headers, error: hErr } = await supabase
    .from('event_sales_headers')
    .select('id, company, company_name');

  if (hErr) {
    console.error("Error fetching sales headers:", hErr);
    return;
  }

  console.log(`Fetched ${headers.length} sales headers.`);
  for (const header of headers) {
    const currentName = header.company_name || header.company;
    const matchedStandard = standardClients.find(sc => sc.toLowerCase() === currentName.toLowerCase());
    if (matchedStandard && (matchedStandard !== header.company || matchedStandard !== header.company_name)) {
      console.log(`Fixing sales header "${currentName}" -> "${matchedStandard}"`);
      const { error: updErr } = await supabase
        .from('event_sales_headers')
        .update({
          company: matchedStandard,
          company_name: matchedStandard
        })
        .eq('id', header.id);
      if (updErr) console.error("Error updating sales header:", updErr);
    }
  }

  console.log("Casing cleanup completed!");
}

fixCasings();
