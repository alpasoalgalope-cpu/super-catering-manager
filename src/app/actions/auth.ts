'use server'

import { createClient } from '@/lib/supabase/server'

export async function seedKitchenUser() {
  return { data: null, error: { message: "El usuario de cocina se encuentra desactivado permanentemente." } }
}
