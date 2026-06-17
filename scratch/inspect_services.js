const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== VENCIMIENTOS SERVICIOS PAGADOS ===");
  const { data: vencs, error: vErr } = await supabase
    .from('vencimientos_servicios')
    .select('id, monto, estado_pago, fecha_vencimiento, fecha_pago, cash_movement_id, servicios(nombre)')
    .eq('estado_pago', 'pagado');

  if (vErr) {
    console.error("Error fetching service bills:", vErr);
    return;
  }

  console.log(`Encontrados ${vencs.length} vencimientos pagados:`);
  for (const v of vencs) {
    console.log(`- ID: ${v.id} | Servicio: ${v.servicios?.nombre} | Monto: ${v.monto} | Vence: ${v.fecha_vencimiento} | Pagado: ${v.fecha_pago} | Movement ID: ${v.cash_movement_id}`);
    if (v.cash_movement_id) {
      const { data: mv, error: mvErr } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('id', v.cash_movement_id)
        .single();
      if (mvErr) {
        console.error(`  Error fetching associated movement:`, mvErr.message);
      } else {
        console.log(`  Movimiento asociado: ID: ${mv.id} | Importe: ${mv.importe} | Concepto: ${mv.concepto} | Rubro: ${mv.rubro} | Mes: ${mv.mes} | Fecha: ${mv.fecha} | Detalle: ${mv.detalle}`);
      }
    }
  }

  console.log("\n=== CASH MOVEMENTS RECENT SERVICES ===");
  const { data: mvs, error: mvsErr } = await supabase
    .from('cash_movements')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(10);

  if (mvsErr) {
    console.error("Error fetching cash movements:", mvsErr);
  } else {
    console.log("Últimos 10 movimientos de caja:");
    mvs.forEach(m => {
      console.log(`- ID: ${m.id} | Fecha: ${m.fecha} | Concepto: ${m.concepto} | Rubro: ${m.rubro} | Detalle: ${m.detalle} | Importe: ${m.importe}`);
    });
  }
}

main();
