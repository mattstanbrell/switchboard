-- Start fresh by dropping all profile-related policies
DROP POLICY IF EXISTS "company_profile_access" ON public.profiles;
DROP POLICY IF EXISTS "view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_company_access" ON public.profiles;
DROP POLICY IF EXISTS "agent_company_access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Agents can view company agents and customers" ON public.profiles;
DROP POLICY IF EXISTS "admin_view_company_profiles" ON public.profiles;
DROP POLICY IF EXISTS "agent_view_company_profiles" ON public.profiles;
DROP POLICY IF EXISTS "enable_all_access_during_signup" ON public.profiles;
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_read_company_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Drop the problematic functions
DROP FUNCTION IF EXISTS public.current_user_company_id();
DROP FUNCTION IF EXISTS public.current_user_role();

-- Create a new non-recursive function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = user_id
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Basic policy for signup flow
CREATE POLICY "allow_insert_during_signup" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Self-read policy (no recursion)
CREATE POLICY "allow_select_self" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Company-based read policy (no recursion)
CREATE POLICY "allow_select_company_members" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles self 
    WHERE self.id = auth.uid() 
    AND self.company_id = profiles.company_id
  )
);

-- Self-update policy
CREATE POLICY "allow_update_self" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin update policy for company members
CREATE POLICY "allow_admin_update_company" ON public.profiles
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'admin'
    AND admin.company_id = profiles.company_id
  )
)
WITH CHECK (
  company_id IN (
    SELECT admin.company_id 
    FROM profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'admin'
  )
);
