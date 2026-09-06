import { GoogleGenerativeAI } from '@google/generative-ai'

export interface InvoiceItemExtracted {
  descripcion: string
  cantidad: number
  unidad?: string
  precio_unitario: number
  alicuota_iva?: number
  subtotal: number
}

export interface InvoiceExtractedData {
  proveedor_razon_social: string
  proveedor_cuit: string
  tipo_comprobante: string
  punto_venta: string
  numero_comprobante: string
  fecha_emision: string
  items: InvoiceItemExtracted[]
  neto_gravado: number
  iva_21: number
  iva_10_5: number
  percepciones_otros: number
  total: number
  observaciones?: string
}

export async function processInvoiceWithGeminiOCR(
  imageBuffer: Buffer,
  mimeType: string
): Promise<InvoiceExtractedData> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada en .env.local')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `
Eres un sistema experto de OCR y procesamiento de comprobantes contables y facturas comerciales (Argentina).
Analiza la siguiente imagen o documento de factura, remito o ticket y extrae todos los datos de forma estructurada.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin formato markdown ni texto adicional) con la siguiente estructura:
{
  "proveedor_razon_social": "Nombre o Razón Social del Proveedor",
  "proveedor_cuit": "30-XXXXXXXX-X o números limpios",
  "tipo_comprobante": "FACTURA A | FACTURA B | FACTURA C | REMITO | TICKET",
  "punto_venta": "00001",
  "numero_comprobante": "00012345",
  "fecha_emision": "YYYY-MM-DD",
  "items": [
    {
      "descripcion": "Nombre claro del producto / insumo",
      "cantidad": 10.5,
      "unidad": "KG | UN | LTS | PACK | GRS",
      "precio_unitario": 5400.00,
      "alicuota_iva": 21.0,
      "subtotal": 56700.00
    }
  ],
  "neto_gravado": 56700.00,
  "iva_21": 11907.00,
  "iva_10_5": 0.00,
  "percepciones_otros": 0.00,
  "total": 68607.00,
  "observaciones": "Comentarios relevantes sobre el comprobante"
}

Importante:
1. Normaliza las cantidades y precios a números (sin símbolos de moneda ni separadores de miles).
2. Si algún campo no está presente, usa valores lógicos (0 para importes, "" para texto).
3. Asegúrate de que los ítems coincidan con cada línea facturada.
`

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: mimeType || 'image/jpeg'
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const responseText = result.response.text()

  // Limpiar posible bloque markdown ```json ... ```
  const cleanJson = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    const parsed: InvoiceExtractedData = JSON.parse(cleanJson)
    return parsed
  } catch (err) {
    console.error('Error parseando JSON de Gemini OCR:', cleanJson)
    throw new Error('No se pudo interpretar el comprobante. Verifique la nitidez de la imagen.')
  }
}
