"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export type LeadStage = 'Prospecto' | 'Contactado' | 'En prueba' | 'Cliente activo' | 'Cliente dormido' | 'Perdido'

export interface LeadInput {
  id?: string
  razon_social: string
  tax_id?: string
  contacto_principal?: string
  email_contacto?: string
  telefono?: string
  etapa?: LeadStage
  valor_estimado?: number
  notas?: string
  metadata_catering?: any
}

/**
 * Upsert a Lead into the CRM.
 * Uses tax_id as the conflict target for duplicate prevention.
 */
export async function upsertLead(lead: LeadInput) {
  try {
    const payload = {
      ...lead,
      updated_at: new Date().toISOString(),
    }

    // Clean empty strings to null for tax_id to avoid unique constraint issues with empty strings
    if (payload.tax_id === "") {
      delete payload.tax_id
    }

    let query;
    if (lead.id) {
      // If we have an ID, it's a direct update
      query = supabase.from('crm_leads').update(payload).eq('id', lead.id)
    } else if (payload.tax_id) {
      // If we have a tax_id but no ID, use upsert logic with tax_id as conflict target
      query = supabase.from('crm_leads').upsert(payload, { onConflict: 'tax_id' })
    } else {
      // If we have nothing to identify it, it's a clean insert
      query = supabase.from('crm_leads').insert(payload)
    }

    const { data, error } = await query.select().single()

    if (error) throw error

    revalidatePath('/crm')
    return { success: true, data }
  } catch (error: any) {
    console.error('CRM Upsert Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update the stage of a Lead.
 */
export async function updateLeadStage(id: string, etapa: LeadStage) {
  try {
    const { error } = await supabase
      .from('crm_leads')
      .update({ etapa })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/crm')
    return { success: true }
  } catch (error: any) {
    console.error('CRM Stage Update Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a Lead.
 */
export async function deleteLead(id: string) {
  try {
    const { error } = await supabase
      .from('crm_leads')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/crm')
    return { success: true }
  } catch (error: any) {
    console.error('CRM Delete Error:', error)
    return { success: false, error: error.message }
  }
}
