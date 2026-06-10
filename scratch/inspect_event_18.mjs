import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const envFile = fs.readFileSync(path.resolve(".env.local"), "utf8")
const envVars = {}
envFile.split(/\r?\n/).forEach(line => {
  const cleanLine = line.trim()
  if (!cleanLine || cleanLine.startsWith("#")) return
  const parts = cleanLine.split("=")
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, '')
    envVars[key] = val
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  const eventId = "8bbbe828-40d8-470c-9b4e-7b95835e34ae"
  console.log(`=== EVENT PROJECTIONS FOR ${eventId} (Ricky Martin 18/4) ===`)
  const { data: projections, error: pErr } = await supabase
    .from("event_projections")
    .select("*")
    .eq("event_id", eventId)

  if (pErr) console.error("Error projections:", pErr)
  else console.log(projections)

  console.log(`\n=== SALES HEADERS FOR ${eventId} (Ricky Martin 18/4) ===`)
  const { data: sales, error: sErr } = await supabase
    .from("event_sales_headers")
    .select("id, company, company_name, total_amount, pax_projected")
    .eq("event_master_id", eventId)

  if (sErr) console.error("Error sales:", sErr)
  else console.log(sales)
}

inspect().catch(console.error)
