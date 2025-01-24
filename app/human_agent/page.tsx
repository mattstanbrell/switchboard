import type { Database } from '@/database.types'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { HumanAgentDashboard } from '@/components/human-agent/dashboard'

type Tables = Database['public']['Tables']
type Profile = Tables['profiles']['Row']
type Team = Tables['teams']['Row']
type FocusArea = Tables['focus_areas']['Row']

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
  focus_areas: FocusArea
  ticket_fields: TicketField[]
  status: 'New' | 'Open' | 'Resolved' | 'Closed'
}

// Helper function to capitalize first letter
function capitalizeStatus(status: string): 'New' | 'Open' | 'Resolved' | 'Closed' {
  return (status.charAt(0).toUpperCase() + status.slice(1)) as 'New' | 'Open' | 'Resolved' | 'Closed'
}

interface TeamWithRelations extends Team {
  team_focus_areas: Array<{
    focus_area_id: number
    focus_areas: FocusArea
  }>
}

interface ProfileWithTeam extends Profile {
  teams: TeamWithRelations
}

interface RawProfile {
  id: string
  full_name: string | null
  team_id: number | null
  teams: {
    id: number
    name: string
    company_id: string
    team_focus_areas: Array<{
      focus_area_id: number
      focus_areas: FocusArea
    }>
  }
}

interface RawTicket {
  id: number
  subject: string
  status: 'new' | 'open' | 'resolved' | 'closed'
  created_at: string
  focus_area_id: number | null
  customer_id: string
  human_agent_id: string | null
  team_id: number | null
  priority: 'Low' | 'Medium' | 'High'
  resolved_at: string | null
  closed_at: string | null
  focus_areas: FocusArea
  ticket_fields: Array<{
    value: string | null
    field_definition: FieldDefinition
  }>
}

export default async function HumanAgentPage() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('Auth error:', userError)
    redirect('/')
  }

  // Get agent's profile including team_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      team_id,
      teams!inner (
        id,
        name,
        company_id,
        team_focus_areas!inner (
          focus_area_id,
          focus_areas!inner (
            id,
            name,
            company_id
          )
        )
      )
    `)
    .eq('id', user.id)
    .single()

  console.log('=== PROFILE DATA ===')
  console.log(JSON.stringify({
    profile,
    error: profileError?.message,
    details: profileError?.details,
    hint: profileError?.hint
  }, null, 2))

  if (profileError) {
    console.error('Profile fetch error:', profileError)
    throw profileError
  }

  const typedProfile = profile as unknown as RawProfile
  const profileWithTeam: ProfileWithTeam = {
    ...typedProfile,
    avatar_url: null,
    company_id: typedProfile.teams.company_id,
    last_seen: null,
    role: 'human_agent',
    teams: typedProfile.teams
  }

  // Debug team data
  console.log('Team data:', {
    teamId: profileWithTeam?.team_id,
    team: profileWithTeam?.teams,
    focusAreas: ((profileWithTeam?.teams as unknown) as TeamWithRelations)?.team_focus_areas?.map((tfa: { focus_area_id: number; focus_areas: FocusArea }) => ({
      focusAreaId: tfa.focus_area_id,
      focusArea: tfa.focus_areas
    }))
  })

  // Only fetch tickets if the agent is assigned to a team
  let tickets: Ticket[] = []
  if (profileWithTeam?.team_id) {
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        status,
        created_at,
        focus_area_id,
        customer_id,
        human_agent_id,
        team_id,
        priority,
        resolved_at,
        closed_at,
        focus_areas!inner (
          id,
          name,
          company_id
        ),
        ticket_fields (
          value,
          field_definition: field_definitions (
            id,
            name,
            label,
            field_type,
            is_required,
            allows_multiple,
            options
          )
        )
      `)
      .eq('team_id', profileWithTeam.team_id)
      .order('priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    console.log('=== TICKETS DATA ===')
    console.log(JSON.stringify({
      ticketsData,
      error: ticketsError?.message,
      details: ticketsError?.details,
      hint: ticketsError?.hint
    }, null, 2))

    if (ticketsError) {
      console.error('Tickets fetch error:', ticketsError)
      throw ticketsError
    }

    tickets = (ticketsData as unknown as RawTicket[]).map(ticket => ({
      ...ticket,
      focus_areas: ticket.focus_areas,
      status: capitalizeStatus(ticket.status)
    }))
  }

  return (
    <div className="min-h-screen">
      {profileWithTeam?.team_id ? (
        <HumanAgentDashboard 
          profile={profileWithTeam}
          tickets={tickets}
        />
      ) : (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg">
          You are not currently assigned to any team. Please contact your administrator.
        </div>
      )}
    </div>
  )
} 