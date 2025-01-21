-- Create a security definer function to check profiles without triggering RLS
CREATE OR REPLACE FUNCTION public.get_profile(user_id uuid)
RETURNS TABLE (
  id uuid,
  role text,
  company_id integer
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, role, company_id
  FROM profiles
  WHERE id = user_id;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile(uuid) TO service_role;
