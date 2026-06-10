const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const headerIds = [
    'af3bf431-24af-47c5-bc7d-a986c60022c8',
    '519e831f-6adf-4909-8590-c6c09d1a9d32',
    '12b663f1-78a9-496c-8d13-122793ff8ab3',
    '4219964a-0d6a-40a0-bdec-6c6cb9262760',
    'aeaeaf3d-0fd5-4802-988f-1cbd5e40b1d7',
    'fb94e696-083f-4f6b-985b-c26d64848525',
    'a51183d5-d14f-498f-8ce9-7899a7448b7d',
    'a41efe74-bca2-43d7-b006-f2c9f4eaf345'
  ];

  const { data: units } = await supabase
    .from('event_sales_units')
    .select('id, header_id, coordinator_id, coordinators(name)')
    .in('header_id', headerIds);

  console.log("Units for 'Flor' headers:", units);
}

run().catch(console.error);
