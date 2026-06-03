import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

async function inspect() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
    })
    const spec = await res.json()
    console.log("Full error response:", spec)
  } catch (e) {
    console.error("Error:", e)
  }
}

inspect()
