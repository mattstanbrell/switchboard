'use client'

import type { Database } from '@/database.types'
import { useState, useEffect } from 'react'
import { FocusAreaManager } from '@/components/admin/focus-area-manager'
import { TeamManager } from '@/components/admin/team-manager'
import { AgentRegistration } from '@/components/admin/agent-registration'
import { FieldDefinitionManager } from '@/components/admin/field-definition-manager'
import { createClient } from '@/utils/supabase/client'

type Tables = Database['public']['Tables']
type Profile = Tables['profiles']['Row']
type FocusArea = Tables['focus_areas']['Row']
type BaseTeam = Tables['teams']['Row']
type BaseFieldDefinition = Tables['field_definitions']['Row']

interface FieldOption {
  label: string
  value: string
}

interface FieldDefinition extends Omit<BaseFieldDefinition, 'options'> {
  options: FieldOption[] | null
}

interface TeamWithRelations extends BaseTeam {
  profiles: Array<Pick<Profile, 'id' | 'full_name'>>
  team_focus_areas: Array<{
    focus_area_id: number
  }>
}

interface AdminProfile {
  full_name: string
  company_id: string
}

interface Props {
  initialProfile: AdminProfile
  initialFocusAreas: FocusArea[]
  initialAgents: Profile[]
  initialTeams: TeamWithRelations[]
  initialFieldDefinitions: FieldDefinition[]
}

export default function AdminDashboard({ 
  initialProfile,
  initialFocusAreas,
  initialAgents,
  initialTeams,
  initialFieldDefinitions
}: Props) {
  const [focusAreas, setFocusAreas] = useState(initialFocusAreas)
  const [agents, setAgents] = useState(initialAgents)
  const [teams, setTeams] = useState(initialTeams)
  const [fieldDefinitions, setFieldDefinitions] = useState(initialFieldDefinitions)

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to changes in the profiles table
    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `company_id=eq.${initialProfile.company_id}`
        },
        async () => {
          // Fetch the updated list of agents
          const { data: updatedAgents } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', initialProfile.company_id)
            .eq('role', 'human_agent')
          
          if (updatedAgents) {
            setAgents(updatedAgents)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initialProfile.company_id])

  // Get agents not in any team
  const unassignedAgents = agents.filter(agent => !agent.team_id)

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
      <p className="text-xl mb-8">Hello, {initialProfile.full_name}</p>
      
      <div className="grid gap-8 max-w-4xl">
        <div className="p-6 bg-card rounded-lg shadow">
          <AgentRegistration companyId={initialProfile.company_id} />
        </div>

        <div className="p-6 bg-card rounded-lg shadow">
          <FocusAreaManager 
            initialFocusAreas={focusAreas} 
            companyId={initialProfile.company_id}
            onUpdate={setFocusAreas}
          />
        </div>

        <div className="p-6 bg-card rounded-lg shadow">
          <FieldDefinitionManager
            initialFieldDefinitions={fieldDefinitions}
            companyId={initialProfile.company_id}
            onUpdate={setFieldDefinitions}
          />
        </div>

        <div className="p-6 bg-card rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Unassigned Agents</h2>
          {unassignedAgents.length > 0 ? (
            <ul className="space-y-2">
              {unassignedAgents.map(agent => (
                <li key={agent.id} className="p-3 bg-muted rounded-lg">
                  {agent.full_name || 'Unnamed Agent'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              All agents are assigned to teams.
            </p>
          )}
        </div>

        <div className="p-6 bg-card rounded-lg shadow">
          <TeamManager
            companyId={initialProfile.company_id}
            focusAreas={focusAreas}
            agents={agents}
            initialTeams={teams}
            onTeamsChange={setTeams}
            onAgentsChange={setAgents}
          />
        </div>
      </div>
    </div>
  )
} 