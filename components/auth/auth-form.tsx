'use client'

import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function AuthForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  const fetchCompanies = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('get_companies')
      
      if (error) throw error
      setCompanies(data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies')
    }
  }

  const handleModeChange = (newMode: 'sign-in' | 'sign-up') => {
    setMode(newMode)
    setError(null)
    setFullName('')
    setSelectedCompanyId(null)
    if (newMode === 'sign-up') {
      fetchCompanies()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (mode === 'sign-up' && !selectedCompanyId) {
      setError('Please select a company')
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      if (mode === 'sign-up') {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
            data: {
              full_name: fullName,
              role: 'customer',
              company_id: selectedCompanyId,
            },
          },
        })
        if (signUpError) throw signUpError
        
        if (!data.session) {
          setError('Please check your email to confirm your account')
          return
        }

        router.refresh()
        router.push('/customer')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('No user returned from sign in')

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (profileError) throw new Error('Unable to fetch user profile')
        if (!profile) throw new Error('No profile found')

        router.refresh()
        
        if (profile.role === 'customer') {
          router.push('/customer')
        } else if (profile.role === 'human_agent') {
          router.push('/human_agent')
        } else if (profile.role === 'admin') {
          router.push('/admin')
        } else {
          throw new Error('Invalid user role')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-custom-background">
      <Card className="w-full max-w-sm bg-custom-background-secondary">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-custom-text">
            {mode === 'sign-in' ? 'Welcome back' : 'Create account'}
          </CardTitle>
          <CardDescription className="text-center text-custom-text-secondary">
            {mode === 'sign-in' 
              ? 'Enter your email to sign in to your account' 
              : 'Enter your details to create your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'sign-up' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-custom-text">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    className="bg-custom-background border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-custom-text">
                    Company
                  </Label>
                  <Select
                    value={selectedCompanyId?.toString()}
                    onValueChange={(value) => setSelectedCompanyId(value)}
                  >
                    <SelectTrigger className="bg-custom-background border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-custom-text">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                className="bg-custom-background border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-custom-text">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-custom-background border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className={`text-sm text-center ${error.includes('check your email') ? 'text-custom-accent' : 'text-destructive'}`}>
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-custom-accent text-white hover:bg-custom-accent/90"
            >
              {isLoading ? 'Loading...' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            type="button"
            variant="link"
            onClick={() => handleModeChange(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="text-custom-accent hover:text-custom-accent/90"
          >
            {mode === 'sign-in'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 