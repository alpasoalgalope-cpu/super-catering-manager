const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const dateLimit = "2026-01-01";

  // 1. Fetch all cash movements
  const resCM = await fetch(`${url}/rest/v1/cash_movements?select=fecha,mes,concepto,importe&fecha=gte.${dateLimit}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const movements = await resCM.json();

  // Group by mes (Cash Flow style)
  const cashFlowStats = {};
  movements.forEach(m => {
    if (!m.mes) return;
    if (!cashFlowStats[m.mes]) {
      cashFlowStats[m.mes] = { ingresos: 0, egresos: 0 };
    }
    if (m.importe > 0) {
      cashFlowStats[m.mes].ingresos += m.importe;
    } else {
      cashFlowStats[m.mes].egresos += Math.abs(m.importe);
    }
  });

  // Group by month using the new Financial Report logic
  const finReportStats = {};
  movements.forEach(m => {
    if (!m.mes) return;
    const match = m.mes.match(/^(\d{2})\./);
    if (match) {
      const monthNum = match[1];
      const year = m.fecha ? m.fecha.substring(0, 4) : "2026";
      const key = `${year}-${monthNum}`;

      if (!finReportStats[key]) {
        finReportStats[key] = { ventasReal: 0, totalGastosReal: 0, label: m.mes };
      }

      if (m.importe > 0) {
        finReportStats[key].ventasReal += m.importe;
      } else {
        const amount = Math.abs(Number(m.importe) || 0);
        finReportStats[key].totalGastosReal += amount;
      }
    }
  });

  console.log("\n================ COMPARISON TABLE ================");
  console.log(String("MONTH").padEnd(15) | 
              String("CF INGRESOS").padStart(15) | 
              String("FR VENTAS").padStart(15) | 
              String("CF EGRESOS").padStart(15) | 
              String("FR GASTOS").padStart(15));
  console.log("-".repeat(80));

  const sortedKeys = Object.keys(finReportStats).sort();
  sortedKeys.forEach(k => {
    const fr = finReportStats[k];
    const cf = cashFlowStats[fr.label] || { ingresos: 0, egresos: 0 };
    
    console.log(
      `${fr.label.padEnd(15)} | ` +
      `CF: $${cf.ingresos.toLocaleString().padStart(12)} | ` +
      `FR: $${fr.ventasReal.toLocaleString().padStart(12)} | ` +
      `CF: $${cf.egresos.toLocaleString().padStart(12)} | ` +
      `FR: $${fr.totalGastosReal.toLocaleString().padStart(12)}`
    );

    const ingresosMatch = cf.ingresos === fr.ventasReal;
    const egresosMatch = cf.egresos === fr.totalGastosReal;
    console.log(`  Match Ingresos: ${ingresosMatch ? '✅' : '❌'} | Match Egresos: ${egresosMatch ? '✅' : '❌'}`);
  });
}

run().catch(console.error);
