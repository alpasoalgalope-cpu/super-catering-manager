const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch all concepts
    const { data: concepts, error: conceptsErr } = await supabase
      .from('cash_concepts')
      .select('id, name');
    
    if (conceptsErr) throw conceptsErr;

    console.log(`Loaded ${concepts.length} concepts.`);

    // 2. Loop and update movements
    for (const concept of concepts) {
      const { data: updated, error: updateErr } = await supabase
        .from('cash_movements')
        .update({ concepto: concept.name })
        .eq('concept_id', concept.id)
        .not('concepto', 'eq', concept.name)
        .select('id');

      if (updateErr) {
        console.error(`Error updating movements for concept ${concept.name}:`, updateErr);
      } else {
        console.log(`Updated ${updated ? updated.length : 0} movements for concept ${concept.name}`);
      }
    }

    console.log("Finished successfully!");
  } catch (err) {
    console.error("Error running fix:", err);
  }
}

run();
