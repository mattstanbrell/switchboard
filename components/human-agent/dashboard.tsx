'use client'

import type { Database } from '@/database.types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentConversationPanel } from './conversation-panel'
import { useState } from 'react'
import { ResizableLayout } from '@/components/shared/resizable-layout'
import { cn } from '@/lib/utils'
import { PrioritySelect } from '@/components/priority-select'

type Tables = Database['public']['Tables']

export type FocusArea = Tables['focus_areas']['Row']
export type Ticket = Tables['tickets']['Row'] & {
  focus_areas: FocusArea
  priority: 'Low' | 'Medium' | 'High'
}
export type Team = Tables['teams']['Row'] & {
  team_focus_areas: Array<{
    focus_area_id: number
    focus_areas: FocusArea
  }>
}
export type Profile = Tables['profiles']['Row'] & {
  teams: Team
}

interface Props {
  profile: Profile
  tickets: Ticket[]
}

export function HumanAgentDashboard({ profile, tickets }: Props) {
  const team = profile.teams
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const ticketTable = (
    <div className="h-full flex flex-col">
      <div className="relative flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px]">
          <div className="sticky top-0 h-10 bg-custom-background border-b border-custom-ui-medium">
            <div className="grid grid-cols-10 h-full px-6">
              <div className="col-span-1 flex items-center font-medium text-custom-text">ID</div>
              <div className="col-span-2 flex items-center font-medium text-custom-text">Subject</div>
              <div className="col-span-2 flex items-center font-medium text-custom-text">Focus Area</div>
              <div className="col-span-2 flex items-center font-medium text-custom-text">Priority</div>
              <div className="col-span-2 flex items-center font-medium text-custom-text">Status</div>
              <div className="col-span-1 flex items-center font-medium text-custom-text">Created</div>
            </div>
          </div>
          <div>
            {tickets.length === 0 ? (
              <div className="px-6 py-4 text-center text-custom-text-secondary">
                No tickets assigned to your team.
              </div>
            ) : (
              tickets.map((ticket) => (
                <div 
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    "border-b border-custom-ui-medium hover:bg-custom-background-secondary transition-colors cursor-pointer",
                    selectedTicket?.id === ticket.id && "bg-custom-ui-faint hover:bg-custom-ui-faint"
                  )}
                >
                  <div className="grid grid-cols-10 px-6 py-4">
                    <div className="col-span-1 flex items-center text-custom-text">
                      #{ticket.id}
                    </div>
                    <div className="col-span-2 flex items-center text-custom-text">
                      {ticket.subject}
                    </div>
                    <div className="col-span-2 flex items-center">
                      <Badge variant="secondary">
                        {ticket.focus_areas.name}
                      </Badge>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <PrioritySelect ticket={ticket} />
                    </div>
                    <div className="col-span-2 flex items-center">
                      <Badge variant="outline">
                        {ticket.status}
                      </Badge>
                    </div>
                    <div className="col-span-1 flex items-center text-custom-text-secondary">
                      {new Date(ticket.created_at).toISOString().split('T')[0]}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const conversationPanel = selectedTicket ? (
    <AgentConversationPanel 
      ticket={selectedTicket}
      onClose={() => setSelectedTicket(null)}
    />
  ) : undefined

  return (
    <div className="flex flex-col h-screen bg-custom-background">
      {/* Header */}
      <header className="border-b border-custom-ui-medium">
        <div className="flex justify-between items-center p-8">
          <div>
            <h1 className="text-2xl font-bold text-custom-text">Human Agent Dashboard</h1>
            <p className="text-custom-text-secondary">Hi, {profile.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-custom-text-secondary">Team:</span>
            <span className="text-custom-text font-medium">{team?.name}</span>
          </div>
        </div>
      </header>

      <ResizableLayout 
        mainContent={ticketTable}
        sideContent={conversationPanel}
      />
    </div>
  )
} 