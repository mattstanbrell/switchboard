'use client'

import type { Database } from '@/database.types'
import { ConversationPanel } from '@/components/shared/conversation-panel'

type Tables = Database['public']['Tables']

interface FieldDefinition {
  id: number
  name: string
  label: string
  field_type: string
  is_required: boolean
  allows_multiple: boolean
  options: Tables['field_definitions']['Row']['options']
}

interface TicketField {
  value: string | null
  field_definition: FieldDefinition
}

type Ticket = Tables['tickets']['Row'] & {
  ticket_fields: TicketField[]
  status: 'New' | 'Open' | 'Resolved' | 'Closed'
}

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