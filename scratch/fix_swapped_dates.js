const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking cash movements with swapped dates...");
  const { data: allMovements, error: fetchErr } = await supabase
    .from('cash_movements')
    .select('*');

  if (fetchErr) {
    console.error("Error fetching:", fetchErr);
    return;
  }

  const movements = allMovements.filter(m => m.created_at && m.created_at.startsWith('2026-06-04'));
  console.log(`Found ${movements.length} movements created on 2026-06-04.`);
  let updatedCount = 0;

  for (const m of movements) {
    const parts = m.fecha.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];

      // If day is '05' (May was parsed as day 5) and month is one of the swapped ones (7, 8, 11, 12)
      if (day === '05' && ['07', '08', '11', '12'].includes(month)) {
        const correctFecha = `${year}-05-${month}`; // Swap back: Year-05-Month
        console.log(`Fixing movement ${m.id.slice(0,8)}: ${m.fecha} -> ${correctFecha} (Importe: ${m.importe}, Detalle: ${m.detalle})`);

        const { error: updErr } = await supabase
          .from('cash_movements')
          .update({ fecha: correctFecha })
          .eq('id', m.id);

        if (updErr) {
          console.error(`Error updating movement ${m.id}:`, updErr);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} movements successfully!`);
}

main();
