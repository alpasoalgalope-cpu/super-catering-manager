import { NextRequest, NextResponse } from "next/server"
import { getDispatchSummaryAction } from "@/app/actions/logistics"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "El parámetro event_id es obligatorio." },
        { status: 400 }
      )
    }

    const res = await getDispatchSummaryAction(eventId)

    if (!res.success || !res.data) {
      return NextResponse.json(
        { error: res.error || "No se pudo obtener el consolidado de logística." },
        { status: 404 }
      )
    }

    return NextResponse.json(res.data, { status: 200 })
  } catch (err: any) {
    console.error("API /api/logistics/summary error:", err)
    return NextResponse.json(
      { error: err.message || "Error interno del servidor." },
      { status: 500 }
    )
  }
}
