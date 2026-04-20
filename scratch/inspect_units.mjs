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

async function inspectUnits() {
  const { data, error } = await supabase.from('event_sales_units').select('*').limit(1)
  if (error) {
    console.error('Error:', error.message)
  } else {
    // If no rows, try a trick to get columns
    console.log('Columns:', data && data[0] ? Object.keys(data[0]) : 'No data in units')
    
    // Try to get schema via RPC or other means if no data
    const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'event_sales_units' })
    if (!colError) console.log('RPC Columns:', cols)
  }
}

inspectUnits()
