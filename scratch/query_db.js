const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== CHECKING SODA STEREO SALE ===");
  const { data: sales, error: sErr } = await supabase
    .from('event_sales_headers')
    .select('id, total_amount, monto_cobrado, estado_cobro, company_name, created_at, events_master!event_master_id(show_name, event_date)');

  if (sErr) {
    console.error(sErr);
  } else {
    sales.forEach(s => {
      if (s.events_master?.show_name?.includes("Soda Stereo")) {
        console.log(`- Sale ID: ${s.id} | Show: ${s.events_master?.show_name} | Date: ${s.events_master?.event_date} | Company: ${s.company_name} | Total: ${s.total_amount} | Cobrado: ${s.monto_cobrado} | Estado: ${s.estado_cobro}`);
      }
    });
  }

  console.log("\n=== CHECKING SODA STEREO CASH MOVEMENTS ===");
  const { data: movements, error: mErr } = await supabase
    .from('cash_movements')
    .select('*')
    .ilike('detalle', '%Soda Stereo%');

  if (mErr) {
    console.error(mErr);
  } else {
    movements.forEach(m => {
      console.log(`- ID: ${m.id} | Importe: ${m.importe} | Fecha: ${m.fecha} | Cuenta: ${m.cuenta_bancaria} | Sale Header ID: ${m.event_sales_header_id}`);
    });
  }
}

main();
