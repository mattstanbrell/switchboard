'use client'

import type { Database } from '@/database.types'
import { ConversationPanel } from '@/components/shared/conversation-panel'

type Tables = Database['public']['Tables']
type Ticket = Tables['tickets']['Row']

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function CustomerConversationPanel({ ticket, onClose }: Props) {
  return (
    <ConversationPanel
      ticket={ticket}
      onClose={onClose}
      variant="customer"
    />
  )
} 