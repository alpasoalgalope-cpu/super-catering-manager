import React from "react"
import { getBusByTokenAction } from "@/app/actions/logistics"
import CoordinatorCheckin from "@/components/logistics/CoordinatorCheckin"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

interface Props {
  params: {
    token: string
  }
}

export default async function CoordinatorCheckinPage({ params }: Props) {
  const res = await getBusByTokenAction(params.token)

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-2xl">
          <AlertCircle className="mx-auto text-rose-500" size={48} />
          <h1 className="text-xl font-black uppercase text-white">Link de Check-in no encontrado</h1>
          <p className="text-xs text-slate-400 font-medium">
            {res.error || "El token de acceso no es válido o ha expirado. Por favor comunicate con la central de catering."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <CoordinatorCheckin
      token={params.token}
      initialBus={res.data.bus}
      initialBreakdown={res.data.breakdown}
    />
  )
}
