-- Add company_id to teams table
ALTER TABLE public.teams
ADD COLUMN company_id uuid REFERENCES auth.users(id);

-- Add index for company_id
CREATE INDEX idx_teams_company_id ON public.teams(company_id);

-- Admin policies scoped to their company
CREATE POLICY "Admins can view company profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles ap
    JOIN public.teams t ON ap.team_id = t.id
    WHERE ap.id = auth.uid() 
    AND ap.role = 'admin'
    AND t.company_id = (
      SELECT t2.company_id 
      FROM public.profiles p2
      JOIN public.teams t2 ON p2.team_id = t2.id
      WHERE p2.team_id = profiles.team_id
    )
  )
);

CREATE POLICY "Admins can view company tickets" ON public.tickets 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles ap
    WHERE ap.id = auth.uid() 
    AND ap.role = 'admin'
    AND ap.company_id = (
      SELECT p2.company_id 
      FROM public.profiles p2
      WHERE p2.id = tickets.customer_id
    )
  )
);

CREATE POLICY "Admins can manage company teams" ON public.teams 
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles ap
    WHERE ap.id = auth.uid() 
    AND ap.role = 'admin'
    AND ap.company_id = (
      SELECT p2.company_id 
      FROM public.profiles p2
      WHERE p2.team_id = teams.id
    )
  )
);

CREATE POLICY "Admins can manage company focus areas" ON public.focus_areas 
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles ap
    JOIN public.teams t ON ap.team_id = t.id
    JOIN public.team_focus_areas tfa ON tfa.team_id = t.id
    WHERE ap.id = auth.uid() 
    AND ap.role = 'admin'
    AND tfa.focus_area_id = focus_areas.id
    AND t.company_id = (
      SELECT t2.company_id 
      FROM public.teams t2
      WHERE t2.id = tfa.team_id
    )
  )
);

CREATE POLICY "Admins can manage team focus areas" ON public.team_focus_areas 
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles ap
    WHERE ap.id = auth.uid() 
    AND ap.role = 'admin'
    AND ap.company_id = (
      SELECT p2.company_id 
      FROM public.profiles p2
      WHERE p2.team_id = team_focus_areas.team_id
    )
  )
);
