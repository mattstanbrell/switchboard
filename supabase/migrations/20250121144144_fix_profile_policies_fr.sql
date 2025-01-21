-- Drop all existing profile policies to start fresh
DROP POLICY IF EXISTS "admin_view_company_profiles" ON public.profiles;  -- New drop
DROP POLICY IF EXISTS "agent_view_company_profiles" ON public.profiles;  -- New drop
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;
-- ... keep other existing DROPs ...

-- Then create fresh policies with new names
CREATE POLICY "admin_view_company_profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
      AND current_user_profile.role = 'admin'
      AND current_user_profile.company_id = profiles.company_id
  )
);

CREATE POLICY "agent_view_company_profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
      AND current_user_profile.role = 'human_agent'
      AND current_user_profile.company_id = profiles.company_id
      AND profiles.role IN ('human_agent', 'customer')
  )
);