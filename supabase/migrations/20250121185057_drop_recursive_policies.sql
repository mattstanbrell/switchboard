-- Drop the remaining recursive policies
DROP POLICY IF EXISTS "admin_company_access" ON public.profiles;
DROP POLICY IF EXISTS "agent_company_access" ON public.profiles;
DROP POLICY IF EXISTS "company_profile_access" ON public.profiles;
