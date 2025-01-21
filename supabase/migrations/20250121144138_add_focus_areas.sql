-- Add unique constraint on focus_areas name
ALTER TABLE focus_areas ADD CONSTRAINT focus_areas_name_key UNIQUE (name);

-- Insert initial focus areas
INSERT INTO focus_areas (name) VALUES ('billing')
ON CONFLICT (name) DO NOTHING; 