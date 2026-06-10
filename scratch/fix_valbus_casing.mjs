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

async function run() {
  console.log("Fixing company casing in event_sales_headers...")
  const { data: before } = await supabase
    .from("event_sales_headers")
    .select("id, company, company_name")
    .ilike("company", "valbus")

  console.log("Found matches before update:", before)

  const { error } = await supabase
    .from("event_sales_headers")
    .update({ company: "ValBus", company_name: "ValBus" })
    .ilike("company", "valbus")

  if (error) {
    console.error("Error updating casing:", error)
  } else {
    console.log("Successfully updated casing to 'ValBus'!")
  }

  const { data: after } = await supabase
    .from("event_sales_headers")
    .select("id, company, company_name")
    .ilike("company", "valbus")
  console.log("Matches after update:", after)
}

run().catch(console.error)
