-- Create policies for tickets table
-- Customers can create tickets and view their own tickets
CREATE POLICY "Customers can create tickets"
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'customer'
  )
  AND customer_id = auth.uid()
);

CREATE POLICY "Customers can view their own tickets"
ON tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'customer'
  )
  AND customer_id = auth.uid()
); 