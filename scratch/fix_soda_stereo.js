const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const cashMovementId = '730c1801-f1ca-479f-96be-6f6b471a7b63';
  const saleHeaderId = 'e34908f0-428a-48c4-a905-86327e8cc2d9';

  console.log("1. Deleting cash movement...");
  const { error: delErr } = await supabase
    .from('cash_movements')
    .delete()
    .eq('id', cashMovementId);

  if (delErr) {
    console.error("Error deleting cash movement:", delErr);
  } else {
    console.log("Cash movement deleted successfully!");
  }

  console.log("2. Updating sale header to historical cobrado...");
  const { error: updErr } = await supabase
    .from('event_sales_headers')
    .update({
      monto_cobrado: 140000,
      estado_cobro: 'cobrado',
      fecha_cobro: '2026-06-08' // date before cutoff date
    })
    .eq('id', saleHeaderId);

  if (updErr) {
    console.error("Error updating sale header:", updErr);
  } else {
    console.log("Sale header updated successfully!");
  }
}

main();
