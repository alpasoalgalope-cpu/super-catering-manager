const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

// Replicate Server Action logic
async function getTreasuryCalendarEventsAction(mesPeriodo) {
  const { data: settingsData } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', 'treasury_cutoff_date')
    .single();
  const cutoffDate = settingsData?.value || "";

  const [yearStr, monthStr] = mesPeriodo.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear++;
  }

  const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const lastDayNextMonth = new Date(nextYear, nextMonth, 0).getDate();
  const endDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayNextMonth).padStart(2, '0')}`;

  const eventsList = [];

  // A. Purchase Orders (OC)
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id, costo_total, monto_pagado, estado_pago, fecha_vencimiento_pago, proveedores(nombre)')
    .eq('estado', 'RECIBIDA')
    .gte('fecha_vencimiento_pago', startDateStr)
    .lte('fecha_vencimiento_pago', endDateStr);

  pos?.forEach(po => {
    if (po.fecha_vencimiento_pago) {
      eventsList.push({
        id: po.id,
        tipo: 'oc',
        title: `OC: ${(po.proveedores)?.nombre || 'Proveedor'}`,
        date: po.fecha_vencimiento_pago,
        amount: Number(po.costo_total) || 0,
        paidAmount: Number(po.monto_pagado) || 0,
        status: po.estado_pago,
        metadata: po
      });
    }
  });

  // B. Sales headers
  const { data: sales } = await supabase
    .from('event_sales_headers')
    .select('id, total_amount, monto_cobrado, estado_cobro, fecha_cobro, company_name, events_master(show_name)')
    .gte('fecha_cobro', startDateStr)
    .lte('fecha_cobro', endDateStr);

  sales?.forEach(s => {
    if (s.fecha_cobro) {
      eventsList.push({
        id: s.id,
        tipo: 'venta',
        title: `Vta: ${(s.events_master)?.show_name || s.company_name}`,
        date: s.fecha_cobro,
        amount: Number(s.total_amount) || 0,
        paidAmount: Number(s.monto_cobrado) || 0,
        status: s.estado_cobro === 'cobrado' ? 'cobrado' : s.estado_cobro,
        metadata: s
      });
    }
  });

  // C. Services
  const { data: servs, error: servErr } = await supabase
    .from('vencimientos_servicios')
    .select('id, monto, estado_pago, fecha_vencimiento, servicios(nombre)')
    .gte('fecha_vencimiento', startDateStr)
    .lte('fecha_vencimiento', endDateStr);

  console.log("Querying vencimientos_servicios in range:", startDateStr, "to", endDateStr);
  if (servErr) {
    console.error("vencimientos_servicios query error:", servErr);
  } else {
    console.log("vencimientos_servicios query returned:", servs);
  }

  servs?.forEach(s => {
    if (s.fecha_vencimiento) {
      eventsList.push({
        id: s.id,
        tipo: 'servicio',
        title: `Serv: ${(s.servicios)?.nombre || 'Servicio'}`,
        date: s.fecha_vencimiento,
        amount: Number(s.monto) || 0,
        status: s.estado_pago,
        metadata: s
      });
    }
  });

  // D. Generalized Taxes (vencimientos_impuestos)
  const { data: taxBills, error: taxErr } = await supabase
    .from('vencimientos_impuestos')
    .select('*, impuestos(nombre)')
    .gte('fecha_vencimiento', startDateStr)
    .lte('fecha_vencimiento', endDateStr);

  console.log("Querying vencimientos_impuestos in range:", startDateStr, "to", endDateStr);
  if (taxErr) {
    console.error("vencimientos_impuestos query error:", taxErr);
  } else {
    console.log("vencimientos_impuestos query returned:", taxBills);
  }

  taxBills?.forEach(t => {
    eventsList.push({
      id: t.id,
      tipo: 'impuesto',
      title: `Imp: ${(t.impuestos)?.nombre || 'Impuesto'}`,
      date: t.fecha_vencimiento,
      amount: Number(t.monto) || 0,
      status: t.estado_pago,
      metadata: t
    });
  });

  let filteredEvents = eventsList;
  if (cutoffDate) {
    filteredEvents = eventsList.filter(e => e.date >= cutoffDate);
  }

  return filteredEvents;
}

async function main() {
  const events = await getTreasuryCalendarEventsAction('2026-06');
  console.log(`\nTotal calendar events fetched for 2026-06: ${events.length}`);
  console.log("Events:", events);
}

main();
