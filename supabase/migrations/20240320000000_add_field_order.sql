-- Add display_order column
ALTER TABLE field_definitions ADD COLUMN display_order integer;

-- Update existing records with sequential order
WITH ordered_fields AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY id) as rn
  FROM field_definitions
)
UPDATE field_definitions
SET display_order = ordered_fields.rn
FROM ordered_fields
WHERE field_definitions.id = ordered_fields.id;

-- Make display_order NOT NULL after setting initial values
ALTER TABLE field_definitions ALTER COLUMN display_order SET NOT NULL;

-- Add an index to optimize ordering queries
CREATE INDEX idx_field_definitions_company_order ON field_definitions(company_id, display_order); 