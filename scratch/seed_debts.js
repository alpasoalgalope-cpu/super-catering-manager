const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseKey);

const debtsToCreate = [
  { supplier: "AC Distribuidora", amount: 96000, vto: "2026-06-08" },
  { supplier: "AC Papelera Bustamante", amount: 96000, vto: "2026-06-08" },
  { supplier: "AC Papelera Bustamante", amount: 120000, vto: "2026-06-08" },
  { supplier: "AC Papelera Bustamante", amount: 189800, vto: "2026-06-08" },
  { supplier: "AC Papelera Bustamante", amount: 102600, vto: "2026-06-08" },
  
  { supplier: "Verduleria Galope", amount: 179500, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 54000, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 44000, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 152500, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 90500, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 136000, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 236000, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 40000, vto: "2026-06-08" },
  { supplier: "Verduleria Galope", amount: 303000, vto: "2026-06-08" },

  { supplier: "Icedream", amount: 716224, vto: "2026-06-08" },
  { supplier: "Icedream", amount: 75392, vto: "2026-06-08" },
  { supplier: "Icedream", amount: 188480, vto: "2026-06-08" },
  { supplier: "Icedream", amount: 565440, vto: "2026-06-08" },
  { supplier: "Icedream", amount: 226176, vto: "2026-06-08" },

  { supplier: "Sparkling", amount: 141461, vto: "2026-06-08" },
  { supplier: "Sparkling", amount: 157175, vto: "2026-06-08" },
  { supplier: "Sparkling", amount: 157179, vto: "2026-06-08" },
  { supplier: "Sparkling", amount: 125743, vto: "2026-06-08" },

  { supplier: "Criollo", amount: 72830, vto: "2026-06-08" },
  { supplier: "Horeca", amount: 83140, vto: "2026-06-08" },
  { supplier: "Sintaxis", amount: 275517, vto: "2026-06-08" },

  { supplier: "Horeca", amount: 656424.65, vto: "2026-06-13" },
  { supplier: "Criollo", amount: 72830.16, vto: "2026-06-13" },
  { supplier: "Criollo", amount: 24276.72, vto: "2026-06-16" },
  { supplier: "Horeca", amount: 481665.05, vto: "2026-06-16" }
];

async function main() {
  console.log(`Starting to seed ${debtsToCreate.length} debts...`);
  
  for (const item of debtsToCreate) {
    const nameTrimmed = item.supplier.trim();
    
    // Find or create supplier
    const { data: prov, error: provFindErr } = await supabase
      .from('proveedores')
      .select('id')
      .ilike('nombre', nameTrimmed)
      .maybeSingle();

    if (provFindErr) {
      console.error(`Error finding supplier ${nameTrimmed}:`, provFindErr);
      continue;
    }

    let proveedorId = prov?.id;
    if (!proveedorId) {
      console.log(`Supplier '${nameTrimmed}' not found. Creating it...`);
      const { data: newProv, error: insProvErr } = await supabase
        .from('proveedores')
        .insert({ nombre: nameTrimmed })
        .select('id')
        .single();
      if (insProvErr) {
        console.error(`Error inserting supplier ${nameTrimmed}:`, insProvErr);
        continue;
      }
      proveedorId = newProv.id;
      console.log(`Created supplier '${nameTrimmed}' with ID: ${proveedorId}`);
    }

    // Insert purchase order
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        proveedor_id: proveedorId,
        costo_total: item.amount,
        monto_pagado: 0,
        estado: 'RECIBIDA',
        estado_pago: 'pendiente',
        fecha_vencimiento_pago: item.vto,
        plazo_pago: 'ad-hoc'
      })
      .select('id')
      .single();

    if (poErr) {
      console.error(`Error creating PO for ${nameTrimmed} (${item.amount}):`, poErr);
    } else {
      console.log(`Created pending PO ${po.id.slice(0, 8)} for '${nameTrimmed}' - Amount: ${item.amount} - Vto: ${item.vto}`);
    }
  }
  
  console.log("Seeding complete!");
}

main();
