const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/cash_movements?select=*&order=fecha.asc`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const movements = await res.json();

  console.log("Total movements in DB:", movements.length);

  // Group by mes field
  const months = Array.from(new Set(movements.map(m => m.mes))).filter(Boolean);
  console.log("Available months in cash_movements:", months);

  // Filter for may movements
  const mayMovements = movements.filter(m => m.mes && m.mes.toLowerCase().includes('05'));
  console.log(`\n--- May Movements (Count: ${mayMovements.length}) ---`);

  // Let's print out all unique concepts for May and their sum
  const conceptSums = {};
  let totalIngresos = 0;
  let totalEgresos = 0;

  mayMovements.forEach(m => {
    const concept = m.concepto || "Sin Concepto";
    const amount = Number(m.importe) || 0;
    if (amount > 0) {
      totalIngresos += amount;
    } else {
      totalEgresos += amount;
    }

    if (!conceptSums[concept]) {
      conceptSums[concept] = { count: 0, positiveSum: 0, negativeSum: 0 };
    }
    conceptSums[concept].count++;
    if (amount > 0) {
      conceptSums[concept].positiveSum += amount;
    } else {
      conceptSums[concept].negativeSum += amount;
    }
  });

  console.log("\nSummary by Concept in Cash Flow (May):");
  Object.entries(conceptSums).forEach(([concept, stats]) => {
    console.log(`- ${concept}:`);
    console.log(`  Count: ${stats.count}`);
    console.log(`  Positive Sum: $${stats.positiveSum.toLocaleString()}`);
    console.log(`  Negative Sum: $${stats.negativeSum.toLocaleString()}`);
  });

  console.log(`\nCash Flow Totals (May):`);
  console.log(`Ingresos (Caja): $${totalIngresos.toLocaleString()}`);
  console.log(`Egresos (Caja): $${Math.abs(totalEgresos).toLocaleString()}`);
  console.log(`Saldo Neto: $${(totalIngresos + totalEgresos).toLocaleString()}`);

  // Let's emulate getFinancialReportsAction's logic for May
  // Wait, what dateLimit is set?
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const dateLimit = oneMonthAgo.toISOString().split('T')[0];
  console.log(`\n--- Emulating getFinancialReportsAction ---`);
  console.log(`Current Date Limit (1 month ago):`, dateLimit);

  // Check which May movements are >= dateLimit
  const eligibleMayMovements = mayMovements.filter(m => m.fecha >= dateLimit);
  console.log(`Eligible May Movements (>= ${dateLimit}): ${eligibleMayMovements.length} / ${mayMovements.length}`);

  let mpReal = 0;
  let estReal = 0;
  let ventReal = 0;
  let evReal = 0;

  eligibleMayMovements.forEach(m => {
    const concept = String(m.concepto).toLowerCase();
    const amount = Math.abs(Number(m.importe) || 0);
    if (concept === 'materia prima' && m.importe < 0) {
      mpReal += amount;
    } else if (concept === 'estructura' && m.importe < 0) {
      estReal += amount;
    } else if (concept === 'ventas' && m.importe > 0) {
      ventReal += amount;
    } else if (concept === 'egr. varios' && m.importe < 0) {
      evReal += amount;
    }
  });

  console.log(`\nFinancial Report May Real values (emulated):`);
  console.log(`Ventas Real: $${ventReal.toLocaleString()}`);
  console.log(`Materia Prima Real: $${mpReal.toLocaleString()}`);
  console.log(`Estructura Real: $${estReal.toLocaleString()}`);
  console.log(`Egr Varios Real: $${evReal.toLocaleString()}`);
  const totalExpensesReal = mpReal + estReal + evReal;
  console.log(`Total Expenses Real: $${totalExpensesReal.toLocaleString()}`);
  console.log(`Utilidad Real: $${(ventReal - totalExpensesReal).toLocaleString()}`);
}

run().catch(console.error);
