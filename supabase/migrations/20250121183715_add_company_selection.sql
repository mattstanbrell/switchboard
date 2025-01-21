-- Create a security definer function to get all companies
CREATE OR REPLACE FUNCTION public.get_companies()
RETURNS TABLE (id integer, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name 
  FROM companies 
  ORDER BY name;
$$;

-- Grant access to the get_companies function
GRANT EXECUTE ON FUNCTION public.get_companies() TO anon;
GRANT EXECUTE ON FUNCTION public.get_companies() TO authenticated;

-- Update handle_new_user function to handle company_id from metadata
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
