import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default async function RootPage() {
  headers() // Force dynamic rendering
  
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError) {
    console.error('Auth error:', userError)
    // Don't redirect on auth error, just show the homepage
  }

  // Only redirect if we have a valid user
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      // User exists in auth but not in profiles (deleted user)
      // Sign them out and let them create a new account
      await supabase.auth.signOut()
    } else {
      // Only redirect if we have a valid profile
      if (profile.role === 'admin') {
        redirect('/admin')
      } else {
        redirect('/customer')
      }
    }
  }

  return (
    <div className="min-h-screen bg-custom-background flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full bg-custom-background-secondary">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-center text-custom-text">
            Welcome to Switchboard
          </CardTitle>
          <CardDescription className="text-center text-custom-text-secondary">
            Your modern helpdesk solution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            asChild
            className="w-full bg-custom-accent hover:bg-custom-accent/90 text-white"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full bg-custom-ui-medium" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-custom-background-secondary text-custom-text-tertiary text-sm">
                Or
              </span>
            </div>
          </div>
          
          <Button
            asChild
            variant="outline"
            className="w-full border-custom-ui-strong hover:bg-custom-ui-faint text-custom-text"
          >
            <Link href="/register-company">Register Company</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
