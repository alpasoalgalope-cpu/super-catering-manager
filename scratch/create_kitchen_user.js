const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sql = `
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  is_super_admin, 
  role, 
  aud,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(), 
  'cocina@supercatering.com', 
  crypt('cocina123', gen_salt('bf')), 
  now(), 
  now(), 
  '{"provider":"email","providers":["email"],"role":"cocina"}', 
  '{"role":"cocina"}', 
  false, 
  'authenticated', 
  'authenticated',
  now(),
  now()
);
`;

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
