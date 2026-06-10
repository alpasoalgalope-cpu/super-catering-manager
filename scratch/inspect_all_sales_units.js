const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: units, error } = await supabase
    .from('event_sales_units')
    .select('traditional, vegetarian, vegana, sin_tacc, water_qty, sold_qty, liberated_qty')
    .limit(100);

  if (error) {
    console.error("Error fetching units:", error);
    return;
  }

  console.log(`Inspecting ${units.length} records:`);
  let sumTrad = 0, sumVeg = 0, sumVegana = 0, sumTacc = 0, sumWater = 0, sumSold = 0;
  
  units.forEach((u, i) => {
    sumTrad += u.traditional || 0;
    sumVeg += u.vegetarian || 0;
    sumVegana += u.vegana || 0;
    sumTacc += u.sin_tacc || 0;
    sumWater += u.water_qty || 0;
    sumSold += u.sold_qty || 0;
    if (i < 15) {
      console.log(`Record ${i+1}: Trad: ${u.traditional} | Veg: ${u.vegetarian} | Vegana: ${u.vegana} | SinTacc: ${u.sin_tacc} | Water: ${u.water_qty} | Sold: ${u.sold_qty}`);
    }
  });

  console.log("\n--- SUMS ---");
  console.log(`Traditional: ${sumTrad}`);
  console.log(`Vegetarian: ${sumVeg}`);
  console.log(`Vegana: ${sumVegana}`);
  console.log(`Sin TACC: ${sumTacc}`);
  console.log(`Water Qty: ${sumWater}`);
  console.log(`Sold Qty: ${sumSold}`);
}

run().catch(console.error);
