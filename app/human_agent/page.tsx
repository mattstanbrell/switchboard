import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { HumanAgentDashboard } from '@/components/human-agent/dashboard'

interface Ticket {
  id: number
  subject: string
  status: string
  created_at: string
  focus_area_id: number
  focus_areas: Array<{
    id: number
    name: string
  }>
}

export default async function HumanAgentPage() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/')
  }

  // Get agent's profile including team_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      team_id,
      teams (
        id,
        name,
        team_focus_areas (
          focus_area_id,
          focus_areas (
            id,
            name
          )
        )
      )
    `)
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Profile fetch error:', profileError)
    throw profileError
  }

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

    if (ticketsError) {
      console.error('Tickets fetch error:', ticketsError)
      throw ticketsError
    }

    tickets = (ticketsData as Ticket[]) || []
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Human Agent Dashboard</h1>
      <p className="text-xl mb-8">Hello, {profile?.full_name}</p>
      
      {profile?.team_id ? (
        <HumanAgentDashboard 
          profile={profile}
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