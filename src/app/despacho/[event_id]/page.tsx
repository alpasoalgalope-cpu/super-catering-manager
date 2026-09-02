import React from "react"
import { getDispatchSummaryAction } from "@/app/actions/logistics"
import DeliveryDashboard from "@/components/logistics/DeliveryDashboard"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

interface Props {
  params: {
    event_id: string
  }
}

export default async function DespachoPage({ params }: Props) {
  const res = await getDispatchSummaryAction(params.event_id)

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-2xl">
          <AlertCircle className="mx-auto text-rose-500" size={48} />
          <h1 className="text-xl font-black uppercase text-white">Hoja de Despacho no encontrada</h1>
          <p className="text-xs text-slate-400 font-medium">
            {res.error || "No se pudieron cargar los datos de despacho para este evento."}
          </p>
        </div>
      </div>
    )
  }

  return <DeliveryDashboard initialData={res.data} />
}
