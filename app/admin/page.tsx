import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './dashboard'

export default async function AdminPage() {
  console.log('Starting AdminPage data fetch...')
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('Auth error:', userError)
    redirect('/')
  }
  console.log('Authenticated user:', user.id)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, company_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Profile fetch error:', profileError)
    throw profileError
  }
  console.log('Admin profile:', { profile })

  const { data: focusAreas, error: focusAreasError } = await supabase
    .from('focus_areas')
    .select('id, name')
    .eq('company_id', profile?.company_id)
    .order('name')

  if (focusAreasError) {
    console.error('Focus areas fetch error:', focusAreasError)
    throw focusAreasError
  }
  console.log('Focus areas:', { focusAreas })

  // Get all human agents in the company, including their team_id
  console.log('Fetching agents with query:', {
    company_id: profile?.company_id,
    role: 'human_agent'
  })

  const { data: agents, error: agentsError } = await supabase
    .rpc('get_company_profiles', {
      company_id_input: profile?.company_id
    })
    .eq('role', 'human_agent')
    .order('full_name')

  if (agentsError) {
    console.error('Agents fetch error:', agentsError)
    throw agentsError
  }

  console.log('Human agents result:', { 
    count: agents?.length,
    agents,
    query: {
      company_id: profile?.company_id,
      role: 'human_agent'
    }
  })

  // Get existing teams with their members and focus areas
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      profiles (
        id,
        full_name
      ),
      team_focus_areas (
        focus_area_id
      )
    `)
    .eq('company_id', profile?.company_id)

  if (teamsError) {
    console.error('Teams fetch error:', teamsError)
    throw teamsError
  }
  console.log('Teams:', { teams })

  const dashboardProps = {
    initialProfile: profile!,
    initialFocusAreas: focusAreas || [],
    initialAgents: agents || [],
    initialTeams: teams || []
  }
  console.log('Passing to dashboard:', dashboardProps)

  return (
    <AdminDashboard {...dashboardProps} />
  )
} 