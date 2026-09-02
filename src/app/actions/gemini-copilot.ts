"use server"

import { generateContentWithFallback, isGeminiConfigured } from "@/lib/gemini"
import { supabase } from "@/lib/supabase"

/**
 * 1. ASISTENTE DE "BRIEFING OPERATIVO SEMANAL" (Minuta Semanal para WhatsApp)
 */
export async function generateWeeklyBriefingAction(shows: any[]): Promise<{
  success: boolean
  data?: {
    summary: string
    whatsappText: string
    criticalIngredients: { name: string; quantity: string; unit: string; category: string }[]
    overlapAlerts: string[]
    miseEnPlaceSchedule: { day: string; tasks: string[] }[]
  }
  error?: string
}> {
  try {
    if (!isGeminiConfigured()) {
      return {
        success: false,
        error: "GEMINI_API_KEY no configurada. Agregala en .env.local o en Netlify para habilitar la IA."
      }
    }

    if (!shows || shows.length === 0) {
      return {
        success: false,
        error: "No hay eventos seleccionados para esta semana."
      }
    }

    const { data: recipes } = await supabase
      .from('recetas')
      .select('nombre, descripcion, receta_ingredientes(cantidad, unidad_medida, productos(nombre, familias(nombre)))')

    const totalPax = shows.reduce((acc, s) => acc + (Number(s.projected) || 0), 0)

    const prompt = `
Sos el Jefe Ejecutivo de Operaciones y Maestro de Producción de "Super Catering Management System".
Generá la MINUTA Y BRIEFING OPERATIVO SEMANAL para el equipo de producción y cocina.

Datos de los Shows de esta semana:
Total PAX Estimado / Ajustado: ${totalPax}
Shows programados:
${shows.map(s => `- Evento: ${s.show} | Fecha: ${s.date} | Sede/Venue: ${s.venue} | PAX: ${s.projected} | Empresas: ${(s.projections || []).map((p: any) => `${p.company} (${p.pax}→${p.adjusted})`).join(', ') || 'General'}`).join('\n')}

Catálogo de Recetas Base disponibles:
${JSON.stringify((recipes || []).slice(0, 5), null, 2)}

Tu objetivo:
1. Calcular el total consolidado de insumos críticos necesarios para cubrir todos los shows (panes Ciabatta, fiambres en Kg, quesos en Kg, verduras, aderezos, aguas minerales, opciones celíacas / veganas).
2. Detectar y listar alertas de solapamiento de fechas, horarios y requerimientos operativos críticos.
3. Crear un cronograma de Mise en Place sugerido día por día.
4. Generar un mensaje formateado para WhatsApp con emojis, negritas y estructura lista para copiar y enviar.

Respondé EXCLUSIVAMENTE con un JSON estructurado (sin markdown):
{
  "summary": "Resumen ejecutivo en 2-3 párrafos explicando la carga operativa de la semana.",
  "whatsappText": "Mensaje completo optimizado para WhatsApp con emojis (*negritas*, viñetas, etc.).",
  "criticalIngredients": [
    { "name": "Pan Ciabatta Artesanal", "quantity": "110", "unit": "unidades", "category": "Panificados" }
  ],
  "overlapAlerts": [
    "Alerta 1: ..."
  ],
  "miseEnPlaceSchedule": [
    { "day": "Miércoles (D-1)", "tasks": ["Corte de 15kg de Jamón Cocido", "Lavado y sanitizado de lechuga"] }
  ]
}
`

    const result = await generateContentWithFallback(prompt, { responseMimeType: "application/json" })
    const parsed = JSON.parse(result.text)
    return { success: true, data: parsed }
  } catch (err: any) {
    console.error("Error generateWeeklyBriefingAction:", err)
    return { success: false, error: err.message || "Error al comunicarse con Gemini AI" }
  }
}

/**
 * 2. CONTROL PREDICTIVO DE STOCK VS DEMANDA SEMANAL
 */
export async function predictSupplierShortagesAction(shows: any[], incomingPOs: any[]): Promise<{
  success: boolean
  data?: {
    status: 'OPTIMO' | 'ALERTA' | 'CRITICO'
    diagnosis: string
    shortages: { item: string; needed: string; arriving: string; diff: string; severity: 'ALTA' | 'MEDIA' | 'BAJA' }[]
    recommendedActions: string[]
  }
  error?: string
}> {
  try {
    if (!isGeminiConfigured()) {
      return { success: false, error: "GEMINI_API_KEY no configurada." }
    }

    const prompt = `
Sos el Auditor de Compras y Logística de Super Catering Manager.
Realizá un cruce predictivo entre la demanda de los shows de esta semana y la mercadería programada a recibir de proveedores.

Shows de la semana (Demanda):
${JSON.stringify(shows.map(s => ({ show: s.show, date: s.date, pax: s.projected })), null, 2)}

Órdenes de compra programadas a recibir (Oferta/Stock entrante):
${JSON.stringify(incomingPOs.map(po => ({
  proveedor: po.proveedores?.nombre,
  fecha_esperada: po.fecha_esperada,
  items: po.purchase_order_items?.map((i: any) => ({
    nombre: i.productos?.nombre,
    cantidad: i.cantidad,
    unidad: i.productos?.unidad_medida
  }))
})), null, 2)}

Respondé EXCLUSIVAMENTE en formato JSON:
{
  "status": "OPTIMO" | "ALERTA" | "CRITICO",
  "diagnosis": "Diagnóstico claro y directo en 2 párrafos.",
  "shortages": [
    { "item": "Agua sin Gas 600cc", "needed": "110 un", "arriving": "80 un", "diff": "-30 un", "severity": "ALTA" }
  ],
  "recommendedActions": [
    "Emitir orden complementaria a Sparkling para el viernes...",
    "Revisar stock de servilletas en depósito central..."
  ]
}
`

    const result = await generateContentWithFallback(prompt, { responseMimeType: "application/json" })
    const parsed = JSON.parse(result.text)
    return { success: true, data: parsed }
  } catch (err: any) {
    console.error("Error predictSupplierShortagesAction:", err)
    return { success: false, error: err.message || "Error al analizar faltantes" }
  }
}

/**
 * 3. ESCANEO OCR DE REMITOS EN FOTO CON GEMINI VISION
 */
export async function scanRemitoOCRAction(base64Image: string, mimeType: string = "image/jpeg"): Promise<{
  success: boolean
  data?: {
    nro_comprobante: string
    proveedor_detectado: string
    fecha_emision: string
    items: {
      descripcion: string
      cantidad: number
      bultos?: number
      unidad_medida?: string
      precio_unitario?: number
      precio_total?: number
    }[]
    observaciones: string
    confianza: number
  }
  error?: string
}> {
  try {
    if (!isGeminiConfigured()) {
      return { success: false, error: "GEMINI_API_KEY no configurada." }
    }

    const [{ data: suppliers }, { data: products }] = await Promise.all([
      supabase.from('proveedores').select('id, nombre'),
      supabase.from('productos').select('id, nombre, unidad_medida')
    ])

    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '')

    const prompt = `
Sos el módulo OCR de Visión Artificial de Super Catering Manager.
Analizá esta foto de un REMITO o FACTURA física de entrega de mercadería de un proveedor.

Proveedores conocidos en el sistema:
${(suppliers || []).map(s => s.nombre).join(', ')}

Productos del catálogo conocidos:
${(products || []).slice(0, 50).map(p => p.nombre).join(', ')}

Extraé con precisión número de comprobante, proveedor, fecha, listado de ítems y cantidades.
Respondé EXCLUSIVAMENTE con el siguiente JSON estructurado:
{
  "nro_comprobante": "0001-00045821",
  "proveedor_detectado": "Usepapel / Sparkling...",
  "fecha_emision": "2026-08-31",
  "items": [
    {
      "descripcion": "Caja Media Pizza",
      "cantidad": 100,
      "bultos": 2,
      "unidad_medida": "un",
      "precio_unitario": 225,
      "precio_total": 22500
    }
  ],
  "observaciones": "Mercadería entregada en buen estado con precinto.",
  "confianza": 95
}
`

    const result = await generateContentWithFallback([
      { text: prompt },
      {
        inline_data: {
          data: cleanBase64,
          mime_type: mimeType
        }
      }
    ])

    const jsonMatch = result.text.match(/\{([\s\S]*)\}/)
    if (!jsonMatch) throw new Error("No se pudo interpretar el resultado OCR de Gemini.")
    
    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, data: parsed }
  } catch (err: any) {
    console.error("Error scanRemitoOCRAction:", err)
    return { success: false, error: err.message || "Error al procesar la imagen del remito" }
  }
}

/**
 * 4. COPILOTO FINANCIERO / DIAGNÓSTICO DE DESVÍOS
 */
export async function generateFinancialDiagnosisAction(metrics: any, shows: any[]): Promise<{
  success: boolean
  data?: {
    healthStatus: 'SALUDABLE' | 'PRECAUCION' | 'DEFICIT'
    marginPct: number
    executiveSummary: string
    showAnalysis: {
      showName: string
      revenue: number
      costRatio: string
      status: 'VERDE' | 'AMARILLO' | 'ROJO'
      note: string
    }[]
    keyInsights: string[]
    optimizations: string[]
  }
  error?: string
}> {
  try {
    if (!isGeminiConfigured()) {
      return { success: false, error: "GEMINI_API_KEY no configurada." }
    }

    const prompt = `
Sos el Director Financiero (CFO) y Auditor de Rentabilidad de Super Catering Manager.
Analizá los números financieros de la semana:

Métricas Globales:
- Previsión de Ventas / Facturación: $${metrics.estimatedRevenue}
- Gastos a Ejecutar / Compras Insumos: $${metrics.gastosAEjecutar}
- Cantidad de Shows: ${metrics.eventCount}
- Clientes Activos: ${metrics.activeCompanies}

Shows individuales de la semana:
${JSON.stringify(shows.map(s => ({
  show: s.show,
  date: s.date,
  venue: s.venue,
  pax: s.projected,
  facturacion: s.revenue
})), null, 2)}

Respondé EXCLUSIVAMENTE con el siguiente JSON estructurado:
{
  "healthStatus": "SALUDABLE" | "PRECAUCION" | "DEFICIT",
  "marginPct": 38.5,
  "executiveSummary": "Texto ejecutivo...",
  "showAnalysis": [
    {
      "showName": "Maroon 5",
      "revenue": 1800000,
      "costRatio": "32% sobre venta",
      "status": "VERDE",
      "note": "Excelente absorción de costos fijos."
    }
  ],
  "keyInsights": ["Insight 1", "Insight 2"],
  "optimizations": ["Optimización 1", "Optimización 2"]
}
`

    const result = await generateContentWithFallback(prompt, { responseMimeType: "application/json" })
    const parsed = JSON.parse(result.text)
    return { success: true, data: parsed }
  } catch (err: any) {
    console.error("Error generateFinancialDiagnosisAction:", err)
    return { success: false, error: err.message || "Error al calcular diagnóstico financiero" }
  }
}

/**
 * 5. PLAN DE PRODUCCIÓN REGRESIVO POR SHOW INDIVIDUAL (D-2, D-1, Día D)
 */
export async function generateEventProductionPlanAction(show: any): Promise<{
  success: boolean
  data?: {
    showTitle: string
    totalPax: number
    executiveNotes: string
    timeline: {
      phase: string
      title: string
      timeframe: string
      activities: string[]
    }[]
    kitchenWhatsappMessage: string
  }
  error?: string
}> {
  try {
    if (!isGeminiConfigured()) {
      return { success: false, error: "GEMINI_API_KEY no configurada." }
    }

    const prompt = `
Sos el Jefe de Cocina y Producción de Super Catering Manager.
Armá la Hoja de Ruta Regresiva y el Plan de Producción para este show específico:

Evento: ${show.show}
Fecha: ${show.date}
Sede / Venue: ${show.venue}
PAX Ajustado a Producir: ${show.projected}
Empresas asignadas: ${(show.projections || []).map((p: any) => `${p.company} (${p.adjusted} viandas)`).join(', ')}

Respondé EXCLUSIVAMENTE con el siguiente JSON estructurado:
{
  "showTitle": "${show.show}",
  "totalPax": ${show.projected},
  "executiveNotes": "Instrucciones generales de calidad e inocuidad alimentaria.",
  "timeline": [
    {
      "phase": "D-2",
      "title": "Alistamiento y Recepción de Secos",
      "timeframe": "48 hs previas",
      "activities": [
        "Recepción de aguas minerales y descartables...",
        "Verificación de stock de aderezos..."
      ]
    },
    {
      "phase": "D-1",
      "title": "Mise en Place y Pre-elaboración",
      "timeframe": "24 hs previas",
      "activities": [
        "Feteado de fiambre y queso...",
        "Sanitizado de vegetales..."
      ]
    },
    {
      "phase": "Día D",
      "title": "Producción Final y Despacho",
      "timeframe": "Día del evento",
      "activities": [
        "Corte de pan Ciabatta fresco...",
        "Armado en línea de sándwiches y empaque...",
        "Almacenamiento en conservadoras térmicas a < 5°C..."
      ]
    }
  ],
  "kitchenWhatsappMessage": "Mensaje completo formateado para WhatsApp con emojis..."
}
`

    const result = await generateContentWithFallback(prompt, { responseMimeType: "application/json" })
    const parsed = JSON.parse(result.text)
    return { success: true, data: parsed }
  } catch (err: any) {
    console.error("Error generateEventProductionPlanAction:", err)
    return { success: false, error: err.message || "Error al generar plan de producción" }
  }
}
