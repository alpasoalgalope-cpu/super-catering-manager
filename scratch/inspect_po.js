const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envFile = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== INSPECTING RECENT PURCHASE ORDERS ===");
  const { data: pos, error: pErr } = await supabase
    .from('purchase_orders')
    .select('id, nro_comprobante, tipo_documento, facturado, estado, costo_total, created_at, proveedor_id')
    .order('created_at', { ascending: false })
    .limit(15);

  if (pErr) {
    console.error("Error PO:", pErr);
    return;
  }

  console.log("PO count:", pos.length);
  pos.forEach(p => {
    console.log(`PO ID: ${p.id} | Nro: ${p.nro_comprobante} | Tipo: ${p.tipo_documento} | Facturado: ${p.facturado} | Estado: ${p.estado} | Costo: ${p.costo_total} | Creado: ${p.created_at}`);
  });
}

inspect();
