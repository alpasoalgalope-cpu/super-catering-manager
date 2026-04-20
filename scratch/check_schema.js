const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('recitales_staging').select('*').limit(1);
  if (error) {
    console.error('Error fetching recitales_staging:', error);
  } else {
    console.log('Columns in recitales_staging:', data && data.length > 0 ? Object.keys(data[0]) : 'Empty table');
  }
}
check();
