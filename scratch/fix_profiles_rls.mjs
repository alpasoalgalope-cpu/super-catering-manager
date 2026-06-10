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

const fixSql = `
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- 1. Obtener email y rol del JWT directamente (evita consultas recursivas a tablas)
  v_email := auth.jwt() ->> 'email';
  v_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  -- 2. Bypass para el admin principal por email
  IF v_email = 'fschottenfeld@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- 3. Retornar si tiene el rol admin en el JWT
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

async function run() {
  console.log("Executing SQL to fix public.es_admin() function...")
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: fixSql })
  if (error) {
    console.error("Error applying SQL fix:", error)
  } else {
    console.log("Successfully redefined public.es_admin() function in Supabase! Response:", data)
  }
}

run().catch(console.error)
