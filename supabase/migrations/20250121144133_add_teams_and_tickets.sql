-- Add teams and tickets related tables

-- 1. Teams (e.g. "Billing Team," "Support Team")
CREATE TABLE teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2. Focus areas (e.g. "Billing," "Tech Support")
CREATE TABLE focus_areas (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 3. Join table linking Teams to the Focus Areas they handle
CREATE TABLE team_focus_areas (
  team_id BIGINT NOT NULL REFERENCES teams(id),
  focus_area_id BIGINT NOT NULL REFERENCES focus_areas(id),
  PRIMARY KEY (team_id, focus_area_id)
);

-- 4. Profiles: customers & human agents
CREATE TABLE profiles (
  id UUID PRIMARY KEY,             -- references your auth system
  role TEXT NOT NULL 
    CHECK (role IN ('customer','human_agent')),  -- limit valid roles
  full_name TEXT NOT NULL,
  team_id BIGINT REFERENCES teams(id)            -- null if role='customer'
);

-- 5. Tickets
CREATE TABLE tickets (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  subject TEXT NOT NULL,                        -- short description
  status TEXT NOT NULL DEFAULT 'new',           -- 'new', 'open', 'resolved', etc.
  customer_id UUID NOT NULL REFERENCES profiles(id),
  focus_area_id BIGINT NOT NULL REFERENCES focus_areas(id)
);

-- Add indexes for foreign keys and common queries
CREATE INDEX idx_profiles_team_id ON profiles(team_id);
CREATE INDEX idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX idx_tickets_focus_area_id ON tickets(focus_area_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_status ON tickets(status); 