const fs = require('fs');
const path = require('path');
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

async function run() {
  try {
    // 1. Fetch sales headers for June 2026
    const { data: sales, error: salesErr } = await supabase
      .from('event_sales_headers')
      .select('*, events_master:events_master!event_sales_headers_event_master_id_fkey(event_date, id)')
      .order('created_at', { ascending: false });

    if (salesErr) throw salesErr;

    console.log(`Loaded ${sales.length} sales headers.`);

    // 2. Filter for June 2026
    const juneSales = sales.filter(s => {
      const dateStr = s.fecha_cobro || s.events_master?.event_date || s.created_at?.split('T')[0];
      return dateStr && dateStr.startsWith('2026-06');
    });

    console.log(`Found ${juneSales.length} sales related to June 2026:`);

    for (const sale of juneSales) {
      // Check if there is a cash movement linked to this sale
      const { data: mv, error: mvErr } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('event_sales_header_id', sale.id);

      if (mvErr) throw mvErr;

      console.log(`- Sale ID: ${sale.id}
  Event Date: ${sale.events_master?.event_date}
  Total: ${sale.total_amount}
  Monto Cobrado: ${sale.monto_cobrado}
  Estado Cobro: ${sale.estado_cobro}
  Fecha Cobro: ${sale.fecha_cobro}
  Linked Cash Movements: ${mv ? mv.length : 0}`);
      
      if (mv && mv.length > 0) {
        mv.forEach(m => {
          console.log(`    * Movement ID: ${m.id}, Date: ${m.fecha}, Amount: ${m.importe}, Concept: ${m.concepto}, Account: ${m.cuenta_bancaria}`);
        });
      }
    }

  } catch (err) {
    console.error("Error running script:", err);
  }
}

run();
