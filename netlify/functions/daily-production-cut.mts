export default async (req: Request) => {
  const siteUrl = process.env.URL || "https://alpasoalgalope.netlify.app"
  console.log(`[Netlify Scheduled Function] Disparando corte diario a: ${siteUrl}/api/cron/daily-production-cut`)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(`${siteUrl}/api/cron/daily-production-cut`, {
      method: "POST",
      headers: {
        "x-vercel-cron": "1"
      },
      signal: controller.signal
    })
    clearTimeout(timeout)
    const data = await res.json()
    console.log("[Netlify Scheduled Function Result]", data)
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (err: any) {
    console.error("[Netlify Scheduled Function Error]", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}

export const config = {
  schedule: "15 2 * * *" // 02:15 UTC = 23:15 Argentina
}
