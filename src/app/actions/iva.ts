"use server"

import { supabase } from "@/lib/supabase"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

// Helper to parse dates in various formats
function parseFlexibleDate(raw: any): string {
  if (!raw) throw new Error("Fecha vacía");
  
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0];
  }
  
  let numVal = NaN;
  if (typeof raw === 'number') {
    numVal = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    numVal = Number(raw.trim());
  }

  if (!isNaN(numVal) && numVal > 31) {
    // Excel date serial number (e.g. 44927)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numVal * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  let str = String(raw).trim().toLowerCase();
  
  // Match YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
  }
  
  // Match DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }

  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }

  throw new Error(`Formato de fecha inválido: "${raw}"`);
}

// Helper to parse AFIP numbers (handles commas and dots under any locale configuration)
function parseAFIPNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  if (!str) return 0;
  
  // Remove currency symbols, thousands spaces, or extra spaces
  str = str.replace(/[$]/g, '').trim();

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    // In Spanish: 1.234,56 (dot is thousands, comma is decimal)
    // In US: 1,234.56 (comma is thousands, dot is decimal)
    const firstComma = str.indexOf(',');
    const firstDot = str.indexOf('.');
    if (firstComma > firstDot) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only commas: e.g. 1234,56 (Spanish decimal). If multiple commas, treat as US thousands.
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount === 1) {
      str = str.replace(/,/g, '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    // Only dots: e.g. "1.234" (Spanish thousands: 1234) or "1234.56" (US decimal)
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple dots: e.g. 1.234.567 -> thousands separators
      str = str.replace(/\./g, '');
    } else {
      // Single dot. In AFIP exports, numbers typically have 2 decimal places. 
      // If the decimal part is exactly 3 digits (e.g. ".200" or ".000"), it's a thousands separator.
      // Otherwise, it is a decimal separator.
      // SAFETY: If the number starts with "0.", it is always a decimal! E.g. "0.050"
      if (!str.startsWith('0.')) {
        const parts = str.split('.');
        const decimalPart = parts[1];
        if (decimalPart && decimalPart.length === 3) {
          str = str.replace(/\./g, '');
        }
      }
    }
  }
  
  const num = Number(str.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

// Find key in row matching any candidate in a flexible manner
function findRowKey(row: any, candidates: string[]): string | undefined {
  const normalizedCandidates = candidates.map(c => 
    c.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .replace(/[^a-z0-9]/g, "")
  );

  for (const actualKey of Object.keys(row)) {
    const normKey = actualKey.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    
    const idx = normalizedCandidates.indexOf(normKey);
    if (idx !== -1) {
      return actualKey;
    }
  }
  return undefined;
}

function getRowValue(row: any, candidates: string[], defaultValue: any = undefined): any {
  const key = findRowKey(row, candidates);
  return key !== undefined ? row[key] : defaultValue;
}

// Import Excel / JSON rows into afip_comprobantes
export async function importAFIPComprobantes(rows: any[], tipoFlujo: 'emitido' | 'recibido') {
  if (!rows || rows.length === 0) {
    return { success: false, error: "El archivo no contiene filas." }
  }

  console.log(`[IVA IMPORT] Procesando ${rows.length} filas para flujo: ${tipoFlujo}`);
  if (rows.length > 0) {
    console.log(`[IVA IMPORT] Claves de la primera fila:`, Object.keys(rows[0] || {}));
    console.log(`[IVA IMPORT] Primera fila completa:`, rows[0]);
  }
  const comprobantesToInsert = [];
  let skippedRows = 0;

  // Candidate mappings for columns
  const FECHA_CANDS = ['fecha', 'fec comprobante', 'fec comp', 'fecha de comprobante', 'fecha comprobante'];
  const TIPO_COMP_CANDS = ['tipo', 'tipo de comprobante', 'tipo comprobante', 'cod comprobante', 'codigo comprobante'];
  const PV_CANDS = ['punto de venta', 'pv', 'pto vta', 'ptovta', 'punto venta', 'p v'];
  const NRO_DESDE_CANDS = ['numero desde', 'nro desde', 'nro desde', 'numero', 'numero comprobante', 'nro comprobante', 'nro comprobante', 'comprobante nro'];
  const NRO_HASTA_CANDS = ['numero hasta', 'nro hasta', 'nro hasta', 'numero_hasta'];
  const COD_AUTORIZACION_CANDS = ['cod autorizacion', 'codigo autorizacion', 'cae', 'cai', 'caea', 'autorizacion', 'cod_autorizacion'];
  
  // Contraparte depending on flow
  const CUIT_CANDS = tipoFlujo === 'recibido' 
    ? ['cuit emisor', 'nro doc emisor', 'doc emisor', 'nro doc emisor', 'cuit', 'cuit_contraparte', 'documento emisor'] 
    : ['cuit receptor', 'nro doc receptor', 'doc receptor', 'nro doc receptor', 'cuit cliente', 'cuit_contraparte', 'documento receptor'];
  
  const DENOMINACION_CANDS = tipoFlujo === 'recibido'
    ? ['denominacion emisor', 'razon social emisor', 'nombre emisor', 'nombre razon social emisor', 'denominacion_contraparte']
    : ['denominacion receptor', 'razon social receptor', 'nombre receptor', 'nombre razon social receptor', 'denominacion_contraparte'];

  const TIPO_CAMBIO_CANDS = ['tipo de cambio', 'tipo cambio', 'cambio', 'cotizacion'];
  const MONEDA_CANDS = ['moneda', 'codigo de moneda', 'moneda id'];

  // Net amount buckets
  const NETO_0_CANDS = ['neto grav 0', 'neto gravado 0', 'neto 0', 'importe neto gravado 0'];
  const NETO_2_5_CANDS = ['neto grav 2.5', 'neto gravado 2.5', 'neto 2.5', 'importe neto gravado 2.5'];
  const IVA_2_5_CANDS = ['iva 2.5', 'alicuota 2.5', 'imp iva 2.5', 'iva 2 5'];
  const NETO_5_CANDS = ['neto grav 5', 'neto gravado 5', 'neto 5', 'importe neto gravado 5'];
  const IVA_5_CANDS = ['iva 5', 'alicuota 5', 'imp iva 5', 'iva 5'];
  const NETO_10_5_CANDS = ['neto grav 10.5', 'neto gravado 10.5', 'neto 10.5', 'importe neto gravado 10.5', 'neto gravado 10,5%'];
  const IVA_10_5_CANDS = ['iva 10.5', 'alicuota 10.5', 'imp iva 10.5', 'iva 10,5%'];
  const NETO_21_CANDS = ['neto grav 21', 'neto gravado 21', 'neto 21', 'importe neto gravado 21', 'neto gravado 21%'];
  const IVA_21_CANDS = ['iva 21', 'alicuota 21', 'imp iva 21', 'iva 21%'];
  const NETO_27_CANDS = ['neto grav 27', 'neto gravado 27', 'neto 27', 'importe neto gravado 27', 'neto gravado 27%'];
  const IVA_27_CANDS = ['iva 27', 'alicuota 27', 'imp iva 27', 'iva 27%'];

  // Consolidados
  const NETO_GRAVADO_TOTAL_CANDS = ['neto gravado total', 'neto gravado', 'neto', 'imp neto gravado', 'neto_gravado_total'];
  const NETO_NO_GRAVADO_CANDS = ['neto no gravado', 'no gravado', 'imp neto no gravado', 'neto_no_gravado'];
  const OP_EXENTAS_CANDS = ['op exentas', 'exento', 'operaciones exentas', 'imp op exentas', 'op_exentas'];
  const OTROS_TRIBUTOS_CANDS = ['otros tributos', 'tributos', 'imp otros tributos', 'otros_tributos'];
  const TOTAL_IVA_CANDS = ['total iva', 'iva total', 'imp iva', 'iva', 'total_iva'];
  const IMP_TOTAL_CANDS = ['importe total', 'total', 'imp total', 'total comprobante', 'imp_total'];

  for (const row of rows) {
    try {
      // 1. Resolve date
      const rawDate = getRowValue(row, FECHA_CANDS);
      if (!rawDate) {
        skippedRows++;
        continue;
      }
      const fecha = parseFlexibleDate(rawDate);

      // 2. Resolve types & IDs
      const tipo_comprobante = String(getRowValue(row, TIPO_COMP_CANDS, '')).trim();
      if (!tipo_comprobante) {
        skippedRows++;
        continue;
      }

      const punto_venta = Math.round(Number(getRowValue(row, PV_CANDS, 0)));
      const numero_desde = Math.round(Number(getRowValue(row, NRO_DESDE_CANDS, 0)));
      const numero_hasta = Math.round(Number(getRowValue(row, NRO_HASTA_CANDS, numero_desde)));
      const cod_autorizacion = String(getRowValue(row, COD_AUTORIZACION_CANDS, '')).trim();

      // 3. Resolve contraparte
      const rawCuit = getRowValue(row, CUIT_CANDS, '');
      const cuit_contraparte = String(rawCuit).replace(/[^0-9]/g, '').trim();
      const denominacion_contraparte = String(getRowValue(row, DENOMINACION_CANDS, 'Desconocido')).trim();

      if (!cuit_contraparte) {
        skippedRows++;
        continue;
      }

      // 4. Currencies
      const rawTipoCambio = getRowValue(row, TIPO_CAMBIO_CANDS, 1);
      const tipo_cambio = parseAFIPNumber(rawTipoCambio) || 1;
      const moneda = String(getRowValue(row, MONEDA_CANDS, 'PES')).trim();

      // 5. Numerical fields - read using parseAFIPNumber
      let neto_grav_0 = parseAFIPNumber(getRowValue(row, NETO_0_CANDS, 0));
      let neto_grav_2_5 = parseAFIPNumber(getRowValue(row, NETO_2_5_CANDS, 0));
      let iva_2_5 = parseAFIPNumber(getRowValue(row, IVA_2_5_CANDS, 0));
      let neto_grav_5 = parseAFIPNumber(getRowValue(row, NETO_5_CANDS, 0));
      let iva_5 = parseAFIPNumber(getRowValue(row, IVA_5_CANDS, 0));
      let neto_grav_10_5 = parseAFIPNumber(getRowValue(row, NETO_10_5_CANDS, 0));
      let iva_10_5 = parseAFIPNumber(getRowValue(row, IVA_10_5_CANDS, 0));
      let neto_grav_21 = parseAFIPNumber(getRowValue(row, NETO_21_CANDS, 0));
      let iva_21 = parseAFIPNumber(getRowValue(row, IVA_21_CANDS, 0));
      let neto_grav_27 = parseAFIPNumber(getRowValue(row, NETO_27_CANDS, 0));
      let iva_27 = parseAFIPNumber(getRowValue(row, IVA_27_CANDS, 0));

      let neto_gravado_total = parseAFIPNumber(getRowValue(row, NETO_GRAVADO_TOTAL_CANDS, 0));
      let neto_no_gravado = parseAFIPNumber(getRowValue(row, NETO_NO_GRAVADO_CANDS, 0));
      let op_exentas = parseAFIPNumber(getRowValue(row, OP_EXENTAS_CANDS, 0));
      let otros_tributos = parseAFIPNumber(getRowValue(row, OTROS_TRIBUTOS_CANDS, 0));
      let total_iva = parseAFIPNumber(getRowValue(row, TOTAL_IVA_CANDS, 0));
      let imp_total = parseAFIPNumber(getRowValue(row, IMP_TOTAL_CANDS, 0));

      // Recalculate totals if specific columns present but main consolidados are zero
      const sumOfIvas = iva_2_5 + iva_5 + iva_10_5 + iva_21 + iva_27;
      if (total_iva === 0 && sumOfIvas !== 0) {
        total_iva = sumOfIvas;
      }
      
      const sumOfNetos = neto_grav_0 + neto_grav_2_5 + neto_grav_5 + neto_grav_10_5 + neto_grav_21 + neto_grav_27;
      if (neto_gravado_total === 0 && sumOfNetos !== 0) {
        neto_gravado_total = sumOfNetos;
      }

      // 6. Treat signs for Credit Notes (Ensuring we don't double-invert if they are already negative)
      const isCreditNote = tipo_comprobante.toLowerCase().includes("nota de credito") ||
                           tipo_comprobante.toLowerCase().includes("nota de crédito");

      if (isCreditNote) {
        if (neto_grav_0 > 0) neto_grav_0 *= -1;
        if (neto_grav_2_5 > 0) neto_grav_2_5 *= -1;
        if (iva_2_5 > 0) iva_2_5 *= -1;
        if (neto_grav_5 > 0) neto_grav_5 *= -1;
        if (iva_5 > 0) iva_5 *= -1;
        if (neto_grav_10_5 > 0) neto_grav_10_5 *= -1;
        if (iva_10_5 > 0) iva_10_5 *= -1;
        if (neto_grav_21 > 0) neto_grav_21 *= -1;
        if (iva_21 > 0) iva_21 *= -1;
        if (neto_grav_27 > 0) neto_grav_27 *= -1;
        if (iva_27 > 0) iva_27 *= -1;
        if (neto_gravado_total > 0) neto_gravado_total *= -1;
        if (neto_no_gravado > 0) neto_no_gravado *= -1;
        if (op_exentas > 0) op_exentas *= -1;
        if (otros_tributos > 0) otros_tributos *= -1;
        if (total_iva > 0) total_iva *= -1;
        if (imp_total > 0) imp_total *= -1;
      }

      // 7. Generate deterministic hash_id for Idempotency
      // MD5(tipo_flujo + cuit_contraparte + tipo_comprobante + punto_venta + numero_desde)
      const hashInput = `${tipoFlujo}|${cuit_contraparte}|${tipo_comprobante}|${punto_venta}|${numero_desde}`;
      const hash_id = crypto.createHash('md5').update(hashInput).digest('hex');

      comprobantesToInsert.push({
        tipo_flujo: tipoFlujo,
        fecha,
        tipo_comprobante,
        punto_venta,
        numero_desde,
        numero_hasta,
        cod_autorizacion,
        cuit_contraparte,
        denominacion_contraparte,
        tipo_cambio,
        moneda,
        neto_grav_0,
        neto_grav_2_5,
        iva_2_5,
        neto_grav_5,
        iva_5,
        neto_grav_10_5,
        iva_10_5,
        neto_grav_21,
        iva_21,
        neto_grav_27,
        iva_27,
        neto_gravado_total,
        neto_no_gravado,
        op_exentas,
        otros_tributos,
        total_iva,
        imp_total,
        hash_id
      });

    } catch (err) {
      console.warn(`[IVA IMPORT] Error procesando fila:`, row, err);
      skippedRows++;
    }
  }

  if (comprobantesToInsert.length === 0) {
    return { success: false, error: "No se pudieron procesar filas válidas en el archivo." }
  }

  // Insert/Upsert into Supabase (updating existing entries on conflict so changes are correctly applied)
  const { data, error } = await supabase
    .from('afip_comprobantes')
    .upsert(comprobantesToInsert, { onConflict: 'hash_id' })
    .select('id');

  if (error) {
    console.error("Error al insertar comprobantes:", error);
    return { success: false, error: error.message }
  }

  revalidatePath('/finanzas/iva');
  return {
    success: true,
    message: `Se leyeron ${rows.length} filas. Se importaron / actualizaron ${data?.length || 0} comprobantes con éxito. Se omitieron ${skippedRows} filas con error.`
  }
}

// Get standard YYYY-MM previous period
function getPreviousPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);
  month--;
  if (month === 0) {
    month = 12;
    year--;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Fetch dynamic or saved IVA calculation for a period
export async function getIVABalance(periodo: string) {
  // 1. Check if there's a saved (possibly closed) liquidation
  const { data: savedLiq, error: liqErr } = await supabase
    .from('iva_liquidaciones')
    .select('*')
    .eq('periodo', periodo)
    .single();

  // If saved and closed, we strictly return the frozen values
  if (savedLiq && savedLiq.cerrado) {
    return {
      success: true,
      liquidado: true,
      data: savedLiq
    }
  }

  // 2. Fetch all comprobantes for this month dynamically
  const startDate = `${periodo}-01`;
  // Get last day of month
  const [year, month] = periodo.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${periodo}-${String(lastDay).padStart(2, '0')}`;

  const { data: comps, error: compsErr } = await supabase
    .from('afip_comprobantes')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  if (compsErr) {
    console.error("Error al buscar comprobantes:", compsErr);
    return { success: false, error: compsErr.message }
  }

  // Sum Débito and Crédito
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

  // Round values
  debito_fiscal_puro = Math.round(debito_fiscal_puro * 100) / 100;
  credito_fiscal_puro = Math.round(credito_fiscal_puro * 100) / 100;

  // 3. Fetch previous month's balances to carry over
  const prevPeriod = getPreviousPeriod(periodo);
  const { data: prevLiq } = await supabase
    .from('iva_liquidaciones')
    .select('saldo_tecnico_contribuyente_remanente, saldo_libre_disp_remanente')
    .eq('periodo', prevPeriod)
    .single();

  const saldo_tecnico_anterior_trasladado = prevLiq?.saldo_tecnico_contribuyente_remanente || savedLiq?.saldo_anterior_manual || 0;
  const saldo_libre_disp_anterior_trasladado = prevLiq?.saldo_libre_disp_remanente || savedLiq?.saldo_libre_disp_anterior_trasladado || 0;
  const retenciones_percepciones_del_mes = savedLiq?.retenciones_percepciones_del_mes || 0;
  const saldo_anterior_manual = savedLiq?.saldo_anterior_manual || 0;

  // 4. Run the Double Paragraph tax algorithm
  // Capa 1: Saldo Técnico
  const resultadoTecnico = debito_fiscal_puro - credito_fiscal_puro - saldo_tecnico_anterior_trasladado;
  
  let saldo_tecnico_contribuyente_remanente = 0;
  let saldo_tecnico_fisco = 0;

  if (resultadoTecnico < 0) {
    saldo_tecnico_contribuyente_remanente = Math.abs(resultadoTecnico);
    saldo_tecnico_fisco = 0;
  } else {
    saldo_tecnico_contribuyente_remanente = 0;
    saldo_tecnico_fisco = resultadoTecnico;
  }

  // Capa 2: Libre Disponibilidad
  let saldo_libre_disp_remanente = 0;
  let saldo_a_pagar = 0;

  if (saldo_tecnico_fisco > 0) {
    const posicionFinal = saldo_tecnico_fisco - saldo_libre_disp_anterior_trasladado - retenciones_percepciones_del_mes;
    if (posicionFinal < 0) {
      saldo_libre_disp_remanente = Math.abs(posicionFinal);
      saldo_a_pagar = 0;
    } else {
      saldo_libre_disp_remanente = 0;
      saldo_a_pagar = posicionFinal;
    }
  } else {
    // If saldo_tecnico_fisco is 0, Capa 1 resulted in a carryover.
    // Therefore we pay 0, and any retenciones + prev libre disp simply accumulate for the taxpayer
    saldo_a_pagar = 0;
    saldo_libre_disp_remanente = saldo_libre_disp_anterior_trasladado + retenciones_percepciones_del_mes;
  }

  return {
    success: true,
    liquidado: false,
    counts: { emitidos: countEmitidos, recibidos: countRecibidos },
    data: {
      periodo,
      debito_fiscal_puro,
      credito_fiscal_puro,
      saldo_tecnico_anterior_trasladado,
      saldo_tecnico_fisco,
      saldo_tecnico_contribuyente_remanente,
      saldo_libre_disp_anterior_trasladado,
      retenciones_percepciones_del_mes,
      saldo_libre_disp_remanente,
      saldo_a_pagar,
      saldo_anterior_manual,
      cerrado: false,
      pagado: savedLiq?.pagado || false,
      fecha_pago: savedLiq?.fecha_pago || null
    }
  }
}

// Save or Close the monthly IVA liquidation
export async function closeIVALiquidation(
  periodo: string, 
  retenciones: number, 
  saldoManualAnterior: number, 
  saldoLibreDispAnteriorManual: number = 0,
  cerrar: boolean = true
) {
  // Fetch dynamic balances based on comprobantes to secure precision
  const balanceRes = await getIVABalance(periodo);
  if (!balanceRes.success || !balanceRes.data) {
    return { success: false, error: balanceRes.error || "No se pudo calcular la liquidación." }
  }

  const { debito_fiscal_puro, credito_fiscal_puro } = balanceRes.data;

  // Retrieve prev month's values to verify carryovers
  const prevPeriod = getPreviousPeriod(periodo);
  const { data: prevLiq } = await supabase
    .from('iva_liquidaciones')
    .select('saldo_tecnico_contribuyente_remanente, saldo_libre_disp_remanente')
    .eq('periodo', prevPeriod)
    .single();

  // If previous month exists, use its remanentes. Otherwise, use manual inputs.
  const saldo_tecnico_anterior_trasladado = prevLiq 
    ? prevLiq.saldo_tecnico_contribuyente_remanente 
    : saldoManualAnterior;

  const saldo_libre_disp_anterior_trasladado = prevLiq 
    ? prevLiq.saldo_libre_disp_remanente 
    : saldoLibreDispAnteriorManual;

  // Run the Double Paragraph calculations
  // Capa 1: Saldo Técnico
  const resultadoTecnico = debito_fiscal_puro - credito_fiscal_puro - saldo_tecnico_anterior_trasladado;
  
  let saldo_tecnico_contribuyente_remanente = 0;
  let saldo_tecnico_fisco = 0;

  if (resultadoTecnico < 0) {
    saldo_tecnico_contribuyente_remanente = Math.abs(resultadoTecnico);
    saldo_tecnico_fisco = 0;
  } else {
    saldo_tecnico_contribuyente_remanente = 0;
    saldo_tecnico_fisco = resultadoTecnico;
  }

  // Capa 2: Libre Disponibilidad
  let saldo_libre_disp_remanente = 0;
  let saldo_a_pagar = 0;

  if (saldo_tecnico_fisco > 0) {
    const posicionFinal = saldo_tecnico_fisco - saldo_libre_disp_anterior_trasladado - retenciones;
    if (posicionFinal < 0) {
      saldo_libre_disp_remanente = Math.abs(posicionFinal);
      saldo_a_pagar = 0;
    } else {
      saldo_libre_disp_remanente = 0;
      saldo_a_pagar = posicionFinal;
    }
  } else {
    saldo_a_pagar = 0;
    saldo_libre_disp_remanente = saldo_libre_disp_anterior_trasladado + retenciones;
  }

  // Upsert the liquidation record
  const payload = {
    periodo,
    debito_fiscal_puro,
    credito_fiscal_puro,
    saldo_tecnico_anterior_trasladado,
    saldo_tecnico_fisco,
    saldo_tecnico_contribuyente_remanente,
    saldo_libre_disp_anterior_trasladado,
    retenciones_percepciones_del_mes: retenciones,
    saldo_libre_disp_remanente,
    saldo_a_pagar,
    saldo_anterior_manual: saldoManualAnterior,
    cerrado: cerrar,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('iva_liquidaciones')
    .upsert(payload, { onConflict: 'periodo' })
    .select();

  if (error) {
    console.error("Error al guardar liquidación de IVA:", error);
    return { success: false, error: error.message }
  }

  revalidatePath('/finanzas/iva');
  return { 
    success: true, 
    message: cerrar ? "Liquidación de IVA cerrada y bloqueada con éxito." : "Valores guardados como borrador.",
    data: data?.[0]
  }
}

// Unlock / Reopen a closed month
export async function reopenIVALiquidation(periodo: string) {
  const { data, error } = await supabase
    .from('iva_liquidaciones')
    .update({ cerrado: false })
    .eq('periodo', periodo)
    .select();

  if (error) {
    console.error("Error al reabrir liquidación:", error);
    return { success: false, error: error.message }
  }

  revalidatePath('/finanzas/iva');
  return { success: true, message: "La liquidación ha sido reabierta. Ya puedes subir más archivos.", data: data?.[0] }
}

// Track payment status for closed periods
export async function updateIVAPayment(periodo: string, pagado: boolean, fecha_pago: string | null) {
  const { data, error } = await supabase
    .from('iva_liquidaciones')
    .update({ pagado, fecha_pago })
    .eq('periodo', periodo)
    .select();

  if (error) {
    console.error("Error al registrar pago de IVA:", error);
    return { success: false, error: error.message }
  }

  revalidatePath('/finanzas/iva');
  return { success: true, message: pagado ? "Pago de IVA registrado con éxito." : "Pago desmarcado.", data: data?.[0] }
}

// Wipe out all invoices for a specific month (allows user to start over if they made mistakes)
export async function clearComprobantesPeriodo(periodo: string) {
  // Check if period is closed first
  const { data: liq } = await supabase
    .from('iva_liquidaciones')
    .select('cerrado')
    .eq('periodo', periodo)
    .single();

  if (liq && liq.cerrado) {
    return { success: false, error: "No se pueden borrar los comprobantes de un período cerrado. Por favor, reabre la liquidación primero." }
  }

  const startDate = `${periodo}-01`;
  const [year, month] = periodo.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${periodo}-${String(lastDay).padStart(2, '0')}`;

  const { error } = await supabase
    .from('afip_comprobantes')
    .delete()
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  if (error) {
    console.error("Error al vaciar comprobantes:", error);
    return { success: false, error: error.message }
  }

  revalidatePath('/finanzas/iva');
  return { success: true, message: "Todos los comprobantes del mes seleccionado han sido eliminados. Puedes volver a importar tus planillas." }
}

// Fetch paginated or filtered list of comprobantes for the month
export async function getComprobantesPeriodo(periodo: string, search: string = "", flujo: "todo" | "emitido" | "recibido" = "todo") {
  const startDate = `${periodo}-01`;
  const [year, month] = periodo.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${periodo}-${String(lastDay).padStart(2, '0')}`;

  let query = supabase
    .from('afip_comprobantes')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: false });

  if (flujo !== 'todo') {
    query = query.eq('tipo_flujo', flujo);
  }

  if (search) {
    query = query.or(`cuit_contraparte.ilike.%${search}%,denominacion_contraparte.ilike.%${search}%,tipo_comprobante.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error al buscar listado de comprobantes:", error);
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

// Delete an individual invoice
export async function deleteComprobante(id: string, periodo: string) {
  // Check if period is closed first
  const { data: liq } = await supabase
    .from('iva_liquidaciones')
    .select('cerrado')
    .eq('periodo', periodo)
    .single();

  if (liq && liq.cerrado) {
    return { success: false, error: "No se puede eliminar un comprobante de un período cerrado." }
  }

  const { error } = await supabase
    .from('afip_comprobantes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error al borrar comprobante:", error);
    return { success: false, error: error.message }
  }

  revalidatePath('/finanzas/iva');
  return { success: true, message: "Comprobante eliminado con éxito." }
}

// Server Action to reconcile multiple Remitos with a single AFIP Invoice
export async function conciliarRemitosConFactura(poIds: string[], afipComprobanteId: string, desvioInflacion: number) {
  try {
    const supabaseServer = createServerClient()
    // 1. Update all purchase orders to point to the AFIP invoice and mark them as facturado
    const { error: poErr } = await supabaseServer
      .from('purchase_orders')
      .update({
        facturado: true,
        afip_comprobante_id: afipComprobanteId,
        desvio_inflacion: 0
      })
      .in('id', poIds)

    if (poErr) throw poErr

    // 2. Impute the inflation deviation (price adjustment) to the first PO
    if (poIds.length > 0 && desvioInflacion !== 0) {
      const { error: desvioErr } = await supabaseServer
        .from('purchase_orders')
        .update({ desvio_inflacion: desvioInflacion })
        .eq('id', poIds[0])
        
      if (desvioErr) throw desvioErr
    }

    revalidatePath('/finanzas/iva')
    revalidatePath('/inventario/ordenes-compra')
    
    return { success: true, message: "Remitos conciliados con la Factura de AFIP correctamente." }
  } catch (err: any) {
    console.error("Error conciliarRemitosConFactura:", err)
    return { success: false, error: err.message || "Error al conciliar remitos" }
  }
}

// Server Action to fetch all received stock orders that entered via Remito and are not yet linked to an official Invoice
export async function getRemitosPendientes() {
  try {
    const supabaseServer = createServerClient()
    const { data, error } = await supabaseServer
      .from('purchase_orders')
      .select(`
        *,
        proveedores(id, nombre)
      `)
      .eq('tipo_documento', 'remito')
      .eq('facturado', false)
      .eq('estado', 'RECIBIDA')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error("Error getRemitosPendientes:", err)
    return { success: false, error: err.message || "Error al obtener remitos pendientes", data: [] }
  }
}

