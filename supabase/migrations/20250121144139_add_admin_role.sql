-- Add admin role to the role check constraint
ALTER TABLE profiles 
DROP CONSTRAINT profiles_role_check,
ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['customer'::text, 'human_agent'::text, 'admin'::text]));

-- Create companies table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add company_id to profiles
ALTER TABLE profiles ADD COLUMN company_id INTEGER REFERENCES companies(id);

-- Create RLS policies for companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read their company"
    ON companies FOR SELECT
    USING (id IN (
        SELECT company_id 
        FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    ));

CREATE POLICY "Admins can update their company"
    ON companies FOR UPDATE
    USING (id IN (
        SELECT company_id 
        FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    ));

-- Update RLS policies for profiles to respect company boundaries
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view profiles in their company"
    ON profiles FOR SELECT
    USING (company_id IN (
        SELECT company_id 
        FROM profiles 
        WHERE profiles.id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

-- Admin policies for managing profiles
CREATE POLICY "Admins can update profiles in their company"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles admin 
            WHERE admin.id = auth.uid() 
            AND admin.role = 'admin' 
            AND admin.company_id = profiles.company_id
        )
    ); 