const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const dateLimit = "2026-01-01";

  // 1. Fetch Events Master (similar to the action)
  const resEvents = await fetch(`${url}/rest/v1/events_master?select=id,event_date,status,logistics_cost,extras_cost,commissions_cost&status=ilike.*ejecutado*&event_date=gte.${dateLimit}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const events = await resEvents.json();
  const eventIds = events.map(e => e.id);

  // 2. Fetch Cash Movements
  const resCM = await fetch(`${url}/rest/v1/cash_movements?select=fecha,mes,concepto,conc_caja,importe&fecha=gte.${dateLimit}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const cmMovements = await resCM.json();

  const cashEstructuraByMonth = {};
  const cashLogisticaByMonth = {};
  const cashExtrasByMonth = {};
  const cashMateriaPrimaByMonth = {};
  const cashVentasByMonth = {};
  const cashEgrVariosByMonth = {};

  cmMovements.forEach(m => {
    if (!m.mes) return;
    const match = m.mes.match(/^(\d{2})\./);
    if (match) {
      const monthNum = match[1];
      const year = m.fecha ? m.fecha.substring(0, 4) : "2026";
      const key = `${year}-${monthNum}`;
      
      if (m.importe > 0) {
        cashVentasByMonth[key] = (cashVentasByMonth[key] || 0) + m.importe;
      } else {
        const amount = Math.abs(Number(m.importe) || 0);
        const concepto = String(m.concepto || "").toLowerCase();
        
        if (concepto === 'materia prima') {
          cashMateriaPrimaByMonth[key] = (cashMateriaPrimaByMonth[key] || 0) + amount;
        } else if (['estructura', 'servicios', 'impuestos', 'administracion'].includes(concepto)) {
          cashEstructuraByMonth[key] = (cashEstructuraByMonth[key] || 0) + amount;
          
          const concCaja = String(m.conc_caja || "").toLowerCase();
          if (concCaja.includes('log') || concCaja === 'logística') {
            cashLogisticaByMonth[key] = (cashLogisticaByMonth[key] || 0) + amount;
          } else if (concCaja.includes('ext') || concCaja === 'extras') {
            cashExtrasByMonth[key] = (cashExtrasByMonth[key] || 0) + amount;
          }
        } else {
          cashEgrVariosByMonth[key] = (cashEgrVariosByMonth[key] || 0) + amount;
        }
      }
    }
  });

  // Print results for May (2026-05)
  const mayKey = "2026-05";
  console.log("MAY 2026 REAL VALUES WITH NEW LOGIC:");
  console.log(`Ventas Real: $${(cashVentasByMonth[mayKey] || 0).toLocaleString()}`);
  console.log(`Materia Prima Real: $${(cashMateriaPrimaByMonth[mayKey] || 0).toLocaleString()}`);
  console.log(`Estructura Real: $${(cashEstructuraByMonth[mayKey] || 0).toLocaleString()}`);
  console.log(`Egr Varios Real: $${(cashEgrVariosByMonth[mayKey] || 0).toLocaleString()}`);
  
  const totalGastosReal = (cashMateriaPrimaByMonth[mayKey] || 0) + (cashEstructuraByMonth[mayKey] || 0) + (cashEgrVariosByMonth[mayKey] || 0);
  const utilidadReal = (cashVentasByMonth[mayKey] || 0) - totalGastosReal;
  console.log(`Total Egresos Real: $${totalGastosReal.toLocaleString()}`);
  console.log(`Utilidad Real: $${utilidadReal.toLocaleString()}`);
}

run().catch(console.error);
