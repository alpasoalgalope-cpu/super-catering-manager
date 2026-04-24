// CRM Module Page
import React from 'react'
import { supabase } from '@/lib/supabase'
import CRMClient from '@/app/(dashboard)/crm/CRMClient'

export const dynamic = 'force-dynamic'

export default async function CRMPage() {
  // Fetch leads on the server for initial load
  const { data: leads, error } = await supabase
    .from('crm_leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('CRM Fetch Error:', error)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-4">
        <div>
          <h2 className="text-5xl font-bold tracking-tighter text-slate-900 uppercase italic">
            Pipeline <span className="text-indigo-600">Comercial</span>
          </h2>
          <p className="text-xl text-slate-500 font-medium mt-2">Gestión de prospectos y staging para el maestro de empresas.</p>
        </div>
      </div>

      <CRMClient initialLeads={leads || []} />
    </div>
  )
}
