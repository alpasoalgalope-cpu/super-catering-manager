const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/cash_movements?select=*&mes=eq.05.%20Mayo&order=fecha.asc`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const movements = await res.json();

  console.log("MAY VENTAS MOVEMENTS:");
  movements.filter(m => m.concepto === 'VENTAS').forEach(m => {
    console.log(`Fecha: ${m.fecha} | Concepto: ${m.concepto} | Importe: ${m.importe} | Mes: ${m.mes}`);
  });
}

run().catch(console.error);
