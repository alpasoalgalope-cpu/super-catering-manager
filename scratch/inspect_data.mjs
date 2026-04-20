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
  // If there's no data, we can try to guess columns by inserting and rolling back or using RPC
  // But let's try a different probe
  const { data, error } = await supabase.from('event_sales_units').select('*').limit(1)
  if (data && data.length > 0) {
    console.log('Units columns:', Object.keys(data[0]))
  } else {
    console.log('No data in event_sales_units to infer columns. Table exists though.')
  }
  
  // Checking commercial_rules data to see values
  const { data: rules } = await supabase.from('commercial_rules').select('*')
  console.log('Commercial Rules Data:', rules)
}

inspectUnits()
