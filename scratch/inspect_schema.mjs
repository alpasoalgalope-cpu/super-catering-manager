import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspect() {
  const tables = ['commercial_rules', 'event_sales_headers', 'event_sales_units', 'clients']
  for (const table of tables) {
    console.log(`Inspecting ${table}...`)
    try {
      const { data, error } = await supabase.from(table).select().limit(1)
      if (error) {
        console.error(`Error inspecting ${table}:`, error.message)
      } else {
        console.log(`Columns in ${table}:`, data && data[0] ? Object.keys(data[0]).join(', ') : 'Table exists but no rows to infer columns from')
      }
    } catch (e) {
      console.error(`Exception inspecting ${table}:`, e.message)
    }
  }
}

inspect()
