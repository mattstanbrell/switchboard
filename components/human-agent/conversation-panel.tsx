'use client'

import type { Database } from '@/database.types'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ConversationPanel } from '@/components/shared/conversation-panel'

type Tables = Database['public']['Tables']
type Ticket = Tables['tickets']['Row']

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function AgentConversationPanel({ ticket: initialTicket, onClose }: Props) {
  const [ticket, setTicket] = useState(initialTicket)

  const handleOpenTicket = async () => {
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          status: 'open',
          human_agent_id: user.id 
        })
        .eq('id', ticket.id)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setTicket(data)
        
        // Add system message
        await supabase
          .from('messages')
          .insert({
            ticket_id: ticket.id,
            content: 'Ticket opened by support agent',
            sender_id: user.id,
            type: 'system'
          })
      }
    } catch (error) {
      console.error('Failed to open ticket:', error)
    }
  }

  const handleResolveTicket = async () => {
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', ticket.id)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setTicket(data)
        
        // Add system message
        await supabase
          .from('messages')
          .insert({
            ticket_id: ticket.id,
            content: 'Ticket marked as resolved. You have 1 minute to reply if you still need assistance.',
            sender_id: user.id,
            type: 'system'
          })

        // Schedule auto-close job
        const jobName = `auto-close-ticket-${ticket.id}-${Date.now()}`
        const { error: scheduleError } = await supabase.rpc('schedule_auto_close', {
          job_name: jobName,
          ticket_id: ticket.id,
          agent_id: user.id,
          minutes_until_close: 1
        })

        if (scheduleError) {
          console.error('Failed to schedule auto-close:', scheduleError)
        }
      }
    } catch (error) {
      console.error('Failed to resolve ticket:', error)
    }
  }

  const handleCloseTicket = async () => {
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', ticket.id)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setTicket(data)
        
        // Add system message
        await supabase
          .from('messages')
          .insert({
            ticket_id: ticket.id,
            content: 'Ticket closed',
            sender_id: user.id,
            type: 'system'
          })
      }
    } catch (error) {
      console.error('Failed to close ticket:', error)
    }
  }

  return (
    <ConversationPanel
      ticket={ticket}
      onClose={onClose}
      variant="agent"
      onOpenTicket={handleOpenTicket}
      onResolveTicket={handleResolveTicket}
      onCloseTicket={handleCloseTicket}
    />
  )
} 