-- Allow admins to create new profiles in their company
CREATE POLICY "Admins can create profiles in their company"
    ON profiles FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin' 
            AND profiles.company_id = company_id
        )
    );

-- Allow admins to create focus areas for their company
ALTER TABLE focus_areas ADD COLUMN company_id INTEGER REFERENCES companies(id);

CREATE POLICY "Admins can create focus areas"
    ON focus_areas FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin' 
            AND profiles.company_id = company_id
        )
    );

CREATE POLICY "Users can view focus areas in their company"
    ON focus_areas FOR SELECT TO authenticated
    USING (company_id IN (
        SELECT company_id 
        FROM profiles 
        WHERE profiles.id = auth.uid()
    )); 