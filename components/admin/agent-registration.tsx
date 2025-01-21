'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  companyId: string
}

export function AgentRegistration({ companyId }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/register-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName.trim(),
          companyId
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      setSuccess('Agent registered successfully! They can now sign in with their email and password.')
      setFullName('')
      setEmail('')
      setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register agent')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Register Agent</h2>
        <p className="text-muted-foreground mb-6">
          Add new support agents to your team.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@company.com"
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            required
          />
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {success && (
          <p className="text-green-600 text-sm">{success}</p>
        )}

        <Button
          type="submit"
          disabled={isLoading || !fullName.trim() || !email.trim() || !password.trim()}
        >
          {isLoading ? 'Registering...' : 'Register Agent'}
        </Button>
      </form>
    </div>
  )
} 