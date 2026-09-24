import { NextRequest, NextResponse } from "next/server"
import { sendDailyProductionCutSchedule } from "@/lib/email"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // Si está configurado CRON_SECRET, validar token o cabecera x-vercel-cron
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isVercelCron = request.headers.get("x-vercel-cron") === "1"
      if (!isVercelCron) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get("date") || undefined
    const targetEmail = searchParams.get("targetEmail") || undefined
    const ccEmail = searchParams.get("ccEmail") || undefined
    const dryRun = searchParams.get("dryRun") === "true"
    const force = searchParams.get("force") === "true"

    const result = await sendDailyProductionCutSchedule({
      targetDate,
      targetEmail,
      ccEmail,
      dryRun,
      force
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[Cron Daily Production Cut Error]", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
