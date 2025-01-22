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
  const focusAreas = team?.team_focus_areas.map(tfa => tfa.focus_areas) || []

  return (
    <div className="space-y-6">
      <div className="p-6 bg-card rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4">Team: {team?.name}</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="font-medium">Focus Areas:</span>
          {focusAreas.map((area) => (
            <Badge key={area.id} variant="outline">
              {area.name}
            </Badge>
          ))}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Focus Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No tickets assigned to your team.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>#{ticket.id}</TableCell>
                    <TableCell>{ticket.subject}</TableCell>
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
                    <TableCell className="text-muted-foreground">
                      {new Date(ticket.created_at).toISOString().split('T')[0]}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
} 