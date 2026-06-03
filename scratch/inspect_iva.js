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

async function getIVABalance(periodo) {
  const startDate = `${periodo}-01`;
  const [yearStr, monthStr] = periodo.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${periodo}-${String(lastDay).padStart(2, '0')}`;

  console.log(`Querying afip_comprobantes from ${startDate} to ${endDate}...`);

  const { data: comps, error: compsErr } = await supabase
    .from('afip_comprobantes')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  if (compsErr) {
    console.error("Error al buscar comprobantes:", compsErr);
    return { success: false, error: compsErr.message }
  }

  console.log(`Found ${comps.length} comprobantes for period ${periodo}`);

  let debito_fiscal_puro = 0;
  let credito_fiscal_puro = 0;
  let countEmitidos = 0;
  let countRecibidos = 0;

  comps?.forEach((c) => {
    if (c.tipo_flujo === 'emitido') {
      debito_fiscal_puro += Number(c.total_iva) || 0;
      countEmitidos++;
    } else {
      credito_fiscal_puro += Number(c.total_iva) || 0;
      countRecibidos++;
    }
  });

  return {
    success: true,
    counts: { emitidos: countEmitidos, recibidos: countRecibidos },
    data: {
      periodo,
      debito_fiscal_puro,
      credito_fiscal_puro
    }
  };
}

async function run() {
  const res = await getIVABalance("2026-05");
  console.log("Result:", res);
}

run();
