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
import { useState, useEffect } from 'react'
import { ResizableLayout } from '@/components/shared/resizable-layout'
import { cn } from '@/lib/utils'
import { PrioritySelect } from '@/components/priority-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Filter } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { StatusBadge, Status } from '@/components/status-badge'
import { createClient } from '@/utils/supabase/client'
import { FocusAreaPill } from "@/components/ui/focus-area-pill"

type Tables = Database['public']['Tables']

interface FieldDefinition {
  id: number
  name: string
  label: string
  field_type: string
  is_required: boolean
  allows_multiple: boolean
  options: any[] | null
}

interface TicketField {
  value: string | null
  field_definition: FieldDefinition
}

export type FocusArea = Tables['focus_areas']['Row']
export type Ticket = Tables['tickets']['Row'] & {
  focus_areas: FocusArea
  priority: 'Low' | 'Medium' | 'High'
  status: 'New' | 'Open' | 'Resolved' | 'Closed'
  ticket_fields: TicketField[]
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

export function HumanAgentDashboard({ profile, tickets: initialTickets }: Props) {
  const team = profile.teams
  const [tickets, setTickets] = useState(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [focusAreaOpen, setFocusAreaOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    
    // Set up real-time subscription for ticket updates
    const channel = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets'
        },
        async (payload) => {
          // Fetch the complete ticket data including focus_areas
          const { data: updatedTicket } = await supabase
            .from('tickets')
            .select(`
              *,
              focus_areas (*)
            `)
            .eq('id', payload.new.id)
            .single()

          if (updatedTicket) {
            // Update tickets list
            setTickets(prev => prev.map(t => 
              t.id === updatedTicket.id ? (updatedTicket as Ticket) : t
            ))
            // Update selected ticket if it's the one that changed
            if (selectedTicket?.id === updatedTicket.id) {
              setSelectedTicket(updatedTicket as Ticket)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedTicket?.id])

  // Get unique focus areas and statuses
  const uniqueFocusAreas = Array.from(new Set(tickets.map(t => t.focus_areas.name)))
  const uniqueStatuses = Array.from(new Set(tickets.map(t => t.status.toLowerCase()))) as Status[]

  // Filter tickets based on selected filters
  const filteredTickets = tickets.filter(ticket => {
    const focusAreaMatch = selectedFocusAreas.length === 0 || selectedFocusAreas.includes(ticket.focus_areas.name)
    const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(ticket.status.toLowerCase())
    return focusAreaMatch && statusMatch
  })

  const ticketTable = (
    <div className="h-full flex flex-col">
      <div className="relative flex-1 overflow-auto">
        <div className="sticky top-0 h-10 bg-custom-background-secondary border-b border-custom-ui-medium w-full">
          <div className="mx-auto max-w-[1400px] h-full">
            <div className="grid grid-cols-9 h-full px-6">
              <div className="col-span-2 flex items-center font-semibold text-custom-text text-xs uppercase">Subject</div>
              <div className="col-span-2 flex items-center font-semibold text-custom-text text-xs uppercase gap-2">
                Focus Area
                <Select open={focusAreaOpen} onOpenChange={setFocusAreaOpen}>
                  <SelectTrigger className="h-7 w-7 p-0 border-0 shadow-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 [&>span]:hidden [&>svg:not(.filter-icon)]:hidden">
                    <Filter className={cn(
                      "h-4 w-4 transition-colors filter-icon",
                      selectedFocusAreas.length > 0 ? "text-custom-accent" : "text-custom-text-secondary hover:text-custom-text"
                    )} />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueFocusAreas.map((area) => (
                      <div key={area} className="flex items-center space-x-2 p-2">
                        <Checkbox
                          id={area}
                          checked={selectedFocusAreas.includes(area)}
                          onCheckedChange={(checked: boolean | 'indeterminate') => {
                            setSelectedFocusAreas(prev => 
                              checked === true
                                ? [...prev, area]
                                : prev.filter(a => a !== area)
                            )
                          }}
                        />
                        <label htmlFor={area} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {area}
                        </label>
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center font-semibold text-custom-text text-xs uppercase">Priority</div>
              <div className="col-span-2 flex items-center font-semibold text-custom-text text-xs uppercase gap-2">
                Status
                <Select open={statusOpen} onOpenChange={setStatusOpen}>
                  <SelectTrigger className="h-7 w-7 p-0 border-0 shadow-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 [&>span]:hidden [&>svg:not(.filter-icon)]:hidden">
                    <Filter className={cn(
                      "h-4 w-4 transition-colors filter-icon",
                      selectedStatuses.length > 0 ? "text-custom-accent" : "text-custom-text-secondary hover:text-custom-text"
                    )} />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueStatuses.map((status) => (
                      <div key={status} className="flex items-center space-x-2 p-2">
                        <Checkbox
                          id={status}
                          checked={selectedStatuses.includes(status)}
                          onCheckedChange={(checked: boolean | 'indeterminate') => {
                            setSelectedStatuses(prev => 
                              checked === true
                                ? [...prev, status]
                                : prev.filter(s => s !== status)
                            )
                          }}
                        />
                        <label htmlFor={status} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {status}
                        </label>
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex items-center font-semibold text-custom-text text-xs uppercase">Created</div>
            </div>
          </div>
        </div>
        {filteredTickets.length === 0 ? (
          <div className="w-full bg-custom-background border-b border-custom-ui-medium">
            <div className="mx-auto max-w-[1400px]">
              <div className="px-6 py-4 text-center text-custom-text-secondary">
                No tickets match the selected filters.
              </div>
            </div>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div 
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className={cn(
                "w-full border-b border-custom-ui-medium hover:bg-custom-background-secondary transition-colors cursor-pointer",
                selectedTicket?.id === ticket.id && "bg-custom-ui-faint hover:bg-custom-ui-faint"
              )}
            >
              <div className="mx-auto max-w-[1400px]">
                <div className="grid grid-cols-9 px-6 py-4">
                  <div className="col-span-2 flex items-center text-custom-text-secondary">
                    {ticket.ticket_fields?.find(f => f.field_definition.name === 'subject')?.value || 'No Subject'}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <FocusAreaPill name={ticket.focus_areas.name} />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <PrioritySelect ticket={ticket} />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <StatusBadge status={ticket.status.toLowerCase() as Status} />
                  </div>
                  <div className="col-span-1 flex items-center text-custom-text-secondary text-sm">
                    {new Date(ticket.created_at).toISOString().split('T')[0].replace(/-/g, '/')}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
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