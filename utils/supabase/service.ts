import type { Database } from '@/database.types'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with the service role key
export const supabaseService = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) 