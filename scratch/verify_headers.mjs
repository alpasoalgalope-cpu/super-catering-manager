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

async function createHeadersTable() {
  console.log('Attempting to create event_sales_headers table if missing...')
  
  // We can't easily create tables via Supabase JS without high-privilege keys or standard SQL.
  // But we can check if it exists via RPC or try a small query.
  const { error } = await supabase.from('event_sales_headers').select('*').limit(0)
  
  if (error && error.code === 'PGRST116' || error?.message?.includes('not found')) {
    console.log('Table event_sales_headers definitely missing.')
    // I should advise the user to run the SQL or I can try to use RPC if they have some "query" helper.
  } else if (!error) {
    console.log('Table event_sales_headers already exists.')
    const { data } = await supabase.from('event_sales_headers').select('*').limit(1)
    console.log('Columns:', data && data[0] ? Object.keys(data[0]) : 'No data yet')
  } else {
    console.error('Unexpected error:', error)
  }
}

createHeadersTable()
