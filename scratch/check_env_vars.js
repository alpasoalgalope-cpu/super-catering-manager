console.log("Service Role Key exists in process.env:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Service Role Key length:", process.env.SUPABASE_SERVICE_ROLE_KEY.length);
}
