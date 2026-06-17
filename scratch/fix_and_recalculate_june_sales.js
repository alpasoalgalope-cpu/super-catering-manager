const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getSpanishMonthName(dateStr) {
  const parts = dateStr.split('-');
  const monthNum = parseInt(parts[1], 10);
  return `${parts[1]}. ${monthNames[monthNum - 1]}`;
}

async function run() {
  try {
    // 1. Fetch VENTAS concept and subconcept
    const { data: concept } = await supabase
      .from('cash_concepts')
      .select('id, name')
      .eq('name', 'VENTAS')
      .single();

    const { data: subconcept } = await supabase
      .from('cash_subconcepts')
      .select('id, name')
      .eq('concept_id', concept.id)
      .limit(1)
      .single();

    // 2. Delete the previously generated cash movements
    console.log("Deleting previously generated historical cash movements...");
    const { error: delErr } = await supabase
      .from('cash_movements')
      .delete()
      .eq('concepto', 'VENTAS')
      .like('detalle', '%(Histórico)%');

    if (delErr) {
      console.error("Error deleting old movements:", delErr);
    } else {
      console.log("Successfully deleted previously generated movements.");
    }

    // 3. Fetch all collected sales with events in June 2026
    const { data: sales, error: salesErr } = await supabase
      .from('event_sales_headers')
      .select('*, events_master:events_master!event_sales_headers_event_master_id_fkey(event_date, id, show_name)')
      .eq('estado_cobro', 'cobrado');

    if (salesErr) throw salesErr;

    // Filter ONLY for events whose event_date is in June 2026 (starts with '2026-06')
    const trueJuneSales = sales.filter(s => {
      const eventDate = s.events_master?.event_date;
      return eventDate && eventDate.startsWith('2026-06');
    });

    console.log(`Found ${trueJuneSales.length} collected sales where the actual event date is in June 2026.`);

    let createdCount = 0;

    for (const sale of trueJuneSales) {
      // Check if there is already a cash movement linked to this sale
      const { data: existingMvs, error: mvErr } = await supabase
        .from('cash_movements')
        .select('id')
        .eq('event_sales_header_id', sale.id);

      if (mvErr) throw mvErr;

      if (existingMvs && existingMvs.length > 0) {
        console.log(`June Event Sale ${sale.id} (${sale.events_master?.show_name}, $${sale.total_amount}) already has a cash movement. Skipping.`);
        continue;
      }

      // Use the actual event date or collection date (which must be in June)
      const movementDate = sale.events_master?.event_date || sale.fecha_cobro || '2026-06-09';
      const mesEspanol = getSpanishMonthName(movementDate);
      const eventName = sale.events_master?.show_name || sale.id.substring(0, 8);
      const detail = `Cobro Venta Show: ${eventName} (Histórico)`;
      
      const hashInput = `sale_pay_${sale.id}_${sale.total_amount}_${movementDate}_${Math.random()}`;
      const hashId = crypto.createHash('md5').update(hashInput).digest('hex');

      console.log(`Generating cash movement for true June Sale ${sale.id}:
  Date: ${movementDate} (${mesEspanol})
  Amount: $${sale.total_amount}
  Detail: ${detail}`);

      // Insert cash movement
      const { error: insertErr } = await supabase
        .from('cash_movements')
        .insert({
          fecha: movementDate,
          mes: mesEspanol,
          concepto: concept.name,
          concept_id: concept.id,
          subconcept_id: subconcept.id,
          conc_caja: subconcept.name,
          detalle: detail,
          importe: Number(sale.total_amount),
          event_sales_header_id: sale.id,
          cuenta_bancaria: 'mercado pago',
          hash_id: hashId
        });

      if (insertErr) {
        console.error(`Error inserting cash movement for sale ${sale.id}:`, insertErr);
      } else {
        createdCount++;
        console.log(`Successfully created movement for sale ${sale.id}!`);
      }
    }

    console.log(`Finished. Created ${createdCount} cash movements for true June sales.`);

  } catch (err) {
    console.error("Error running script:", err);
  }
}

run();
