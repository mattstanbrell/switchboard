import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CreateTicketForm({ onSuccess }: { onSuccess?: () => void }) {
  const [subject, setSubject] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('User not authenticated')
      setIsLoading(false)
      return
    }

    // Insert the ticket
    const { error: insertError } = await supabase
      .from('tickets')
      .insert({
        subject,
        customer_id: user.id,
        focus_area_id: 1, // Assuming 1 is the ID for billing
        status: 'new'
      })

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    // Reset form and notify parent
    setSubject('')
    setIsLoading(false)
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-custom-text">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
          required
        />
      </div>
      
      {error && (
        <div className="text-destructive text-sm">
          {error}
        </div>
      )}
      
      <Button 
        type="submit" 
        disabled={isLoading}
        className="bg-custom-accent text-white hover:bg-custom-accent/90 focus:ring-2 focus:ring-custom-accent focus:ring-offset-2"
      >
        {isLoading ? 'Creating...' : 'Create Ticket'}
      </Button>
    </form>
  )
} 