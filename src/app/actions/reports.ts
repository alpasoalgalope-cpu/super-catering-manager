"use server"
import { supabase } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"

export interface ReportRow {
  id: string; // header id
  fecha: string;
  evento: string;
  venue: string;
  empresa: string;
  pax_proyectado: number;
  unidades_vendidas: number;
  unidades_liberadas: number;
  total_unidades: number;
  trad_qty: number;
  trad_pct: number;
  veg_qty: number;
  veg_pct: number;
  vegan_qty: number;
  vegan_pct: number;
  sintacc_qty: number;
  sintacc_pct: number;
  venta_total: number;
  coordinador: string;
}

export async function getReportsDataAction(): Promise<{ data?: ReportRow[], error?: string }> {
  try {
    // 1. Fetch sales headers and join with event_master
    // We fetch headers directly and join event_master to filter by status
    const { data: headers, error: hErr } = await supabase
      .from('event_sales_headers')
      .select(`
        *,
        events_master!event_master_id!inner (
          id,
          event_date,
          show_name,
          status,
          venues (name),
          coordinators (name)
        )
      `)
      .ilike('events_master.status', '%ejecutado%')
      
    if (hErr) throw hErr;
    if (!headers || headers.length === 0) return { data: [] };

    const headerIds = headers.map(h => h.id);
    const eventIds = Array.from(new Set(headers.map(h => h.event_master_id)));

    // 2. Fetch clients to map company_name to client_id and get conversion factors
    const { data: clients } = await supabase.from('clients').select('id, name, conversion_factor');
    
    // 3. Fetch bus assignments for these events to get unit-level coordinators
    const { data: assignments } = await supabase
      .from('event_bus_assignments')
      .select('event_id, client_id, coordinators(name)')
      .in('event_id', eventIds);

    // 4. Fetch sales units for category aggregation
    const { data: units, error: uErr } = await supabase
      .from('event_sales_units')
      .select('header_id, sold_qty, liberated_qty, traditional, vegetarian, vegana, sin_tacc')
      .in('header_id', headerIds)

    if (uErr) throw uErr;

    // 5. Aggregate data
    const reportData: ReportRow[] = [];

    for (const header of headers) {
      const event = header.events_master as any;
      if (!event) continue;

      const headerUnits = (units || []).filter(u => u.header_id === header.id);
      
      let sold = 0;
      let liberated = 0;
      let trad = 0;
      let veg = 0;
      let vegan = 0;
      let st = 0;

      headerUnits.forEach(u => {
        sold += (Number(u.sold_qty) || 0);
        liberated += (Number(u.liberated_qty) || 0);
        trad += (Number(u.traditional) || 0);
        veg += (Number(u.vegetarian) || 0);
        vegan += (Number(u.vegana) || 0);
        st += (Number(u.sin_tacc) || 0);
      });

      const totalUnidades = sold + liberated; 
      const calcPct = (qty: number) => totalUnidades > 0 ? (qty / totalUnidades) * 100 : 0;

      // Robust coordinator lookup 
      const client = clients?.find(c => c.name?.toLowerCase() === (header.company_name || header.company)?.toLowerCase());
      const clientId = client?.id;
      const factor = Number(client?.conversion_factor) || 1;

      const assignment = assignments?.find(a => a.event_id === header.event_master_id && a.client_id === clientId);
      const assignmentCoord = (assignment?.coordinators as any)?.name;

      let finalCoord = 'S/D';
      if (assignmentCoord) {
        finalCoord = assignmentCoord;
      } else if (header.coordinator_name && String(header.coordinator_name).trim() !== "") {
        finalCoord = header.coordinator_name;
      } else if (event.coordinators) {
        const c = event.coordinators;
        finalCoord = Array.isArray(c) ? (c[0]?.name || 'S/D') : (c.name || 'S/D');
      }

      reportData.push({
        id: header.id,
        fecha: event.event_date || header.event_date,
        evento: event.show_name || header.show_name || 'S/D',
        venue: event.venues?.name || header.venue_name || header.venue || 'S/D',
        empresa: client?.name || header.company_name || header.company || 'S/D',
        pax_proyectado: (Number(header.pax_projected) || 0) * factor,
        unidades_vendidas: sold,
        unidades_liberadas: liberated,
        total_unidades: totalUnidades,
        trad_qty: trad,
        trad_pct: calcPct(trad),
        veg_qty: veg,
        veg_pct: calcPct(veg),
        vegan_qty: vegan,
        vegan_pct: calcPct(vegan),
        sintacc_qty: st,
        sintacc_pct: calcPct(st),
        venta_total: Number(header.total_amount) || 0,
        coordinador: finalCoord
      });
    }

    // Sort by date desc initially
    reportData.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return { data: reportData };
  } catch (err: any) {
    console.error("Error fetching reports data:", err);
    return { error: err.message || "Error interno al obtener el informe" };
  }
}

export interface RVCoordinatorPerformance {
  coordinador: string;
  total_eventos: number;
  total_venta: number;
  total_unidades: number;
  total_pax_proyectado: number;
  conversion: number;
  promedio_venta_evento: number;
  promedio_unidades_evento: number;
}

export async function getRVTrasladosReportAction(): Promise<{ data?: RVCoordinatorPerformance[], error?: string }> {
  try {
    // 1. Fetch all headers for RV Traslados (ejecutado only)
    const { data: headers, error: hErr } = await supabase
      .from('event_sales_headers')
      .select(`
        *,
        events_master!event_master_id!inner (
          id,
          event_date,
          show_name,
          status
        )
      `)
      .ilike('company_name', '%RV Traslados%')
      .ilike('events_master.status', '%ejecutado%')

    if (hErr) throw hErr;
    if (!headers || headers.length === 0) return { data: [] };

    const headerIds = headers.map(h => h.id);
    const eventIds = Array.from(new Set(headers.map(h => h.event_master_id)));

    // 2. Fetch clients to get the RV Factor
    const { data: client } = await supabase.from('clients').select('id, name, conversion_factor').ilike('name', '%RV Traslados%').single();
    const rvFactor = Number(client?.conversion_factor) || 1;
    const clientId = client?.id;

    // 3. Fetch all bus assignments for these events
    const { data: assignments } = await supabase
      .from('event_bus_assignments')
      .select('event_id, client_id, coordinator_id, coordinators(name)')
      .in('event_id', eventIds)
      .eq('client_id', clientId)
      .order('id', { ascending: true }); // Important for matching by order

    // 4. Fetch all units for these headers (joining coordinators)
    const { data: units } = await supabase
      .from('event_sales_units')
      .select('*, coordinators(name)')
      .in('header_id', headerIds)
      .order('created_at', { ascending: true });

    // 5. Group by coordinator at the UNIT level
    const stats: Record<string, RVCoordinatorPerformance> = {};

    headers.forEach(h => {
      const hUnits = (units || []).filter(u => u.header_id === h.id);
      
      // Calculate Header-level targets using ORIGINAL projected PAX
      const headerTotalPaxOriginal = Number(h.pax_projected) || 0;
      const headerTotalUnitsSold = hUnits.reduce((acc, u) => acc + (Number(u.sold_qty) || 0), 0);

      hUnits.forEach((u) => {
        const coordName = (u.coordinators as any)?.name || h.coordinator_name || 'S/D';

        if (!stats[coordName]) {
          stats[coordName] = {
            coordinador: coordName,
            total_eventos: 0,
            total_venta: 0,
            total_unidades: 0,
            total_pax_proyectado: 0,
            conversion: 0,
            promedio_venta_evento: 0,
            promedio_unidades_evento: 0
          };
        }

        const sold = Number(u.sold_qty) || 0;
        
        // Distribution proportional to buses count in the header based on ORIGINAL PAX
        const unitPax = hUnits.length > 0 ? headerTotalPaxOriginal / hUnits.length : 0;
        
        // Billing: (Header Total / Sold Units) * This Unit Sold Units
        const unitBilling = headerTotalUnitsSold > 0 ? (Number(h.total_amount) / headerTotalUnitsSold) * sold : 0;

        stats[coordName].total_venta += unitBilling;
        stats[coordName].total_unidades += sold;
        stats[coordName].total_pax_proyectado += unitPax;
      });
    });

    // 6. Count unique events per coordinator
    headers.forEach(h => {
       const hUnits = (units || []).filter(u => u.header_id === h.id);
       const coordsInEvent = new Set(hUnits.map(u => (u.coordinators as any)?.name).filter(Boolean));
       if (coordsInEvent.size === 0 && h.coordinator_name) coordsInEvent.add(h.coordinator_name);
       
       coordsInEvent.forEach(c => {
         if (stats[c as string]) stats[c as string].total_eventos += 1;
       });
    });

    // 7. Final calculation
    const result = Object.values(stats).map(s => ({
      ...s,
      conversion: s.total_pax_proyectado > 0 ? (s.total_unidades / s.total_pax_proyectado) * 100 : 0,
      promedio_venta_evento: s.total_eventos > 0 ? s.total_venta / s.total_eventos : 0,
      promedio_unidades_evento: s.total_eventos > 0 ? s.total_unidades / s.total_eventos : 0
    }));

    // Sort by total sales desc
    result.sort((a, b) => b.total_venta - a.total_venta);

    return { data: result };
  } catch (err: any) {
    console.error("Error in RV report action:", err);
    return { error: err.message || "Error al generar el informe de RV Traslados" };
  }
}

export interface FinancialReportData {
  month: string;
  monthName: string;
  ventas: number;          // Teórico
  materiaPrima: number;    // Teórico
  logistica: number;       // Teórico (Proyectado)
  extras: number;          // Teórico (Proyectado)
  comisiones: number;      // Teórico (Proyectado)
  totalGastos: number;     // Teórico Total
  utilidad: number;        // Teórico Neto
  
  ventasReal: number;      // Real
  materiaPrimaReal: number;// Real
  logisticaReal: number;   // Real Logistics
  extrasReal: number;      // Real Extras
  gastosEstructuraReal: number; // Real Overhead
  egrVariosReal: number;   // Real Misc Expenses
  totalGastosReal: number; // Real Total Expenses
  utilidadReal: number;    // Real Net Profit
}

export async function getFinancialReportsAction(): Promise<{ data?: FinancialReportData[], error?: string }> {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 12);
    const dateLimit = oneMonthAgo.toISOString().split('T')[0];

    // 1. Fetch Events Master (Initial fetch to get IDs) - LIMITED TO LAST 12 MONTHS
    const { data: events, error: eErr } = await supabase
      .from('events_master')
      .select('id, event_date, status, logistics_cost, extras_cost, commissions_cost')
      .ilike('status', '%ejecutado%')
      .gte('event_date', dateLimit);

    if (eErr) throw eErr;
    if (!events || events.length === 0) return { data: [] };

    const eventIds = events.map(e => e.id);

    // 1b. Fetch Cash Movements consolidated (no concept filter to ensure full cash matching)
    const { data: cmMovements, error: cmErr } = await supabase
      .from('cash_movements')
      .select('fecha, mes, concepto, conc_caja, importe')
      .gte('fecha', dateLimit);

    if (cmErr) {
      console.error("Error fetching cash movements for financial report:", cmErr);
    }

    const cashEstructuraByMonth: Record<string, number> = {};
    const cashLogisticaByMonth: Record<string, number> = {};
    const cashExtrasByMonth: Record<string, number> = {};
    const cashMateriaPrimaByMonth: Record<string, number> = {};
    const cashVentasByMonth: Record<string, number> = {};
    const cashEgrVariosByMonth: Record<string, number> = {};

    cmMovements?.forEach(m => {
      if (!m.mes) return;
      const match = m.mes.match(/^(\d{2})\./);
      if (match) {
        const monthNum = match[1];
        const year = m.fecha ? m.fecha.substring(0, 4) : "2026";
        const key = `${year}-${monthNum}`;
        
        if (m.importe > 0) {
          cashVentasByMonth[key] = (cashVentasByMonth[key] || 0) + m.importe;
        } else {
          const amount = Math.abs(Number(m.importe) || 0);
          const concepto = String(m.concepto || "").toLowerCase();
          
          if (concepto === 'materia prima') {
            cashMateriaPrimaByMonth[key] = (cashMateriaPrimaByMonth[key] || 0) + amount;
          } else if (['estructura', 'servicios', 'impuestos', 'administracion'].includes(concepto)) {
            cashEstructuraByMonth[key] = (cashEstructuraByMonth[key] || 0) + amount;
            
            const concCaja = String(m.conc_caja || "").toLowerCase();
            if (concCaja.includes('log') || concCaja === 'logística') {
              cashLogisticaByMonth[key] = (cashLogisticaByMonth[key] || 0) + amount;
            } else if (concCaja.includes('ext') || concCaja === 'extras') {
              cashExtrasByMonth[key] = (cashExtrasByMonth[key] || 0) + amount;
            }
          } else {
            cashEgrVariosByMonth[key] = (cashEgrVariosByMonth[key] || 0) + amount;
          }
        }
      }
    });

    // 2. Fetch ALL Sales Headers for these events (both legacy and master links)
    const { data: allHeaders, error: hErr } = await supabase
      .from('event_sales_headers')
      .select('id, event_id, event_master_id, total_amount, company_name')
      .or(`event_id.in.(${eventIds.join(',')}),event_master_id.in.(${eventIds.join(',')})`);

    if (hErr) throw hErr;

    // Index headers by event_id or event_master_id for easier processing
    const headersByEvent: Record<string, any[]> = {};
    const allHeaderIds: string[] = [];
    allHeaders?.forEach(h => {
      const eid = h.event_master_id || h.event_id;
      if (eid && eventIds.includes(eid)) {
        if (!headersByEvent[eid]) headersByEvent[eid] = [];
        headersByEvent[eid].push(h);
        allHeaderIds.push(h.id);
      }
    });

    // 3. Fetch Units, Frozen Costs, and Commercial Rules IN PARALLEL
    const [unitsRes, frozenRes, rulesRes, recetasRes, waterRes] = await Promise.all([
      supabase
        .from('event_sales_units')
        .select(`
          id, header_id, sold_qty, traditional, vegetarian, vegana, sin_tacc, water_qty, water,
          recipe_trad_id, recipe_veg_id, recipe_vegan_id, recipe_sintacc_id
        `)
        .in('header_id', allHeaderIds),
      supabase
        .from('event_recipe_costs')
        .select('*')
        .in('event_id', eventIds),
      supabase
        .from('commercial_rules')
        .select('*'),
      // Manual calculation fallback data
      supabase
        .from('recetas')
        .select(`
          id,
          receta_insumos (
            cantidad_necesaria,
            productos (
              iva_pct,
              precios_historicos ( costo_unidad_base, fecha_desde )
            )
          )
        `),
      supabase
        .from('productos')
        .select('iva_pct, precios_historicos(costo_unidad_base, fecha_desde)')
        .eq('id', '2e452d5b-9d90-47a7-ae2e-134cc55ef7bd')
        .single()
    ]);

    if (unitsRes.error) throw unitsRes.error;

    // Helper to get latest cost from history
    const getLatestCost = (hist: any[]) => {
      if (!hist || hist.length === 0) return 0;
      const sorted = [...hist].sort((a, b) => new Date(b.fecha_desde).getTime() - new Date(a.fecha_desde).getTime());
      return Number(sorted[0].costo_unidad_base) || 0;
    };

    // Build manual recipe cost map
    const manualRecipeMap: Record<string, number> = {};
    recetasRes.data?.forEach(r => {
      let gross = 0;
      if (r.receta_insumos) {
        for (const ins of r.receta_insumos as any[]) {
          const prod = ins.productos;
          const costNet = getLatestCost(prod?.precios_historicos || []);
          const iva = Number(prod?.iva_pct) || 21;
          const qty = Number(ins.cantidad_necesaria) || 0;
          gross += qty * costNet * (1 + iva / 100);
        }
      }
      manualRecipeMap[r.id] = gross;
    });

    const waterCostNet = getLatestCost(waterRes.data?.precios_historicos || []);
    const waterIva = Number(waterRes.data?.iva_pct) || 21;
    const manualWaterCost = waterCostNet * (1 + waterIva / 100);

    // 3. INDEXING (MAPS) FOR O(1) ACCESS
    const unitsByHeader: Record<string, any[]> = {};
    unitsRes.data?.forEach(u => {
      if (!unitsByHeader[u.header_id]) unitsByHeader[u.header_id] = [];
      unitsByHeader[u.header_id].push(u);
    });

    const costMap: Record<string, Record<string, number>> = {};
    const waterCostMap: Record<string, number> = {};

    frozenRes.data?.forEach(fc => {
      if (!costMap[fc.event_id]) costMap[fc.event_id] = {};
      if (fc.recipe_id) {
        costMap[fc.event_id][fc.recipe_id] = Number(fc.cost_gross) || 0;
      } else {
        waterCostMap[fc.event_id] = Number(fc.cost_gross) || 0;
      }
    });

    const rulesMap: Record<string, any> = {};
    rulesRes.data?.forEach(r => { rulesMap[r.company_name.toLowerCase()] = r });

    // 4. Aggregate by Month
    const monthlyStats: Record<string, FinancialReportData> = {};

    events.forEach(ev => {
      const date = new Date(ev.event_date + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).toUpperCase();

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          monthName,
          ventas: 0,
          materiaPrima: 0,
          logistica: 0,
          extras: 0,
          comisiones: 0,
          totalGastos: 0,
          utilidad: 0,
          gastosEstructuraReal: cashEstructuraByMonth[monthKey] || 0,
          materiaPrimaReal: cashMateriaPrimaByMonth[monthKey] || 0,
          logisticaReal: cashLogisticaByMonth[monthKey] || 0,
          extrasReal: cashExtrasByMonth[monthKey] || 0,
          ventasReal: cashVentasByMonth[monthKey] || 0,
          egrVariosReal: cashEgrVariosByMonth[monthKey] || 0,
          totalGastosReal: 0,
          utilidadReal: 0
        };
      }

      const stats = monthlyStats[monthKey];
      const evHeaders = headersByEvent[ev.id] || [];
      const evCostMap = costMap[ev.id] || {};
      const evWaterCost = waterCostMap[ev.id] || manualWaterCost || 45;

      evHeaders.forEach(h => {
        stats.ventas += Number(h.total_amount) || 0;
        const hUnits = unitsByHeader[h.id] || [];
        const rule = rulesMap[h.company_name?.toLowerCase() || ""];

        hUnits.forEach(u => {
          const rTrad = u.recipe_trad_id || rule?.recipe_trad_id;
          const rVeg = u.recipe_veg_id || rule?.recipe_veg_id;
          const rVegan = u.recipe_vegan_id || rule?.recipe_vegan_id;
          const rSintacc = u.recipe_sintacc_id || rule?.recipe_sintacc_id;

          const getCost = (rid: string | null) => rid ? (evCostMap[rid] || manualRecipeMap[rid] || 0) : 0;

          stats.materiaPrima += (Number(u.traditional) || 0) * getCost(rTrad);
          stats.materiaPrima += (Number(u.vegetarian) || 0) * getCost(rVeg);
          stats.materiaPrima += (Number(u.vegana) || 0) * getCost(rVegan);
          stats.materiaPrima += (Number(u.sin_tacc) || 0) * getCost(rSintacc);
          
          const wQty = Number(u.water_qty || u.water || 0);
          stats.materiaPrima += wQty * evWaterCost;
        });
      });

      // Fixed Costs
      stats.logistica += Number(ev.logistics_cost) || 0;
      stats.extras += Number(ev.extras_cost) || 0;
      stats.comisiones += Number(ev.commissions_cost) || 0;
    });

    // 5. Finalize totals and utility
    const result = Object.values(monthlyStats).map(s => {
      // Teórico
      const totalGastos = s.materiaPrima + s.logistica + s.extras + s.comisiones;
      const utilidad = s.ventas - totalGastos;

      // Real (Puro de Caja)
      const totalGastosReal = s.materiaPrimaReal + s.gastosEstructuraReal + s.egrVariosReal;
      const utilidadReal = s.ventasReal - totalGastosReal;

      return {
        ...s,
        totalGastos,
        utilidad,
        totalGastosReal,
        utilidadReal
      };
    });

    // Sort by month
    result.sort((a, b) => a.month.localeCompare(b.month));

    return { data: result };
  } catch (err: any) {
    console.error("Error in financial report action:", err);
    return { error: err.message || "Error al generar el informe financiero" };
  }
}

export async function getIngredientPriceEvolutionAction(month?: string): Promise<{ data?: Record<string, { productNames: string[], data: any[] }>, error?: string }> {
  try {
    let startDate: Date;
    let endDate: Date;

    if (month && month !== 'all') {
      const [year, m] = month.split('-').map(Number);
      startDate = new Date(year, m - 1, 1);
      endDate = new Date(year, m, 0); // Last day of month
      
      // If it's the current month, cap endDate at today
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (year === currentYear && m === currentMonth) {
        // Set to today's date (local)
        endDate = new Date(currentYear, now.getMonth(), now.getDate());
      }
    } else {
      // "all" or empty - fetch last 12 months (or current year)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      startDate = twelveMonthsAgo;
      endDate = new Date();
    }

    const dateLimit = startDate.toISOString();
    const endLimit = endDate.toISOString();

    // 1. Fetch all purchases to have full history for carry-forward prices
    const { data: entries, error: pErr } = await supabase
      .from('registro_compras')
      .select(`
        costo_unidad,
        fecha,
        productos ( 
          nombre,
          familias ( nombre )
        )
      `)
      .lte('fecha', endLimit) // Up to the end of selected month
      .order('fecha', { ascending: true });

    if (pErr) throw pErr;

    // 2. Process daily evolution by family
    const familyData: Record<string, { productNames: Set<string>, lastKnownPrices: Record<string, number>, changesByDate: Record<string, any[]> }> = {};

    // Initial pass to populate families and pre-period prices
    entries?.forEach(e => {
      const prod = e.productos as any;
      const fName = (Array.isArray(prod?.familias) ? prod.familias[0]?.nombre : prod?.familias?.nombre) || "Otros";
      const pName = (Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre);
      const entryDate = e.fecha.split('T')[0];

      if (!familyData[fName]) {
        familyData[fName] = { productNames: new Set(), lastKnownPrices: {}, changesByDate: {} };
      }

      if (pName) {
        familyData[fName].productNames.add(pName);
        
        // If entry is before our display range, it's a "last known price" for the start
        if (entryDate < startDate.toISOString().split('T')[0]) {
          familyData[fName].lastKnownPrices[pName] = Number(e.costo_unidad) || 0;
        } else {
          // It's a change within our range
          if (!familyData[fName].changesByDate[entryDate]) familyData[fName].changesByDate[entryDate] = [];
          familyData[fName].changesByDate[entryDate].push(e);
        }
      }
    });

    // 3. Build the specific dates for the selected range
    const dates: string[] = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    const result: Record<string, { productNames: string[], data: any[] }> = {};
    const isMultiMonth = !month || month === 'all';

    Object.entries(familyData).forEach(([fName, fInfo]) => {
      const dailyResult = dates.map(d => {
        const dateParts = d.split('-'); // ["2026", "05", "13"]
        const displayDate = isMultiMonth 
          ? `${dateParts[2]}/${dateParts[1]}` // "13/05"
          : `Día ${dateParts[2]}`; // "Día 13"
        
        if (fInfo.changesByDate[d]) {
          fInfo.changesByDate[d].forEach(e => {
            const prod = e.productos as any;
            const pName = (Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre);
            if (pName) {
              fInfo.lastKnownPrices[pName] = Number(e.costo_unidad) || 0;
            }
          });
        }

        return {
          day: dateParts[2],
          displayDate,
          ...fInfo.lastKnownPrices
        };
      });

      result[fName] = {
        productNames: Array.from(fInfo.productNames),
        data: dailyResult
      };
    });

    return { data: result };
  } catch (err: any) {
    console.error("Error in price evolution action:", err);
    return { error: err.message || "Error al obtener evolución de precios" };
  }
}

export async function getCoordinatorConversionRatesAction(): Promise<{ data?: Record<string, number>, error?: string }> {
  try {
    const reportRes = await getRVTrasladosReportAction();
    if (reportRes.error) throw new Error(reportRes.error);
    
    const rates: Record<string, number> = {};
    if (reportRes.data) {
      reportRes.data.forEach(item => {
        const name = item.coordinador.trim().toLowerCase();
        if (name && name !== 's/d') {
          rates[name] = item.conversion / 100;
        }
      });
    }
    return { data: rates };
  } catch (err: any) {
    console.error("Error in getCoordinatorConversionRatesAction:", err);
    return { error: err.message || "Error al obtener factores de conversión de coordinadores" };
  }
}

export interface SatisfactionReportRow {
  id: string;
  event_master_id: string;
  event_date: string;
  show_name: string;
  venue_name: string;
  company_name: string;
  respuestas_excelente: number;
  respuestas_muy_bueno: number;
  respuestas_bueno: number;
  respuestas_regular: number;
  respuestas_malo: number;
  total_respuestas: number;
  unidades_vendidas: number;
  tasa_respuesta: number;
  indice_satisfaccion: number;
}

export interface SatisfactionInput {
  id?: string;
  event_master_id: string;
  company_name: string;
  respuestas_excelente: number;
  respuestas_muy_bueno: number;
  respuestas_bueno: number;
  respuestas_regular: number;
  respuestas_malo: number;
}

export interface ExecutedEvent {
  id: string;
  show_name: string;
  event_date: string;
  venue_name: string;
}

export async function getSatisfactionReportsAction(): Promise<{ data?: SatisfactionReportRow[], error?: string }> {
  try {
    const { data: entries, error: sErr } = await supabase
      .from('event_satisfaction')
      .select(`
        *,
        events_master (
          id,
          event_date,
          show_name,
          venues (name)
        )
      `);

    if (sErr) throw sErr;
    if (!entries || entries.length === 0) return { data: [] };

    const eventMasterIds = Array.from(new Set(entries.map(e => e.event_master_id)));

    // Fetch headers
    const { data: headers } = await supabase
      .from('event_sales_headers')
      .select('id, event_master_id, company_name, company')
      .in('event_master_id', eventMasterIds);

    const headerIds = headers?.map(h => h.id) || [];
    const { data: units } = await supabase
      .from('event_sales_units')
      .select('header_id, sold_qty')
      .in('header_id', headerIds);

    const salesMap: Record<string, number> = {};
    if (headers && units) {
      headers.forEach(h => {
        const hUnits = units.filter(u => u.header_id === h.id);
        const totalSold = hUnits.reduce((sum, u) => sum + (Number(u.sold_qty) || 0), 0);
        const company = (h.company_name || h.company || '').trim().toLowerCase();
        const key = `${h.event_master_id}_${company}`;
        salesMap[key] = (salesMap[key] || 0) + totalSold;
      });
    }

    const reportData: SatisfactionReportRow[] = entries.map((entry: any) => {
      const event = entry.events_master;
      const totalResponses = 
        (entry.respuestas_excelente || 0) +
        (entry.respuestas_muy_bueno || 0) +
        (entry.respuestas_bueno || 0) +
        (entry.respuestas_regular || 0) +
        (entry.respuestas_malo || 0);

      // Math.round logic for satisfaction index
      let satisfactionIndex = 0;
      if (totalResponses > 0) {
        const rawIndex = (
          ((entry.respuestas_excelente || 0) * 100) +
          ((entry.respuestas_muy_bueno || 0) * 80) +
          ((entry.respuestas_bueno || 0) * 60) +
          ((entry.respuestas_regular || 0) * 40) +
          ((entry.respuestas_malo || 0) * 10)
        ) / totalResponses;
        satisfactionIndex = Math.round(rawIndex);
      }

      // Math.round logic for response rate
      const companyKey = `${entry.event_master_id}_${(entry.company_name || '').trim().toLowerCase()}`;
      const unitsSold = salesMap[companyKey] || 0;
      let responseRate = 0;
      if (unitsSold > 0) {
        const rawRate = (totalResponses / unitsSold) * 100;
        responseRate = Math.round(rawRate);
      }

      return {
        id: entry.id,
        event_master_id: entry.event_master_id,
        event_date: event?.event_date || 'S/D',
        show_name: event?.show_name || 'S/D',
        venue_name: event?.venues?.name || 'S/D',
        company_name: entry.company_name,
        respuestas_excelente: entry.respuestas_excelente || 0,
        respuestas_muy_bueno: entry.respuestas_muy_bueno || 0,
        respuestas_bueno: entry.respuestas_bueno || 0,
        respuestas_regular: entry.respuestas_regular || 0,
        respuestas_malo: entry.respuestas_malo || 0,
        total_respuestas: totalResponses,
        unidades_vendidas: unitsSold,
        tasa_respuesta: responseRate,
        indice_satisfaccion: satisfactionIndex
      };
    });

    // Sort by date descending
    reportData.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    return { data: reportData };
  } catch (err: any) {
    console.error("Error fetching satisfaction reports data:", err);
    return { error: err.message || "Error al obtener informe de satisfacción" };
  }
}

export async function saveSatisfactionAction(input: SatisfactionInput): Promise<{ success: boolean; error?: string }> {
  try {
    if (input.id) {
      const { error } = await supabase
        .from('event_satisfaction')
        .update({
          event_master_id: input.event_master_id,
          company_name: input.company_name,
          respuestas_excelente: input.respuestas_excelente,
          respuestas_muy_bueno: input.respuestas_muy_bueno,
          respuestas_bueno: input.respuestas_bueno,
          respuestas_regular: input.respuestas_regular,
          respuestas_malo: input.respuestas_malo
        })
        .eq('id', input.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('event_satisfaction')
        .insert({
          event_master_id: input.event_master_id,
          company_name: input.company_name,
          respuestas_excelente: input.respuestas_excelente,
          respuestas_muy_bueno: input.respuestas_muy_bueno,
          respuestas_bueno: input.respuestas_bueno,
          respuestas_regular: input.respuestas_regular,
          respuestas_malo: input.respuestas_malo
        });
      if (error) throw error;
    }
    return { success: true };
  } catch (err: any) {
    console.error("Error in saveSatisfactionAction:", err);
    if (err.code === '23505') {
      return { success: false, error: "Ya existe un registro de satisfacción para este show y cliente." };
    }
    return { success: false, error: err.message || "Error al guardar la satisfacción" };
  }
}

export async function deleteSatisfactionAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('event_satisfaction')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteSatisfactionAction:", err);
    return { success: false, error: err.message || "Error al eliminar la satisfacción" };
  }
}

export async function getExecutedEventsAction(): Promise<{ data?: ExecutedEvent[], error?: string }> {
  try {
    const { data: events, error: eErr } = await supabase
      .from('events_master')
      .select(`
        id,
        event_date,
        show_name,
        venues (name)
      `)
      .ilike('status', '%ejecutado%')
      .order('event_date', { ascending: false });

    if (eErr) throw eErr;

    const formatted = (events || []).map((e: any) => ({
      id: e.id,
      show_name: e.show_name || 'S/D',
      event_date: e.event_date,
      venue_name: e.venues?.name || 'S/D'
    }));

    return { data: formatted };
  } catch (err: any) {
    console.error("Error in getExecutedEventsAction:", err);
    return { error: err.message || "Error al obtener eventos ejecutados" };
  }
}

export interface EventSalesSummary {
  event_master_id: string;
  show_name: string;
  event_date: string;
  venue_name: string;
  companies: {
    company_name: string;
    sold_qty: number;
  }[];
}

export async function getEventSalesSummaryAction(): Promise<{ data?: EventSalesSummary[], error?: string }> {
  try {
    // 1. Fetch executed events
    const { data: events, error: eErr } = await supabase
      .from('events_master')
      .select(`
        id,
        event_date,
        show_name,
        venues (name)
      `)
      .ilike('status', '%ejecutado%')
      .order('event_date', { ascending: false });

    if (eErr) throw eErr;
    if (!events || events.length === 0) return { data: [] };

    const eventIds = events.map(e => e.id);

    // 2. Fetch sales headers for these events
    const { data: headers, error: hErr } = await supabase
      .from('event_sales_headers')
      .select('id, event_master_id, company_name, company')
      .in('event_master_id', eventIds);

    if (hErr) throw hErr;

    // 3. Fetch sales units
    const headerIds = headers?.map(h => h.id) || [];
    const { data: units, error: uErr } = await supabase
      .from('event_sales_units')
      .select('header_id, sold_qty')
      .in('header_id', headerIds);

    if (uErr) throw uErr;

    // 4. Map and group units
    const salesMap: Record<string, Record<string, number>> = {}; // event_id -> company_name -> sold_qty
    headers?.forEach(h => {
      const hUnits = units?.filter(u => u.header_id === h.id) || [];
      const totalSold = hUnits.reduce((sum, u) => sum + (Number(u.sold_qty) || 0), 0);
      const company = (h.company_name || h.company || 'S/D').trim();
      
      if (!salesMap[h.event_master_id]) {
        salesMap[h.event_master_id] = {};
      }
      salesMap[h.event_master_id][company] = (salesMap[h.event_master_id][company] || 0) + totalSold;
    });

    const summary: EventSalesSummary[] = events.map((e: any) => {
      const eventCompanies = salesMap[e.id] || {};
      const companiesList = Object.entries(eventCompanies).map(([name, qty]) => ({
        company_name: name,
        sold_qty: qty
      }));

      // If no sales headers but we want to allow typing any company, we'll list a default
      if (companiesList.length === 0) {
        companiesList.push({ company_name: "RV Traslados", sold_qty: 0 });
      }

      return {
        event_master_id: e.id,
        show_name: e.show_name || 'S/D',
        event_date: e.event_date,
        venue_name: e.venues?.name || 'S/D',
        companies: companiesList
      };
    });

    return { data: summary };
  } catch (err: any) {
    console.error("Error in getEventSalesSummaryAction:", err);
    return { error: err.message || "Error al obtener resumen de ventas por evento" };
  }
}

export async function getRVTrasladosShowsComparisonAction(selectedEventMasterIds?: string[]) {
  try {
    const supabaseClient = createClient()
    
    // 1. Fetch all headers for RV Traslados (ejecutado only)
    const { data: headers, error: hErr } = await supabaseClient
      .from('event_sales_headers')
      .select(`
        id,
        total_amount,
        event_master_id,
        coordinator_name,
        pax_projected,
        events_master!event_master_id!inner (
          id,
          event_date,
          show_name,
          status
        )
      `)
      .ilike('company_name', '%RV Traslados%')
      .ilike('events_master.status', '%ejecutado%')

    if (hErr) throw hErr;
    if (!headers || headers.length === 0) return { success: true, shows: [], comparison: [] };

    // Get unique list of shows for the selector
    const showsMap: Record<string, { id: string, name: string, date: string }> = {}
    headers.forEach(h => {
      const em = h.events_master as any
      if (em) {
        showsMap[em.id] = {
          id: em.id,
          name: em.show_name,
          date: em.event_date
        }
      }
    })
    const showsList = Object.values(showsMap).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const headerIds = headers.map(h => h.id)

    // Fetch all units for these headers
    const { data: units, error: uErr } = await supabaseClient
      .from('event_sales_units')
      .select('header_id, sold_qty, coordinators(name)')
      .in('header_id', headerIds)

    if (uErr) throw uErr

    // Calculate total billing, units, and projected pax for ALL events grouped by coordinator
    const coordinatorHistoricalStats: Record<string, { units: number, pax: number, sales: number }> = {}

    headers.forEach(h => {
      const hUnits = (units || []).filter(u => u.header_id === h.id)
      const headerTotalPaxOriginal = Number(h.pax_projected) || 0
      const headerTotalUnitsSold = hUnits.reduce((acc, u) => acc + (Number(u.sold_qty) || 0), 0)

      if (hUnits.length === 0 && Number(h.total_amount) > 0) {
        const coordName = h.coordinator_name || 'Venta Directa / Sin Asignar'
        const pax = Number(h.pax_projected) || 0
        const sales = Number(h.total_amount) || 0
        const unitsSold = Math.round(sales / 10000)
        
        if (!coordinatorHistoricalStats[coordName]) {
          coordinatorHistoricalStats[coordName] = { units: 0, pax: 0, sales: 0 }
        }
        coordinatorHistoricalStats[coordName].units += unitsSold
        coordinatorHistoricalStats[coordName].pax += pax
        coordinatorHistoricalStats[coordName].sales += sales
      } else {
        hUnits.forEach(u => {
          const coordName = (u.coordinators as any)?.name || h.coordinator_name || 'S/D'
          const sold = Number(u.sold_qty) || 0
          const unitPax = hUnits.length > 0 ? headerTotalPaxOriginal / hUnits.length : 0
          const unitBilling = headerTotalUnitsSold > 0 ? (Number(h.total_amount) / headerTotalUnitsSold) * sold : 0

          if (!coordinatorHistoricalStats[coordName]) {
            coordinatorHistoricalStats[coordName] = { units: 0, pax: 0, sales: 0 }
          }
          coordinatorHistoricalStats[coordName].units += sold
          coordinatorHistoricalStats[coordName].pax += unitPax
          coordinatorHistoricalStats[coordName].sales += unitBilling
        })
      }
    })

    // Now, if selectedEventMasterIds is provided and not empty, calculate performance for SELECTED shows
    const comparison: any[] = []
    let grandTotalSalesSelected = 0
    
    if (selectedEventMasterIds && selectedEventMasterIds.length > 0) {
      const selectedHeaders = headers.filter(h => selectedEventMasterIds.includes(h.event_master_id))
      const coordinatorSelectedStats: Record<string, { units: number, pax: number, sales: number }> = {}

      selectedHeaders.forEach(h => {
        const hUnits = (units || []).filter(u => u.header_id === h.id)
        const headerTotalPaxOriginal = Number(h.pax_projected) || 0
        const headerTotalUnitsSold = hUnits.reduce((acc, u) => acc + (Number(u.sold_qty) || 0), 0)

        if (hUnits.length === 0 && Number(h.total_amount) > 0) {
          const coordName = h.coordinator_name || 'Venta Directa / Sin Asignar'
          const pax = Number(h.pax_projected) || 0
          const sales = Number(h.total_amount) || 0
          const unitsSold = Math.round(sales / 10000)
          
          if (!coordinatorSelectedStats[coordName]) {
            coordinatorSelectedStats[coordName] = { units: 0, pax: 0, sales: 0 }
          }
          coordinatorSelectedStats[coordName].units += unitsSold
          coordinatorSelectedStats[coordName].pax += pax
          coordinatorSelectedStats[coordName].sales += sales
          grandTotalSalesSelected += sales
        } else {
          hUnits.forEach(u => {
            const coordName = (u.coordinators as any)?.name || h.coordinator_name || 'S/D'
            const sold = Number(u.sold_qty) || 0
            const unitPax = hUnits.length > 0 ? headerTotalPaxOriginal / hUnits.length : 0
            const unitBilling = headerTotalUnitsSold > 0 ? (Number(h.total_amount) / headerTotalUnitsSold) * sold : 0

            if (!coordinatorSelectedStats[coordName]) {
              coordinatorSelectedStats[coordName] = { units: 0, pax: 0, sales: 0 }
            }
            coordinatorSelectedStats[coordName].units += sold
            coordinatorSelectedStats[coordName].pax += unitPax
            coordinatorSelectedStats[coordName].sales += unitBilling
            grandTotalSalesSelected += unitBilling
          })
        }
      })

      // Build the comparison results
      Object.keys(coordinatorSelectedStats).forEach(coordName => {
        const selected = coordinatorSelectedStats[coordName]
        const historical = coordinatorHistoricalStats[coordName] || selected

        if (selected && selected.sales > 0) {
          const convSelected = selected.pax > 0 ? (selected.units / selected.pax) * 100 : 0
          const convHistorical = historical && historical.pax > 0 ? (historical.units / historical.pax) * 100 : convSelected

          comparison.push({
            coordinador: coordName,
            venta_seleccionada: selected.sales,
            conv_seleccionada: convSelected,
            conv_historica: convHistorical,
            diferencia: convSelected - convHistorical
          })
        }
      })

      comparison.sort((a, b) => b.venta_seleccionada - a.venta_seleccionada)
    }

    return {
      success: true,
      shows: showsList,
      comparison,
      grandTotalSalesSelected
    }
  } catch (err: any) {
    console.error("Error in getRVTrasladosShowsComparisonAction:", err)
    return { success: false, error: err.message || "Error al obtener la comparación de shows" }
  }
}

