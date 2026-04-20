import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables')
  if (error) {
    // If RPC fails, try common names
    console.error('RPC failed, trying manual probe...')
    const common = ['event_sales_headers', 'sales_headers', 'event_headers', 'event_sales_units', 'units']
    for (const table of common) {
      const { error: probeError } = await supabase.from(table).select('*').limit(0)
      if (!probeError) console.log(`Table found: ${table}`)
    }
  } else {
    console.log('Tables:', data)
  }
}

listTables()
