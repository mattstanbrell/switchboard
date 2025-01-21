'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface FocusArea {
  id: number
  name: string
}

interface Ticket {
  id: number
  subject: string
  status: string
  created_at: string
  focus_area_id: number
  focus_areas: Array<FocusArea>
}

interface Team {
  id: number
  name: string
  team_focus_areas: Array<{
    focus_area_id: number
    focus_areas: FocusArea[]
  }>
}

interface Profile {
  id: string
  full_name: string
  team_id: number
  teams: Team[]
}

interface Props {
  profile: Profile
  tickets: Ticket[]
}

export function HumanAgentDashboard({ profile, tickets }: Props) {
  const team = profile.teams[0]
  const focusAreas = team?.team_focus_areas.flatMap(tfa => tfa.focus_areas) || []

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
                        {ticket.focus_areas[0]?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()}
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