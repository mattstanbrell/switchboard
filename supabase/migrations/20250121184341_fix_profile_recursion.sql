-- Drop problematic policies
DROP POLICY IF EXISTS "company_profile_access" ON public.profiles;
DROP POLICY IF EXISTS "view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_company_access" ON public.profiles;
DROP POLICY IF EXISTS "agent_company_access" ON public.profiles;

-- Create a simpler policy structure
CREATE POLICY "enable_all_access_during_signup" ON public.profiles
FOR ALL USING (
  -- During signup, the user won't have a profile yet
  NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "users_can_read_own_profile" ON public.profiles
FOR SELECT USING (
  id = auth.uid()
);

CREATE POLICY "users_can_read_company_profiles" ON public.profiles
FOR SELECT USING (
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- Update the handle_new_user function to be more resilient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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
  ELSE
    -- For customers, use the selected company_id from metadata
    new_company_id := (NEW.raw_user_meta_data->>'company_id')::integer;
    
    -- Validate that the company exists
    IF NOT EXISTS (SELECT 1 FROM companies WHERE id = new_company_id) THEN
      RAISE EXCEPTION 'Invalid company_id: %', new_company_id;
    END IF;
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
