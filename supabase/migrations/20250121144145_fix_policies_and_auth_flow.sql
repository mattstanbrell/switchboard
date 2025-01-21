-- File: migrations/20250121144144_fix_policies_and_auth_flow.sql
BEGIN;

-- 1. Fix auth trigger function with proper company handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  new_company_id INTEGER;
BEGIN
  -- Create company first if admin
  IF NEW.raw_user_meta_data->>'role' = 'admin' THEN
    INSERT INTO companies (name)
    VALUES (NEW.raw_user_meta_data->>'company_name')
    RETURNING id INTO new_company_id;
  END IF;

  -- Insert profile with company reference
  INSERT INTO profiles (id, full_name, role, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    new_company_id
  );

  RETURN NEW;
END;
$$;

-- 2. Create security definer helper functions
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- 3. Remove recursive policies only
DROP POLICY IF EXISTS "admin_view_company_profiles" ON public.profiles;
DROP POLICY IF EXISTS "agent_view_company_profiles" ON public.profiles;

-- 4. Create non-recursive policies using helper functions
CREATE POLICY "admin_company_access" ON public.profiles
FOR SELECT USING (
  current_user_role() = 'admin' AND
  company_id = current_user_company_id()
);

CREATE POLICY "agent_company_access" ON public.profiles
FOR SELECT USING (
  current_user_role() = 'human_agent' AND
  company_id = current_user_company_id() AND
  role IN ('human_agent', 'customer')
);