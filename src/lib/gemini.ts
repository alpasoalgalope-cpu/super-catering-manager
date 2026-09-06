/**
 * Google Gemini AI - Native REST Client (Zero NPM Dependencies)
 * Security: Server-side execution only via Server Actions. Never exposed to browser bundles.
 */

const FALLBACK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest"
]

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY
  return Boolean(key && key.trim() !== "")
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key || key.trim() === "") {
    throw new Error(
      "GEMINI_API_KEY no configurada. Por favor agregá la variable GEMINI_API_KEY en tu archivo .env.local (o en las variables de entorno de Netlify) para habilitar las funciones de IA."
    )
  }
  return key.trim()
}

/**
 * Executes a Gemini request with automatic fallback across available Flash models
 * Server-side execution only.
 */
export async function generateContentWithFallback(
  promptOrParts: string | any[],
  options: { responseMimeType?: string } = {}
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = getGeminiApiKey()

  // Format payload
  let parts: any[] = []
  if (typeof promptOrParts === "string") {
    parts = [{ text: promptOrParts }]
  } else if (Array.isArray(promptOrParts)) {
    parts = promptOrParts.map(p => {
      if (typeof p === "string") return { text: p }
      return p
    })
  }

  const payload: any = {
    contents: [
      {
        role: "user",
        parts
      }
    ]
  }

  if (options.responseMimeType) {
    payload.generationConfig = {
      responseMimeType: options.responseMimeType
    }
  }

  let lastError: any = null

  for (const modelName of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn(`Gemini model ${modelName} returned status ${res.status}: ${errText.substring(0, 100)}`)
        lastError = new Error(`Gemini HTTP ${res.status}: ${errText}`)
        continue
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
      return { text, modelUsed: modelName }
    } catch (err: any) {
      console.warn(`Gemini model ${modelName} error: ${err.message}`)
      lastError = err
    }
  }

  throw lastError || new Error("No se pudo obtener respuesta de los modelos de Gemini.")
}
