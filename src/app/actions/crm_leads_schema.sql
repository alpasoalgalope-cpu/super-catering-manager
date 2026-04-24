-- 1. Create Stage Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_stage') THEN
        CREATE TYPE crm_stage AS ENUM (
          'Prospecto', 
          'Primer Contacto', 
          'Presupuesto', 
          'Degustación', 
          'Cerrado'
        );
    END IF;
END$$;

-- 2. Create CRM Leads Table
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  razon_social TEXT NOT NULL,
  tax_id TEXT UNIQUE NOT NULL, -- CUIT/DNI
  contacto_principal TEXT,
  email_contacto TEXT,
  telefono TEXT,
  etapa crm_stage DEFAULT 'Prospecto',
  valor_estimado NUMERIC DEFAULT 0,
  notas TEXT,
  metadata_catering JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

-- 4. Basic Policies (Assuming authenticated access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_leads' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" 
        ON crm_leads 
        FOR ALL 
        USING (auth.role() = 'authenticated')
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END$$;

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER update_crm_leads_updated_at
BEFORE UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
