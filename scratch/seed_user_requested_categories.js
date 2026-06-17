const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== PRE-SEEDING REQUESTED CATEGORIES ===");

  // 1. Get Impuestos concept ID
  const { data: taxConcept, error: tcErr } = await supabase
    .from('cash_concepts')
    .select('id')
    .eq('name', 'Impuestos')
    .single();

  if (tcErr) {
    console.error("Error getting Impuestos concept:", tcErr.message);
  } else if (taxConcept) {
    console.log(`Found 'Impuestos' concept ID: ${taxConcept.id}`);
    
    // Check if 'Bienes Personales' subconcept exists
    const { data: bpSub, error: bpErr } = await supabase
      .from('cash_subconcepts')
      .select('id')
      .eq('concept_id', taxConcept.id)
      .eq('name', 'Bienes Personales')
      .maybeSingle();

    if (bpErr) {
      console.error("Error checking Bienes Personales:", bpErr.message);
    } else if (!bpSub) {
      console.log("Inserting 'Bienes Personales' subconcept...");
      const { error: insErr } = await supabase
        .from('cash_subconcepts')
        .insert({ concept_id: taxConcept.id, name: 'Bienes Personales' });
      
      if (insErr) {
        console.error("Error inserting Bienes Personales:", insErr.message);
      } else {
        console.log("Successfully inserted 'Bienes Personales'!");
      }
    } else {
      console.log("'Bienes Personales' already exists.");
    }
  }

  // 2. Get Estructura concept ID
  const { data: estConcept, error: ecErr } = await supabase
    .from('cash_concepts')
    .select('id')
    .eq('name', 'Estructura')
    .single();

  if (ecErr) {
    console.error("Error getting Estructura concept:", ecErr.message);
  } else if (estConcept) {
    console.log(`Found 'Estructura' concept ID: ${estConcept.id}`);
    
    // Check if 'Gastos Personales' subconcept exists
    const { data: gpSub, error: gpErr } = await supabase
      .from('cash_subconcepts')
      .select('id')
      .eq('concept_id', estConcept.id)
      .eq('name', 'Gastos Personales')
      .maybeSingle();

    if (gpErr) {
      console.error("Error checking Gastos Personales:", gpErr.message);
    } else if (!gpSub) {
      console.log("Inserting 'Gastos Personales' subconcept...");
      const { error: insErr } = await supabase
        .from('cash_subconcepts')
        .insert({ concept_id: estConcept.id, name: 'Gastos Personales' });
      
      if (insErr) {
        console.error("Error inserting Gastos Personales:", insErr.message);
      } else {
        console.log("Successfully inserted 'Gastos Personales'!");
      }
    } else {
      console.log("'Gastos Personales' already exists.");
    }
  }

  console.log("=== DONE PRE-SEEDING ===");
}

main();
