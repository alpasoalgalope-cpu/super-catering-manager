const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

const monthTranslations = {
  // English names
  'January': 'Enero',
  'February': 'Febrero',
  'March': 'Marzo',
  'April': 'Abril',
  'May': 'Mayo',
  'June': 'Junio',
  'July': 'Julio',
  'August': 'Agosto',
  'September': 'Septiembre',
  'October': 'Octubre',
  'November': 'Noviembre',
  'December': 'Diciembre',
  // Typos/variations
  'Marzi': 'Marzo',
  'Jun': 'Junio',
  'May': 'Mayo'
};

async function main() {
  console.log("=== FETCHING ALL CASH MOVEMENTS ===");
  const { data: movements, error } = await supabase
    .from('cash_movements')
    .select('id, mes, fecha');

  if (error) {
    console.error("Error fetching movements:", error);
    return;
  }

  console.log(`Fetched ${movements.length} cash movements.`);

  let updatedCount = 0;
  for (const m of movements) {
    if (!m.mes) continue;
    
    // Parse format: e.g. "06. June" or "03. Marzi"
    const match = m.mes.match(/^(\d{2})\.\s+(.+)$/);
    if (match) {
      const num = match[1];
      const name = match[2].trim();
      const translation = monthTranslations[name];
      
      if (translation) {
        const correctMes = `${num}. ${translation}`;
        console.log(`Updating movement ${m.id} (${m.fecha}): '${m.mes}' -> '${correctMes}'`);
        const { error: uErr } = await supabase
          .from('cash_movements')
          .update({ mes: correctMes })
          .eq('id', m.id);
        
        if (uErr) {
          console.error(`Error updating movement ${m.id}:`, uErr.message);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`=== DONE. Updated ${updatedCount} movements. ===`);
}

main();
