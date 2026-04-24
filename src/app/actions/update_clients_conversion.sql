-- 1. Add conversion_factor column with default 1.0
ALTER TABLE clients ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1.0;

-- 2. Optional: Ensure values stay between 0 and 1 (Business Rule)
ALTER TABLE clients ADD CONSTRAINT chk_conversion_factor CHECK (conversion_factor >= 0 AND conversion_factor <= 1);
