export default async (req: Request) => {
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || "https://super-catering-manager.netlify.app"
  console.log(`[Netlify Scheduled Function] Disparando corte diario a: ${siteUrl}/api/cron/daily-production-cut`)
  try {
    const res = await fetch(`${siteUrl}/api/cron/daily-production-cut`)
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
