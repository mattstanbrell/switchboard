-- File: migrations/20250121144145_fix_profile_view_policies.sql
BEGIN;

-- Create security definer function to get company ID
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

-- Drop old policies
DROP POLICY IF EXISTS "view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "admin_view_company_profiles" ON public.profiles;

-- Create simple unified policy
CREATE POLICY "company_profile_access" ON public.profiles
FOR SELECT USING (
  company_id = current_user_company_id()
);

-- Add back basic self-view
CREATE POLICY "view_own_profile" ON public.profiles
FOR SELECT USING (
  id = auth.uid()
);

COMMIT;