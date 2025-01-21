'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Suspense } from 'react'

function RegisterCompanyForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  
  return (
    <div className="min-h-screen bg-custom-background flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full bg-custom-background-secondary">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-center text-custom-text">
            Register Your Company
          </CardTitle>
          <CardDescription className="text-center text-custom-text-secondary">
            Set up your company&apos;s helpdesk
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-500/10">
              <AlertDescription className="text-custom-text">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          <form className="space-y-4" action="/auth/admin-signup" method="POST">
            <input type="hidden" name="role" value="admin" />
            
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-custom-text">
                Full name
              </Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                required
                className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name" className="text-custom-text">
                Company name
              </Label>
              <Input
                id="company_name"
                name="company_name"
                type="text"
                required
                className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                placeholder="Your company"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-custom-text">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                placeholder="you@company.com"
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
                autoComplete="new-password"
                required
                className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                placeholder="••••••••"
              />
            </div>

            <Button 
              type="submit"
              className="w-full bg-custom-accent hover:bg-custom-accent/90 text-white mt-6"
            >
              Register Company
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegisterCompany() {
  return (
    <Suspense>
      <RegisterCompanyForm />
    </Suspense>
  )
}
