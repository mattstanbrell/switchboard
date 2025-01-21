-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;

-- Admins can view all profiles in their company
CREATE POLICY "Admins can view company profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin
    WHERE admin.id = auth.uid() 
    AND admin.role = 'admin'
    AND admin.company_id = profiles.company_id
  )
);

-- Agents can view all agents and customers in their company
CREATE POLICY "Agents can view company agents and customers" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles agent
    WHERE agent.id = auth.uid() 
    AND agent.role = 'human_agent'
    AND agent.company_id = profiles.company_id
    AND profiles.role IN ('human_agent', 'customer')
  )
);

-- All users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles 
FOR SELECT TO authenticated 
USING (id = auth.uid());
