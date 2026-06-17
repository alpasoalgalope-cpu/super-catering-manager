const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== MONTHS IN CASH MOVEMENTS ===");
  const { data: mvs, error: mvsErr } = await supabase
    .from('cash_movements')
    .select('id, mes, fecha, concepto, conc_caja, importe');

  if (mvsErr) {
    console.error("Error:", mvsErr);
    return;
  }

  const months = {};
  mvs.forEach(m => {
    months[m.mes] = (months[m.mes] || 0) + 1;
  });
  console.log("Months found in DB:", months);

  console.log("\n=== MOVEMENTS IN JUNE 2026 ===");
  const juneMvs = mvs.filter(m => m.fecha && m.fecha.startsWith('2026-06'));
  console.log(`Found ${juneMvs.length} movements in June 2026:`);
  juneMvs.forEach(m => {
    console.log(`- ID: ${m.id} | Fecha: ${m.fecha} | Mes: ${m.mes} | Concepto: ${m.concepto} | Conc Caja: ${m.conc_caja} | Importe: ${m.importe}`);
  });
}

main();
