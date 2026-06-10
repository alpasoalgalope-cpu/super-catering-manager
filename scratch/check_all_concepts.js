const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/cash_movements?select=concepto,importe`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const movements = await res.json();

  const concepts = {};
  movements.forEach(m => {
    const concept = m.concepto || "Sin Concepto";
    const amount = Number(m.importe) || 0;
    if (!concepts[concept]) {
      concepts[concept] = { count: 0, posCount: 0, negCount: 0, sum: 0 };
    }
    concepts[concept].count++;
    if (amount > 0) concepts[concept].posCount++;
    else if (amount < 0) concepts[concept].negCount++;
    concepts[concept].sum += amount;
  });

  console.log("ALL CONCEPTS IN DB:");
  console.entries = Object.entries(concepts).forEach(([name, data]) => {
    console.log(`- ${name}: Total=${data.count}, Pos=${data.posCount}, Neg=${data.negCount}, Sum=${data.sum.toLocaleString()}`);
  });
}

run().catch(console.error);
