import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Database } from '@/database.types'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const cookieStore = cookies()
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Admin</h1>
      <p className="text-xl">Hello, {profile?.full_name}</p>
    </div>
  )
} 