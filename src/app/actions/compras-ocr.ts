"use server"

import { uploadFileToGoogleDrive } from "@/lib/google-drive"
import { processInvoiceWithGeminiOCR, InvoiceExtractedData } from "@/lib/ocr-gemini"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface ProcessInvoiceResult {
  success: boolean
  driveUrl?: string
  driveId?: string
  ocrData?: InvoiceExtractedData
  error?: string
}

export async function procesarFacturaOCRAction(formData: FormData): Promise<ProcessInvoiceResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file) {
      return { success: false, error: "No se seleccionó ningún archivo de factura o remito." }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'image/jpeg'
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`

    const now = new Date()
    const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 1. Subir a Google Drive en segundo plano dentro de Compras_Facturas_OCR/YYYY-MM
    let driveUrl = ""
    let driveId = ""
    try {
      const driveRes = await uploadFileToGoogleDrive({
        buffer,
        fileName,
        mimeType,
        pathSegments: ['Compras_Facturas_OCR', monthFolder]
      })
      driveUrl = driveRes.webViewLink
      driveId = driveRes.fileId
    } catch (driveErr) {
      console.warn("No se pudo guardar en Google Drive (continuando con OCR):", driveErr)
    }

    // 2. Procesar imagen con Gemini Vision
    const ocrData = await processInvoiceWithGeminiOCR(buffer, mimeType)

    return {
      success: true,
      driveUrl,
      driveId,
      ocrData
    }
  } catch (err: any) {
    console.error("Error en procesarFacturaOCRAction:", err)
    return {
      success: false,
      error: err.message || "Error al procesar el comprobante mediante OCR."
    }
  }
}
