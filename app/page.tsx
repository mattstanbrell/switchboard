import { createClient } from '@/utils/supabase/server'
import { AuthForm } from '@/components/auth/auth-form'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Home() {
  const cookieStore = cookies()
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      
    if (profile?.role === 'customer') {
      redirect('/customer')
    } else if (profile?.role === 'human_agent') {
      redirect('/human_agent')
    } else if (profile?.role === 'admin') {
      redirect('/admin')
    }
  }

  return (
    <div className="min-h-screen">
      <AuthForm />
    </div>
  )
}
