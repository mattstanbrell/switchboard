import type { Database } from '@/database.types'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './dashboard'

type Tables = Database['public']['Tables']
type Profile = Tables['profiles']['Row']
type FocusArea = Tables['focus_areas']['Row']
type BaseTeam = Tables['teams']['Row']
type BaseFieldDefinition = Tables['field_definitions']['Row']
type Ticket = Tables['tickets']['Row'] & {
  customer: Pick<Profile, 'company_id'>
}

interface TeamWithRelations extends BaseTeam {
  profiles: Array<Pick<Profile, 'id' | 'full_name'>>
  team_focus_areas: Array<{
    focus_area_id: number
  }>
}

interface FieldOption {
  label: string
  value: string
}

type FieldDefinitionWithOptions = BaseFieldDefinition & {
  options: FieldOption[] | null
}

interface AdminProfile {
  full_name: string
  company_id: string
}

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
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin' || !profile.company_id) {
    console.error('Profile fetch error:', profileError)
    redirect('/login')
  }
  console.log('Admin profile:', { profile })

  const { data: focusAreas, error: focusAreasError } = await supabase
    .from('focus_areas')
    .select('*')
    .eq('company_id', profile.company_id)

  if (focusAreasError) {
    console.error('Focus areas fetch error:', focusAreasError)
    throw focusAreasError
  }
  console.log('Focus areas:', { focusAreas })

  // Get all human agents in the company, including their team_id
  console.log('Fetching agents with query:', {
    company_id: profile.company_id,
    role: 'human_agent'
  })

  const { data: agents, error: agentsError } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', profile.company_id)
    .eq('role', 'human_agent')

  if (agentsError) {
    console.error('Agents fetch error:', agentsError)
    throw agentsError
  }

  console.log('Human agents result:', { 
    count: agents?.length,
    agents,
    query: {
      company_id: profile.company_id,
      role: 'human_agent'
    }
  })

  // Get existing teams with their members and focus areas
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      *,
      profiles!team_id(id, full_name),
      team_focus_areas(focus_area_id)
    `)
    .eq('company_id', profile.company_id)

  if (teamsError) {
    console.error('Teams fetch error:', teamsError)
    throw teamsError
  }
  console.log('Teams:', { teams })

  // Get field definitions for this company
  const { data: fieldDefinitions, error: fieldDefinitionsError } = await supabase
    .from('field_definitions')
    .select('*')
    .eq('company_id', profile.company_id)

  if (fieldDefinitionsError) {
    console.error('Field definitions fetch error:', fieldDefinitionsError)
    throw fieldDefinitionsError
  }
  console.log('Field definitions:', { fieldDefinitions })

  // Get tickets for the company
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      *,
      customer:customer_id(company_id)
    `)
    .eq('customer.company_id', profile.company_id)

  if (ticketsError) {
    console.error('Tickets fetch error:', ticketsError)
    throw ticketsError
  }
  console.log('Tickets:', { tickets })

  if (!profile.full_name) {
    throw new Error('Invalid admin profile')
  }

  const adminProfile: AdminProfile = {
    full_name: profile.full_name,
    company_id: profile.company_id
  }

  const dashboardProps = {
    initialProfile: adminProfile,
    initialFocusAreas: (focusAreas || []) as FocusArea[],
    initialAgents: (agents || []) as Profile[],
    initialTeams: (teams || []) as TeamWithRelations[],
    initialFieldDefinitions: (fieldDefinitions || []).map(fd => ({
      ...fd,
      options: fd.options as FieldOption[] | null
    })) as FieldDefinitionWithOptions[],
    initialTickets: (tickets || []) as unknown as Ticket[]
  }
  console.log('Passing to dashboard:', dashboardProps)

  return (
    <AdminDashboard {...dashboardProps} />
  )
} 