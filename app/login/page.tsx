import { AuthForm } from '@/components/auth/auth-form'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Verify the user still exists
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      // If there's an error or no user, sign out
      await supabase.auth.signOut()
      return <AuthForm />
    }

    redirect('/')
  }

  return <AuthForm />
} 