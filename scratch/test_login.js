const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wfxglxbbhwvduhmcguep.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeGdseGJiaHd2ZHVobWNndWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwNzcsImV4cCI6MjA5MTczNDA3N30.qdveIEwfxODbAsfoF4Z4yFzayyMybLqKJHh0gETvRVc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'cocina@supercatering.com',
    password: 'cocina123',
  });
  console.log('Result:', JSON.stringify({ data, error }));
}

run();
