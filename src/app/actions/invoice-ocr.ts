"use server";

import { generateContentWithFallback } from "@/lib/gemini";

export interface ParsedInvoiceItem {
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidades_por_bulto?: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ParsedInvoiceData {
  proveedor_nombre?: string;
  proveedor_cuit?: string;
  tipo_documento?: 'factura' | 'remito';
  nro_comprobante?: string;
  fecha_emision?: string;
  cae?: string;
  fecha_vto_cae?: string;
  items: ParsedInvoiceItem[];
  subtotal_neto?: number;
  iva?: number;
  percepcion_iibb?: number;
  percepcion_iva?: number;
  percepcion_ganancias?: number;
  impuestos_internos?: number;
  total_final?: number;
  observaciones?: string;
}

export async function parseInvoiceDocumentAction(
  fileBase64: string,
  mimeType: string = "image/jpeg"
): Promise<{ success: boolean; data?: ParsedInvoiceData; error?: string }> {
  try {
    if (!fileBase64) {
      return { success: false, error: "No se recibió archivo para procesar." };
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

    const prompt = `Sos un experto en auditoría y extracción contable de facturas y remitos argentinos (AFIP / ARCA).
Analizá minuciosamente este comprobante y extraé los siguientes datos con máxima precisión en formato JSON estricto:

1. proveedor_nombre: Razón Social del Proveedor emisor
2. proveedor_cuit: CUIT del Proveedor (ej: 30-65781386-5)
3. tipo_documento: 'factura' (si es Factura A, B, C o M) o 'remito' (si es Remito o Comprobante no fiscal)
4. nro_comprobante: Número completo del comprobante con punto de venta (ej: 0003-01017027)
5. fecha_emision: Fecha de emisión en formato YYYY-MM-DD
6. cae: Número de CAE si existe
7. fecha_vto_cae: Fecha de vencimiento de CAE en formato YYYY-MM-DD
8. items: Array de líneas o renglones facturados:
   - codigo: Código de producto (si existe, ej: 12114)
   - descripcion: Descripción completa del producto (ej: Ciabatta de Manteca (40 u.))
   - cantidad: Cantidad facturada (bultos o unidades)
   - unidades_por_bulto: Unidades que contiene cada bulto/paquete si está indicado (ej: 40)
   - precio_unitario: Precio unitario antes de impuestos si es factura
   - subtotal: Importe neto o total de la línea
9. subtotal_neto: Subtotal neto gravado
10. iva: Monto total del IVA facturado
11. percepcion_iibb: Percepción o retención de Ingresos Brutos (ej: IIBB Capital Federal o Bs As)
12. percepcion_iva: Percepción de IVA
13. percepcion_ganancias: Percepción de Ganancias
14. impuestos_internos: Impuestos internos u otros tributos
15. total_final: Importe total a pagar del comprobante
16. observaciones: Texto adicional relevante si existe

Respondé ÚNICAMENTE en JSON válido con las claves solicitadas sin texto extra.`;

    const parts = [
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: cleanBase64
        }
      },
      { text: prompt }
    ];

    const result = await generateContentWithFallback(parts, {
      responseMimeType: "application/json"
    });

    const parsed: ParsedInvoiceData = JSON.parse(result.text);

    return {
      success: true,
      data: parsed
    };
  } catch (err: any) {
    console.error("Error in parseInvoiceDocumentAction:", err);
    return {
      success: false,
      error: err.message || "Error al procesar el comprobante con IA."
    };
  }
}
