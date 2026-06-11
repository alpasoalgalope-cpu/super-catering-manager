"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

function composeValidDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toISOString().split('T')[0];
}

function parseFlexibleDate(raw: any, rawMonth?: string): string {
  if (!raw) throw new Error("Fecha vacía");
  
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0];
  }
  
  // Normalizar números y cadenas que contienen solo dígitos (como "44927" o "15")
  let numVal = NaN;
  if (typeof raw === 'number') {
    numVal = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    numVal = Number(raw.trim());
  }

  if (!isNaN(numVal)) {
    if (numVal > 31) {
      // Es un número de serie de Excel (ej: 44927)
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + numVal * 86400000);
      return date.toISOString().split('T')[0];
    } else if (numVal >= 1 && numVal <= 31) {
      // Es solo el día del mes (ej: 15). Intentar obtener el mes del campo rawMonth, sino usar actual
      let month = new Date().getMonth() + 1;
      let year = new Date().getFullYear();
      if (rawMonth) {
        const cleanMonth = String(rawMonth).trim();
        const parts = cleanMonth.split('.');
        const parsedMonth = parseInt(parts[0], 10);
        if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
          month = parsedMonth;
        }
      }
      return composeValidDate(year, month, numVal);
    }
  }
  
  let str = String(raw).trim().toLowerCase();
  
  // Si contiene espacio (como fecha y hora), separar y quedarse con la fecha
  if (str.includes(' ')) {
    str = str.split(/\s+/)[0];
  }
  
  // Try to match standard YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    return composeValidDate(Number(yyyymmdd[1]), Number(yyyymmdd[2]), Number(yyyymmdd[3]));
  }
  
  // Try to match DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const yr = ddmmyyyy[3];
    const part1 = Number(ddmmyyyy[1]);
    const part2 = Number(ddmmyyyy[2]);
    let day = part1;
    let month = part2;
    if (part2 > 12 && part1 <= 12) {
      day = part2;
      month = part1;
    }
    return composeValidDate(Number(yr), month, day);
  }

  // Try to match DD-MM-YY or DD/MM/YY
  const ddmmyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (ddmmyy) {
    const yr = Number(ddmmyy[3]);
    const fullYear = yr < 50 ? 2000 + yr : 1900 + yr;
    const part1 = Number(ddmmyy[1]);
    const part2 = Number(ddmmyy[2]);
    let day = part1;
    let month = part2;
    if (part2 > 12 && part1 <= 12) {
      day = part2;
      month = part1;
    }
    return composeValidDate(fullYear, month, day);
  }

  // Try to match DD-MM or DD/MM (assume current year)
  const ddmm = str.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (ddmm) {
    const currentYear = new Date().getFullYear();
    const part1 = Number(ddmm[1]);
    const part2 = Number(ddmm[2]);
    let day = part1;
    let month = part2;
    if (part2 > 12 && part1 <= 12) {
      day = part2;
      month = part1;
    }
    return composeValidDate(currentYear, month, day);
  }

  // Try to parse short months like "2-jan", "2-ene", "jan-2", "ene-2"
  const monthsMap: Record<string, number> = {
    ene: 1, enero: 1, jan: 1, january: 1,
    feb: 2, febrero: 2, february: 2,
    mar: 3, marzo: 3, march: 3,
    abr: 4, abril: 4, apr: 4, april: 4,
    may: 5, mayo: 5,
    jun: 6, junio: 6, june: 6,
    jul: 7, julio: 7, july: 7,
    ago: 8, agosto: 8, aug: 8, august: 8,
    sep: 9, septiembre: 9, sept: 9, september: 9,
    oct: 10, octubre: 10, october: 10,
    nov: 11, noviembre: 11, november: 11,
    dic: 12, diciembre: 12, dec: 12, december: 12
  };

  const parts = str.split(/[^a-z0-9]+/);
  if (parts.length >= 2) {
    let day = 0;
    let month = 0;
    let year = new Date().getFullYear();

    let foundMonthIndex = -1;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (monthsMap[p]) {
        foundMonthIndex = i;
        month = monthsMap[p];
        break;
      }
    }

    if (foundMonthIndex !== -1) {
      const otherParts = parts.filter((_, idx) => idx !== foundMonthIndex);
      const num1 = otherParts.length >= 1 ? Number(otherParts[0]) : NaN;

      if (!isNaN(num1)) {
        day = num1;
      }

      if (otherParts.length >= 2) {
        const num2 = Number(otherParts[1]);
        if (!isNaN(num2)) {
          if (num2 > 31) {
            year = num2 < 100 ? (num2 < 50 ? 2000 + num2 : 1900 + num2) : num2;
          } else {
            day = num2;
            year = num1 < 100 ? (num1 < 50 ? 2000 + num1 : 1900 + num1) : num1;
          }
        }
      }
      
      if (day > 0 && month > 0) {
        return composeValidDate(year, month, day);
      }
    }
  }

  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }

  throw new Error(`Formato de fecha inválido: "${raw}"`);
}

// Helper to parse cash amounts (handles commas and dots under any locale configuration)
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
      // Single dot. In exports, numbers typically have 2 decimal places. 
      // If the decimal part is exactly 3 digits (e.g. ".200" or ".000"), it's a thousands separator.
      // Otherwise, it is a decimal separator.
      const parts = str.split('.');
      const decimalPart = parts[1];
      if (decimalPart && decimalPart.length === 3) {
        str = str.replace(/\./g, '');
      }
    }
  }
  
  const num = Number(str.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function getMonthNameFormatted(dateStr: string) {
  const date = new Date(dateStr + 'T12:00:00')
  const monthNum = date.getMonth() + 1
  const monthStr = monthNum.toString().padStart(2, '0')
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  return `${monthStr}. ${monthNames[monthNum - 1]}`
}

function getWeekNumber(dateStr: string) {
  const date = new Date(dateStr + 'T12:00:00')
  const day = date.getDate()
  if (day <= 7) return "1"
  if (day <= 14) return "2"
  if (day <= 21) return "3"
  return "4"
}

export async function importCashMovements(rows: any[]) {
  if (!rows || rows.length === 0) return { success: false, error: "No hay filas para importar." }

  console.log(`[IMPORT] Iniciando importación de ${rows.length} filas.`);
  const movementsToInsert = []
  const occurrenceTracker: Record<string, number> = {}
  const monthsToClear = new Set<string>()
  
  let skippedEmptyDate = 0
  let skippedParseError = 0
  
  // Mapeos de candidatos
  const FECHA_CANDS = ['fecha', 'fec', 'fec.', 'fec comp', 'fec. comp.', 'fec_comp', 'fecha comp'];
  const IMPORTE_CANDS = ['importe', 'monto', 'total', 'imp', 'imp.'];
  const TURNO_CANDS = ['turno'];
  const TIPO_CANDS = ['tipo'];
  const CONCEPTO_CANDS = ['concepto'];
  const COD_CGA_CANDS = ['cod_cga', 'cod cga', 'cga'];
  const CONC_CAJA_CANDS = ['conc_caja', 'conc caja', 'concepto caja'];
  const DETALLE_CANDS = ['detalle', 'descripcion', 'desc'];
  const ESRECU_CANDS = ['esrecu'];
  const OCULTA_CANDS = ['oculta'];
  const RUBRO_CANDS = ['rubro'];

  for (const row of rows) {
    const normalizedRow: any = {}
    Object.keys(row).forEach(k => {
      normalizedRow[k.toLowerCase().trim()] = row[k]
    })

    const getVal = (candidates: string[], defaultVal = '') => {
      for (const cand of candidates) {
        const normCand = cand.toLowerCase().trim();
        if (normalizedRow[normCand] !== undefined && normalizedRow[normCand] !== null) {
          return normalizedRow[normCand];
        }
      }
      return defaultVal;
    }

    let rawDate = getVal(FECHA_CANDS);
    if (!rawDate) {
      skippedEmptyDate++
      continue
    }

    const rawMes = normalizedRow.mes ? String(normalizedRow.mes).trim() : ""

    let parsedDateStr = ""
    try {
      parsedDateStr = parseFlexibleDate(rawDate, rawMes)
    } catch (e: any) {
      skippedParseError++
      console.warn(`[IMPORT] Error de parseo de fecha en fila:`, row, `Detalle:`, e.message)
      continue 
    }

    const rawImporte = getVal(IMPORTE_CANDS, '0');
    const importe = parseAFIPNumber(rawImporte)

    const turno = String(getVal(TURNO_CANDS)).trim()
    const tipo = String(getVal(TIPO_CANDS)).trim()
    const concepto = String(getVal(CONCEPTO_CANDS)).trim()
    const cod_cga = String(getVal(COD_CGA_CANDS)).trim()
    const conc_caja = String(getVal(CONC_CAJA_CANDS)).trim()
    const detalle = String(getVal(DETALLE_CANDS)).trim()
    const esrecu = String(getVal(ESRECU_CANDS)).trim()
    const oculta = String(getVal(OCULTA_CANDS)).trim()
    const rubro = String(getVal(RUBRO_CANDS)).trim()

    // Computeds based on rules
    const sucursal = "Galope Bustamante"
    
    // Process mes
    let mes = ""
    if (rawMes) {
      if (/^\d{2}\./.test(rawMes)) {
        mes = rawMes
      } else {
        const lowerMes = rawMes.toLowerCase()
        const monthsNamesMap: Record<string, string> = {
          enero: "01. Enero", ene: "01. Enero",
          febrero: "02. Febrero", feb: "02. Febrero",
          marzo: "03. Marzo", mar: "03. Marzo",
          abril: "04. Abril", abr: "04. Abril",
          mayo: "05. Mayo", may: "05. Mayo",
          junio: "06. Junio", jun: "06. Junio",
          julio: "07. Julio", jul: "07. Julio",
          agosto: "08. Agosto", ago: "08. Agosto",
          septiembre: "09. Septiembre", sep: "09. Septiembre",
          octubre: "10. Octubre", oct: "10. Octubre",
          noviembre: "11. Noviembre", nov: "11. Noviembre",
          diciembre: "12. Diciembre", dic: "12. Diciembre"
        }
        mes = monthsNamesMap[lowerMes] || rawMes
      }
    } else {
      mes = getMonthNameFormatted(parsedDateStr)
    }

    if (mes) monthsToClear.add(mes)

    const semana = getWeekNumber(parsedDateStr)

    const baseKey = `${parsedDateStr}|${turno}|${tipo}|${concepto}|${importe}|${detalle}`
    
    occurrenceTracker[baseKey] = (occurrenceTracker[baseKey] || 0) + 1
    const occurrenceIndex = occurrenceTracker[baseKey]

    const hashInput = `${baseKey}|${occurrenceIndex}`
    const hash_id = crypto.createHash('md5').update(hashInput).digest('hex')

    movementsToInsert.push({
      sucursal,
      mes,
      fecha: parsedDateStr,
      semana,
      turno,
      tipo,
      concepto,
      cod_cga,
      conc_caja,
      detalle,
      importe,
      esrecu,
      oculta,
      rubro,
      hash_id
    })
  }

  console.log(`[IMPORT] Filas con fecha vacía: ${skippedEmptyDate}`);
  console.log(`[IMPORT] Filas con error de fecha: ${skippedParseError}`);
  console.log(`[IMPORT] Movimientos mapeados: ${movementsToInsert.length}`);
  
  // Limpieza inteligente previa a la inserción para evitar duplicados y respetar cargas manuales
  if (monthsToClear.size > 0) {
    const monthsArray = Array.from(monthsToClear)
    console.log(`[IMPORT] Limpiando movimientos previos no manuales para los meses:`, monthsArray)
    const { error: delErr } = await supabase
      .from('cash_movements')
      .delete()
      .in('mes', monthsArray)
      .neq('esrecu', 'manual') // Resguardar cargas manuales SCM

    if (delErr) {
      console.error("[IMPORT] Error clearing old movements:", delErr)
      return { success: false, error: "Error al limpiar movimientos anteriores: " + delErr.message }
    }
  }

  let insertedCount = 0;
  let duplicatedCount = 0;

  if (movementsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('cash_movements')
      .upsert(movementsToInsert, { onConflict: 'hash_id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error("Import error:", error)
      return { success: false, error: error.message }
    }
    
    insertedCount = data?.length || 0;
    duplicatedCount = movementsToInsert.length - insertedCount;
  }

  revalidatePath('/finanzas')
  
  return { 
    success: true, 
    message: `Planilla analizada: ${rows.length} filas. ` +
             `Importadas: ${insertedCount} movimientos nuevos. ` +
             `Ignoradas por duplicación: ${duplicatedCount} filas. ` +
             `Omitidas por fecha vacía: ${skippedEmptyDate}. ` +
             `Omitidas por error de fecha: ${skippedParseError}.`
  }
}

export async function createCashMovement(payload: {
  fecha: string;
  tipo: string;
  concept_id: string;
  concepto: string;
  subconcept_id: string;
  conc_caja: string;
  detalle: string;
  importe: number;
  turno?: string;
  cuenta_bancaria?: string;
}) {
  try {
    const { fecha, tipo, concept_id, concepto, subconcept_id, conc_caja, detalle, importe, turno, cuenta_bancaria } = payload;
    
    if (!fecha || !tipo || !concept_id || !concepto || !subconcept_id || !conc_caja || !importe) {
      return { success: false, error: "Todos los campos obligatorios deben estar completos." };
    }

    const mes = getMonthNameFormatted(fecha);
    const weekNum = getWeekNumber(fecha);
    
    // Si es un egreso, el importe debe ser negativo
    const finalImporte = tipo === "Egreso" ? -Math.abs(importe) : Math.abs(importe);
    
    const hashInput = `manual|${fecha}|${concept_id}|${subconcept_id}|${finalImporte}|${crypto.randomUUID()}`;
    const hash_id = crypto.createHash('md5').update(hashInput).digest('hex');

    const { data, error } = await supabase
      .from('cash_movements')
      .insert({
        sucursal: "Galope Bustamante",
        mes,
        fecha,
        semana: weekNum,
        turno: turno || "Sin Turno",
        tipo,
        concepto,
        concept_id,
        conc_caja,
        subconcept_id,
        detalle,
        importe: finalImporte,
        esrecu: "manual",
        oculta: "no",
        rubro: concepto,
        cuenta_bancaria: cuenta_bancaria || "efectivo",
        hash_id
      })
      .select()

    if (error) {
      console.error("Error creating manual cash movement:", error);
      return { success: false, error: error.message };
    }

    revalidatePath('/finanzas');
    return { success: true, message: "Movimiento registrado correctamente." };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message };
  }
}

export async function createBulkCashMovements(payloads: {
  fecha: string;
  tipo: string;
  concept_id: string;
  concepto: string;
  subconcept_id: string;
  conc_caja: string;
  detalle: string;
  importe: number;
  turno?: string;
  cuenta_bancaria?: string;
}[]) {
  try {
    if (!payloads || payloads.length === 0) {
      return { success: false, error: "No hay movimientos para registrar." };
    }

    const movementsToInsert = []
    
    for (const p of payloads) {
      const { fecha, tipo, concept_id, concepto, subconcept_id, conc_caja, detalle, importe, turno, cuenta_bancaria } = p;
      
      if (!fecha || !tipo || !concept_id || !concepto || !subconcept_id || !conc_caja || !importe) {
        return { success: false, error: "Faltan campos obligatorios en uno o más movimientos." };
      }

      const mes = getMonthNameFormatted(fecha);
      const weekNum = getWeekNumber(fecha);
      
      const finalImporte = tipo === "Egreso" ? -Math.abs(importe) : Math.abs(importe);
      
      const hashInput = `manual|${fecha}|${concept_id}|${subconcept_id}|${finalImporte}|${crypto.randomUUID()}`;
      const hash_id = crypto.createHash('md5').update(hashInput).digest('hex');

      movementsToInsert.push({
        sucursal: "Galope Bustamante",
        mes,
        fecha,
        semana: weekNum,
        turno: turno || "Sin Turno",
        tipo,
        concepto,
        concept_id,
        conc_caja,
        subconcept_id,
        detalle,
        importe: finalImporte,
        esrecu: "manual",
        oculta: "no",
        rubro: concepto,
        cuenta_bancaria: cuenta_bancaria || "efectivo",
        hash_id
      });
    }

    const { data, error } = await supabase
      .from('cash_movements')
      .insert(movementsToInsert)
      .select('id');

    if (error) {
      console.error("Error creating bulk cash movements:", error);
      return { success: false, error: error.message };
    }

    revalidatePath('/finanzas');
    return { success: true, message: `${movementsToInsert.length} movimientos registrados correctamente.` };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message };
  }
}

export async function updateCashMovementAction(
  id: string,
  payload: {
    fecha: string;
    tipo: string;
    concept_id: string;
    concepto: string;
    subconcept_id: string;
    conc_caja: string;
    detalle: string;
    importe: number;
    turno?: string;
    cuenta_bancaria?: string;
  }
) {
  try {
    const { fecha, tipo, concept_id, concepto, subconcept_id, conc_caja, detalle, importe, turno, cuenta_bancaria } = payload;
    
    if (!id || !fecha || !tipo || !concept_id || !concepto || !subconcept_id || !conc_caja || !importe) {
      return { success: false, error: "Todos los campos obligatorios deben estar completos." };
    }

    const mes = getMonthNameFormatted(fecha);
    const weekNum = getWeekNumber(fecha);
    
    const finalImporte = tipo === "Egreso" ? -Math.abs(importe) : Math.abs(importe);

    const { data: existingMov, error: fetchError } = await supabase
      .from('cash_movements')
      .select('purchase_order_id, event_sales_header_id, vencimiento_servicio_id, vencimiento_impuesto_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingMov) {
      return { success: false, error: "No se encontró el movimiento a editar." };
    }

    const { error: updateError } = await supabase
      .from('cash_movements')
      .update({
        mes,
        fecha,
        semana: weekNum,
        turno: turno || "Sin Turno",
        tipo,
        concepto,
        concept_id,
        subconcept_id,
        conc_caja,
        detalle,
        importe: finalImporte,
        rubro: concepto,
        cuenta_bancaria: cuenta_bancaria || "efectivo"
      })
      .eq('id', id);

    if (updateError) {
      console.error("Error updating cash movement:", updateError);
      return { success: false, error: updateError.message };
    }

    if (existingMov.purchase_order_id) {
      const { data: allMovs } = await supabase
        .from('cash_movements')
        .select('importe')
        .eq('purchase_order_id', existingMov.purchase_order_id);

      const totalPagado = (allMovs || []).reduce((sum, m) => sum + Math.abs(m.importe), 0);

      const { data: po } = await supabase
        .from('purchase_orders')
        .select('costo_total')
        .eq('id', existingMov.purchase_order_id)
        .single();

      if (po) {
        const estadoPago = totalPagado >= po.costo_total
          ? 'pagado'
          : totalPagado > 0
            ? 'parcial'
            : 'pendiente';

        await supabase
          .from('purchase_orders')
          .update({
            monto_pagado: totalPagado,
            estado_pago: estadoPago
          })
          .eq('id', existingMov.purchase_order_id);
      }
    }

    if (existingMov.event_sales_header_id) {
      const { data: allMovs } = await supabase
        .from('cash_movements')
        .select('importe')
        .eq('event_sales_header_id', existingMov.event_sales_header_id);

      const totalCobrado = (allMovs || []).reduce((sum, m) => sum + Math.abs(m.importe), 0);

      const { data: sale } = await supabase
        .from('event_sales_headers')
        .select('total_amount')
        .eq('id', existingMov.event_sales_header_id)
        .single();

      if (sale) {
        const estadoCobro = totalCobrado >= sale.total_amount
          ? 'cobrado'
          : totalCobrado > 0
            ? 'parcial'
            : 'pendiente';

        await supabase
          .from('event_sales_headers')
          .update({
            monto_cobrado: totalCobrado,
            estado_cobro: estadoCobro
          })
          .eq('id', existingMov.event_sales_header_id);
      }
    }

    if (existingMov.vencimiento_servicio_id) {
      await supabase
        .from('vencimientos_servicios')
        .update({
          monto: Math.abs(finalImporte),
          fecha_pago: fecha
        })
        .eq('id', existingMov.vencimiento_servicio_id);
    }

    if (existingMov.vencimiento_impuesto_id) {
      await supabase
        .from('vencimientos_impuestos')
        .update({
          monto: Math.abs(finalImporte),
          fecha_pago: fecha
        })
        .eq('id', existingMov.vencimiento_impuesto_id);

      const { data: vImp } = await supabase
        .from('vencimientos_impuestos')
        .select('*, impuestos(nombre)')
        .eq('id', existingMov.vencimiento_impuesto_id)
        .single();

      if (vImp && (vImp.impuestos?.nombre === 'IVA' || vImp.impuestos?.nombre?.toLowerCase() === 'iva')) {
        await supabase
          .from('iva_liquidaciones')
          .update({ fecha_pago: fecha })
          .eq('periodo', vImp.mes_periodo);
      }
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/tesoreria');
    revalidatePath('/inventario/ordenes-compra');
    revalidatePath('/ventas-evento');
    return { success: true, message: "Movimiento actualizado correctamente." };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message };
  }
}

export async function deleteCashMovementAction(id: string) {
  try {
    if (!id) {
      return { success: false, error: "ID del movimiento no especificado." };
    }

    const { data: existingMov, error: fetchError } = await supabase
      .from('cash_movements')
      .select('purchase_order_id, event_sales_header_id, vencimiento_servicio_id, vencimiento_impuesto_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingMov) {
      return { success: false, error: "No se encontró el movimiento a eliminar." };
    }

    const { error: deleteError } = await supabase
      .from('cash_movements')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error("Error deleting cash movement:", deleteError);
      return { success: false, error: deleteError.message };
    }

    if (existingMov.purchase_order_id) {
      const { data: allMovs } = await supabase
        .from('cash_movements')
        .select('importe')
        .eq('purchase_order_id', existingMov.purchase_order_id);

      const totalPagado = (allMovs || []).reduce((sum, m) => sum + Math.abs(m.importe), 0);

      const { data: po } = await supabase
        .from('purchase_orders')
        .select('costo_total')
        .eq('id', existingMov.purchase_order_id)
        .single();

      if (po) {
        const estadoPago = totalPagado >= po.costo_total
          ? 'pagado'
          : totalPagado > 0
            ? 'parcial'
            : 'pendiente';

        await supabase
          .from('purchase_orders')
          .update({
            monto_pagado: totalPagado,
            estado_pago: estadoPago
          })
          .eq('id', existingMov.purchase_order_id);
      }
    }

    if (existingMov.event_sales_header_id) {
      const { data: allMovs } = await supabase
        .from('cash_movements')
        .select('importe')
        .eq('event_sales_header_id', existingMov.event_sales_header_id);

      const totalCobrado = (allMovs || []).reduce((sum, m) => sum + Math.abs(m.importe), 0);

      const { data: sale } = await supabase
        .from('event_sales_headers')
        .select('total_amount')
        .eq('id', existingMov.event_sales_header_id)
        .single();

      if (sale) {
        const estadoCobro = totalCobrado >= sale.total_amount
          ? 'cobrado'
          : totalCobrado > 0
            ? 'parcial'
            : 'pendiente';

        await supabase
          .from('event_sales_headers')
          .update({
            monto_cobrado: totalCobrado,
            estado_cobro: estadoCobro
          })
          .eq('id', existingMov.event_sales_header_id);
      }
    }

    if (existingMov.vencimiento_servicio_id) {
      await supabase
        .from('vencimientos_servicios')
        .update({
          estado_pago: 'pendiente',
          fecha_pago: null,
          cash_movement_id: null
        })
        .eq('id', existingMov.vencimiento_servicio_id);
    }

    if (existingMov.vencimiento_impuesto_id) {
      const { data: vImp } = await supabase
        .from('vencimientos_impuestos')
        .select('*, impuestos(nombre)')
        .eq('id', existingMov.vencimiento_impuesto_id)
        .single();

      await supabase
        .from('vencimientos_impuestos')
        .update({
          estado_pago: 'pendiente',
          fecha_pago: null,
          cash_movement_id: null
        })
        .eq('id', existingMov.vencimiento_impuesto_id);

      if (vImp && (vImp.impuestos?.nombre === 'IVA' || vImp.impuestos?.nombre?.toLowerCase() === 'iva')) {
        await supabase
          .from('iva_liquidaciones')
          .update({ pagado: false, fecha_pago: null })
          .eq('periodo', vImp.mes_periodo);
      }
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/tesoreria');
    revalidatePath('/inventario/ordenes-compra');
    revalidatePath('/ventas-evento');
    return { success: true, message: "Movimiento eliminado correctamente." };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message };
  }
}
