#!/bin/bash

# Dump the database schema
npx supabase db dump -f supabase/schema.sql

# Remove consecutive empty lines from the schema file
sed -i '' '/^$/N;/^\n$/D' supabase/schema.sql

# Generate TypeScript types
npx supabase gen types typescript --project-id "ppvkdwlltghiyeqxfpdb" --schema public > database.types.ts

echo "✅ Database schema dumped and types generated successfully!" 