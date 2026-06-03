"use client"

import MasterEventForm from "@/components/forms/MasterEventForm"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

export default function GestionEventosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>}>
      <MasterEventForm />
    </Suspense>
  )
}
