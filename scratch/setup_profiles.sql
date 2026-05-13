CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  role text CHECK (role IN ('admin', 'cocina')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read profiles (needed for role check on login/session)
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);

-- Allow admins to manage all profiles
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);
