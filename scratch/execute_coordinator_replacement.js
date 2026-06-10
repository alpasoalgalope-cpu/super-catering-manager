const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- REPLACING COORDINATORS IN DATABASE ---");

  // IDs of target coordinators in company "RV Traslados"
  const idMartina = '72961165-bc80-45ce-a958-37f8fe830a25';
  const idMartu = '2a73a2f8-bae4-4a7d-893a-bca203c2123f';

  const idLautaro = '3ed08506-5e06-4cae-84e8-30082453728d';
  const idLauti = '277eb5ca-9a73-4406-aec0-54a63ad631aa';

  const idFlorRibecco = 'b6968e26-0730-4e52-91f9-0aceac9ac6c3';

  // 1. Update Martu -> Martina in event_sales_units
  const { count: u1, error: e1 } = await supabase
    .from('event_sales_units')
    .update({ coordinator_id: idMartina })
    .eq('coordinator_id', idMartu);
  console.log(`Updated event_sales_units for Martu -> Martina: ${e1 ? e1.message : 'Success'}`);

  // 2. Update Lauti -> Lautaro in event_sales_units
  const { count: u2, error: e2 } = await supabase
    .from('event_sales_units')
    .update({ coordinator_id: idLautaro })
    .eq('coordinator_id', idLauti);
  console.log(`Updated event_sales_units for Lauti -> Lautaro: ${e2 ? e2.message : 'Success'}`);

  // 3. Update Lauti -> Lautaro in event_bus_assignments
  const { count: u3, error: e3 } = await supabase
    .from('event_bus_assignments')
    .update({ coordinator_id: idLautaro })
    .eq('coordinator_id', idLauti);
  console.log(`Updated event_bus_assignments for Lauti -> Lautaro: ${e3 ? e3.message : 'Success'}`);

  // 4. Resolve Flor -> Flor Ribecco in event_sales_headers & units
  // Find all headers where coordinator_name is 'Flor' and company_name is 'RV Traslados'
  const { data: headers, error: hErr } = await supabase
    .from('event_sales_headers')
    .select('id, event_master_id')
    .eq('company_name', 'RV Traslados')
    .eq('coordinator_name', 'Flor');

  if (hErr) {
    console.error("Error fetching 'Flor' headers:", hErr);
  } else if (headers && headers.length > 0) {
    console.log(`Found ${headers.length} headers with coordinator_name = 'Flor'. Processing...`);
    const headerIds = headers.map(h => h.id);
    const eventIds = headers.map(h => h.event_master_id);

    // Update coordinator_id in event_sales_units
    const { error: u4 } = await supabase
      .from('event_sales_units')
      .update({ coordinator_id: idFlorRibecco })
      .in('header_id', headerIds);
    console.log(`Updated event_sales_units for Flor -> Flor Ribecco: ${u4 ? u4.message : 'Success'}`);

    // Update coordinator_name in event_sales_headers
    const { error: u5 } = await supabase
      .from('event_sales_headers')
      .update({ coordinator_name: 'Flor Ribecco' })
      .eq('company_name', 'RV Traslados')
      .eq('coordinator_name', 'Flor');
    console.log(`Updated event_sales_headers for Flor -> Flor Ribecco: ${u5 ? u5.message : 'Success'}`);

    // Fetch client ID of 'RV Traslados'
    const { data: rvClient } = await supabase
      .from('clients')
      .select('id')
      .eq('name', 'RV Traslados')
      .single();

    if (rvClient) {
      // Ensure bus assignments exist for these events
      for (const evId of eventIds) {
        const { data: existing } = await supabase
          .from('event_bus_assignments')
          .select('id')
          .eq('event_id', evId)
          .eq('client_id', rvClient.id)
          .eq('coordinator_id', idFlorRibecco)
          .maybeSingle();

        if (!existing) {
          console.log(`Adding missing bus assignment for Flor Ribecco on Event ID: ${evId}`);
          await supabase
            .from('event_bus_assignments')
            .insert({
              event_id: evId,
              client_id: rvClient.id,
              coordinator_id: idFlorRibecco,
              crew_count: 0
            });
        }
      }
    }
  }

  // 5. Update coordinator_name in event_sales_headers for Martu -> Martina and Lauti -> Lautaro
  const { error: e4 } = await supabase
    .from('event_sales_headers')
    .update({ coordinator_name: 'Martina' })
    .eq('company_name', 'RV Traslados')
    .eq('coordinator_name', 'Martu');
  console.log(`Updated event_sales_headers Martu -> Martina: ${e4 ? e4.message : 'Success'}`);

  const { error: e5 } = await supabase
    .from('event_sales_headers')
    .update({ coordinator_name: 'Lautaro' })
    .eq('company_name', 'RV Traslados')
    .eq('coordinator_name', 'Lauti');
  console.log(`Updated event_sales_headers Lauti -> Lautaro: ${e5 ? e5.message : 'Success'}`);

  // 6. Delete old/duplicate coordinators from the coordinators table
  const { error: d1 } = await supabase
    .from('coordinators')
    .delete()
    .eq('name', 'Martu')
    .eq('company', 'RV Traslados');
  console.log(`Deleted coordinator record 'Martu': ${d1 ? d1.message : 'Success'}`);

  const { error: d2 } = await supabase
    .from('coordinators')
    .delete()
    .eq('name', 'Lauti')
    .eq('company', 'RV Traslados');
  console.log(`Deleted coordinator record 'Lauti': ${d2 ? d2.message : 'Success'}`);

  console.log("Replacement completed successfully.");
}

run().catch(console.error);
