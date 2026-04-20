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

async function inspectEvents() {
  const { data, error } = await supabase.from('recitales_staging').select('*').limit(1)
  if (data && data.length > 0) {
    console.log('Events columns:', Object.keys(data[0]))
  } else {
    console.log('No data in recitales_staging or error:', error?.message)
  }
}

inspectEvents()
