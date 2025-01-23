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

type Tables = Database['public']['Tables']

export type FocusArea = Tables['focus_areas']['Row']
export type Ticket = Tables['tickets']['Row'] & {
  focus_areas: FocusArea
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
    <Table>
      <TableHeader className="sticky top-0 bg-custom-background z-10">
        <TableRow className="hover:bg-custom-background">
          <TableHead className="text-custom-text">ID</TableHead>
          <TableHead className="text-custom-text">Subject</TableHead>
          <TableHead className="text-custom-text">Focus Area</TableHead>
          <TableHead className="text-custom-text">Status</TableHead>
          <TableHead className="text-custom-text">Created</TableHead>
          <TableHead className="text-custom-text">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-custom-text-secondary">
              No tickets assigned to your team.
            </TableCell>
          </TableRow>
        ) : (
          tickets.map((ticket) => (
            <TableRow 
              key={ticket.id}
              className={
                selectedTicket?.id === ticket.id 
                  ? "bg-custom-ui-faint hover:bg-custom-ui-faint" 
                  : "hover:bg-custom-background-secondary"
              }
            >
              <TableCell className="text-custom-text">#{ticket.id}</TableCell>
              <TableCell className="text-custom-text">{ticket.subject}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {ticket.focus_areas.name}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {ticket.status}
                </Badge>
              </TableCell>
              <TableCell className="text-custom-text-secondary">
                {new Date(ticket.created_at).toISOString().split('T')[0]}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-custom-background border-custom-ui-medium hover:bg-custom-ui-faint text-custom-text"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
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