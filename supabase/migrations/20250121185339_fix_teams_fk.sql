-- Drop policies, foreign key and index that depend on company_id
DROP POLICY IF EXISTS "Admins can manage company teams" ON "public"."teams";
ALTER TABLE "public"."teams" DROP CONSTRAINT IF EXISTS "teams_company_id_fkey";
DROP INDEX IF EXISTS "idx_teams_company_id";

-- Create a new column with the correct type
ALTER TABLE "public"."teams" ADD COLUMN "new_company_id" integer;

-- Drop the old column and rename the new one
ALTER TABLE "public"."teams" DROP COLUMN "company_id";
ALTER TABLE "public"."teams" RENAME COLUMN "new_company_id" TO "company_id";

-- Add the correct foreign key and index
ALTER TABLE "public"."teams" 
  ADD CONSTRAINT "teams_company_id_fkey" 
  FOREIGN KEY ("company_id") 
  REFERENCES "public"."companies"("id");

CREATE INDEX "idx_teams_company_id" ON "public"."teams" USING btree ("company_id");

-- Recreate the policy
CREATE POLICY "Admins can manage company teams" ON "public"."teams" 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles ap
      WHERE ap.id = auth.uid() 
      AND ap.role = 'admin'
    )
  );
