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
  console.log("--- REPAIRING TRADITIONAL MEAL QUANTITIES ---");

  // 1. Fetch all event sales units
  const { data: units, error } = await supabase
    .from('event_sales_units')
    .select('*');

  if (error) {
    console.error("Error fetching event sales units:", error);
    return;
  }

  console.log(`Fetched ${units.length} sales units. Checking validation...`);

  let repairedCount = 0;

  for (const u of units) {
    const sold = Number(u.sold_qty || 0);
    const liberated = Number(u.liberated_qty || 0);
    const totalProduction = sold + liberated;

    const trad = Number(u.traditional || 0);
    const veg = Number(u.vegetarian || 0);
    const vegan = Number(u.vegana || 0);
    const sintacc = Number(u.sin_tacc || 0);
    const totalBreakdown = trad + veg + vegan + sintacc;

    if (totalBreakdown !== totalProduction) {
      // It is invalid! Let's calculate the correct traditional count
      const correctTrad = totalProduction - (veg + vegan + sintacc);
      if (correctTrad >= 0) {
        console.log(`Repairing Unit ID ${u.id} (${u.unit_name}):`);
        console.log(`  Current -> Trad: ${trad} | Veg: ${veg} | Vegana: ${vegan} | SinTacc: ${sintacc} (Sum: ${totalBreakdown})`);
        console.log(`  Target  -> Sold: ${sold} | Lib: ${liberated} (Total: ${totalProduction})`);
        console.log(`  Setting Trad to: ${correctTrad}`);

        const { error: updErr } = await supabase
          .from('event_sales_units')
          .update({ traditional: correctTrad })
          .eq('id', u.id);

        if (updErr) {
          console.error(`  Failed to update unit ${u.id}:`, updErr.message);
        } else {
          repairedCount++;
        }
      } else {
        console.warn(`  Warning: calculated negative traditional count for unit ${u.id}: ${correctTrad}`);
      }
    }
  }

  console.log(`Success! Repaired ${repairedCount} sales units.`);
}

run().catch(console.error);
