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
  console.log("=== EVENTS IN APRIL 2026 ===")
  const { data: events, error: evErr } = await supabase
    .from("events_master")
    .select("*, venues(name)")
    .gte("event_date", "2026-04-01")
    .lte("event_date", "2026-04-30")
    .order("event_date", { ascending: true })

  if (evErr) console.error("Error events:", evErr)
  else console.log(events.map(e => ({ id: e.id, date: e.event_date, show: e.show_name, venue: e.venues?.name, status: e.status })))

  console.log("\n=== SALES HEADERS IN APRIL 2026 ===")
  const { data: sales, error: salesErr } = await supabase
    .from("event_sales_headers")
    .select("*, events_master(event_date, show_name)")
    .gte("event_date", "2026-04-01")
    .lte("event_date", "2026-04-30")

  if (salesErr) console.error("Error sales:", salesErr)
  else console.log(sales?.map(s => ({
    id: s.id,
    event_master_id: s.event_master_id,
    company: s.company,
    company_name: s.company_name,
    total_amount: s.total_amount,
    date: s.event_date || s.events_master?.event_date,
    show: s.events_master?.show_name
  })))

  console.log("\n=== DISTINCT COMPANIES IN SALES HEADERS ===")
  const { data: distCompanies, error: distErr } = await supabase
    .from("event_sales_headers")
    .select("company, company_name")
  
  if (distErr) console.error("Error distinct companies:", distErr)
  else {
    const map = {}
    distCompanies.forEach(c => {
      const key = `${c.company} | ${c.company_name}`
      map[key] = (map[key] || 0) + 1
    })
    console.log(map)
  }
}

inspect().catch(console.error)
