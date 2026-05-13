'use server'

import { createClient } from '@/lib/supabase/server'

export async function seedKitchenUser() {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email: 'cocina@supercatering.com',
    password: 'cocina123',
    options: {
      data: {
        role: 'cocina'
      }
    }
  })

  return { data, error }
}
