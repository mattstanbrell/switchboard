import type { FocusArea, Ticket, Team, Profile } from '@/components/human-agent/dashboard'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { HumanAgentDashboard } from '@/components/human-agent/dashboard'

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
        team_focus_areas!inner (
          focus_area_id,
          focus_areas!inner (
            id,
            name
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

  // Debug team data
  console.log('Team data:', {
    teamId: profile?.team_id,
    team: profile?.teams,
    focusAreas: ((profile?.teams as unknown) as Team)?.team_focus_areas?.map((tfa: { focus_area_id: number; focus_areas: FocusArea }) => ({
      focusAreaId: tfa.focus_area_id,
      focusArea: tfa.focus_areas
    }))
  })

  // Only fetch tickets if the agent is assigned to a team
  let tickets: Ticket[] = []
  if (profile?.team_id) {
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        subject,
        status,
        created_at,
        focus_area_id,
        focus_areas (
          id,
          name
        )
      `)
      .eq('team_id', profile.team_id)
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

    tickets = (ticketsData as unknown as Ticket[]) || []
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Human Agent Dashboard</h1>
      <p className="text-xl mb-8">Hello, {profile?.full_name}</p>
      
      {profile?.team_id ? (
        <HumanAgentDashboard 
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            team_id: profile.team_id,
            teams: (profile.teams as unknown) as Team
          }}
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