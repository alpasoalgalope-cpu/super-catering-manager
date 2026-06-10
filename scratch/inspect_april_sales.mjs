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
  console.log("=== SALES HEADERS IN APRIL 2026 ===")
  const { data: sales, error: salesErr } = await supabase
    .from("event_sales_headers")
    .select(`
      id,
      event_master_id,
      company,
      company_name,
      total_amount,
      event_date,
      events_master:events_master!event_sales_headers_event_master_id_fkey(event_date, show_name)
    `)
    .gte("event_date", "2026-04-01")
    .lte("event_date", "2026-04-30")

  if (salesErr) console.error("Error sales:", salesErr)
  else {
    console.log(sales.map(s => ({
      id: s.id,
      master_id: s.event_master_id,
      company: s.company,
      company_name: s.company_name,
      amount: s.total_amount,
      header_date: s.event_date,
      master_date: s.events_master?.event_date,
      show: s.events_master?.show_name
    })))
  }

  console.log("\n=== SPECIFIC LOOKUP: VALBUS SALES IN ALL PERIODS ===")
  const { data: valbusSales, error: vErr } = await supabase
    .from("event_sales_headers")
    .select(`
      id,
      company,
      company_name,
      event_date,
      total_amount,
      events_master:events_master!event_sales_headers_event_master_id_fkey(event_date, show_name)
    `)
    .ilike("company", "%valbus%")
    .order("event_date", { ascending: true })

  if (vErr) console.error("Error VALBUS:", vErr)
  else {
    console.log(valbusSales.map(v => ({
      id: v.id,
      company: v.company,
      company_name: v.company_name,
      date: v.event_date,
      amount: v.total_amount,
      show: v.events_master?.show_name
    })))
  }
}

inspect().catch(console.error)
