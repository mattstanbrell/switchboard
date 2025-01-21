-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the updated function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
declare
  company_id int;
begin
  -- If signing up as admin, create a new company
  if new.raw_user_meta_data->>'role' = 'admin' then
    insert into public.companies (name)
    values (new.raw_user_meta_data->>'company_name')
    returning id into company_id;
  end if;

  insert into public.profiles (id, full_name, role, company_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    company_id
  );
  return new;
end;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 