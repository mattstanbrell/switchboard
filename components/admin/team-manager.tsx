'use client'

import type { Database } from '@/database.types'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, Users } from 'lucide-react'
import { MultiSelect } from '@/components/ui/multi-select'
import { FocusAreaPill } from "@/components/ui/focus-area-pill"

type Tables = Database['public']['Tables']
type FocusArea = Tables['focus_areas']['Row']
type Profile = Tables['profiles']['Row']
type BaseTeam = Tables['teams']['Row']

interface TeamWithRelations extends BaseTeam {
  profiles: Array<Pick<Profile, 'id' | 'full_name'>>
  team_focus_areas: Array<{
    focus_area_id: number
  }>
}

interface Props {
  companyId: string
  focusAreas: FocusArea[]
  agents: Profile[]
  initialTeams: TeamWithRelations[]
  onTeamsChange: (teams: TeamWithRelations[]) => void
  onAgentsChange: (agents: Profile[]) => void
}

export function TeamManager({ 
  companyId, 
  focusAreas, 
  agents, 
  initialTeams,
  onTeamsChange,
  onAgentsChange
}: Props) {
  console.log('TeamManager mounted with:', {
    companyId,
    focusAreasCount: focusAreas.length,
    agentsCount: agents.length,
    agents,
    teamsCount: initialTeams.length
  })

  const [teams, setTeams] = useState<TeamWithRelations[]>(initialTeams)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Filter out focus areas that are already assigned to teams
  const availableFocusAreas = focusAreas.filter(area => 
    !teams.some(team => 
      team.team_focus_areas.some(fa => fa.focus_area_id === area.id)
    )
  )
  console.log('Available focus areas:', {
    total: focusAreas.length,
    available: availableFocusAreas.length,
    areas: availableFocusAreas
  })

  // Filter out agents that are already in teams
  const availableAgents = agents.filter(agent => !agent.team_id)
  console.log('Available agents:', {
    total: agents.length,
    available: availableAgents.length,
    agents: availableAgents
  })

  const handleFocusAreasChange = (values: string[]) => {
    console.log('Focus areas changed:', values)
    setSelectedFocusAreas(values || [])
  }

  const handleAgentsChange = (values: string[]) => {
    console.log('Agents changed:', values)
    setSelectedAgents(values || [])
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return
    if (selectedFocusAreas.length === 0) {
      setError('Please select at least one focus area')
      return
    }
    if (selectedAgents.length === 0) {
      setError('Please select at least one team member')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()

      // Create the team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{ 
          name: newTeamName.trim(), 
          company_id: companyId 
        }])
        .select()
        .single()

      if (teamError) throw teamError

      // Add focus areas
      const { error: focusAreasError } = await supabase
        .from('team_focus_areas')
        .insert(
          selectedFocusAreas.map(faId => ({
            team_id: team.id,
            focus_area_id: parseInt(faId)
          }))
        )

      if (focusAreasError) throw focusAreasError

      // Get the current user
      const { data: authData, error: userError } = await supabase.auth.getUser()
      if (userError || !authData.user) throw new Error('Not authenticated')

      // Update agent profiles with team_id using RPC
      console.log('Attempting to assign agents to team:', {
        teamId: team.id,
        selectedAgents,
        adminId: authData.user.id
      });

      // Call RPC for each agent
      const assignmentPromises = selectedAgents.map(agentId => 
        supabase.rpc('assign_agent_to_team', {
          agent_id: agentId,
          team_id: team.id,
          admin_id: authData.user.id
        })
      );

      const results = await Promise.all(assignmentPromises);
      const errors = results.filter(r => r.error).map(r => r.error);

      if (errors.length > 0) {
        throw new Error('Failed to assign some agents to team');
      }

      // Fetch the complete new team data
      const { data: newTeam, error: fetchError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          company_id,
          profiles (id, full_name),
          team_focus_areas (focus_area_id)
        `)
        .eq('id', team.id)
        .single()

      if (fetchError) throw fetchError

      // Update local state
      const updatedTeams = [...teams, newTeam as TeamWithRelations]
      setTeams(updatedTeams)
      onTeamsChange(updatedTeams)

      // Update agents state
      const updatedAgents = agents.map(agent => 
        selectedAgents.includes(agent.id) 
          ? { ...agent, team_id: team.id }
          : agent
      )
      onAgentsChange(updatedAgents)

      setNewTeamName('')
      setSelectedFocusAreas([])
      setSelectedAgents([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTeam = async (teamId: number) => {
    console.log('Starting team deletion process:', { teamId });
    setError(null)
    
    try {
      const supabase = createClient()
      
      // First update the agents to remove team_id
      console.log('Attempting to unassign agents from team:', { teamId });
      const { data: unassignData, error: agentsError } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', teamId)
        .select()

      console.log('Unassign agents result:', { 
        success: !agentsError,
        error: agentsError?.message,
        affectedAgents: unassignData?.length,
        data: unassignData
      });

      if (agentsError) throw agentsError

      // Then delete the team (team_focus_areas will be deleted by FK cascade)
      console.log('Attempting to delete team:', { teamId });
      const { data: deleteData, error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)
        .select()

      console.log('Delete team result:', {
        success: !deleteError,
        error: deleteError?.message,
        data: deleteData
      });

      if (deleteError) throw deleteError
      
      // Update local state
      console.log('Updating local state after successful deletion');
      const updatedTeams = teams.filter(team => team.id !== teamId)
      setTeams(updatedTeams)
      onTeamsChange(updatedTeams)

      // Update agents state
      const updatedAgents = agents.map(agent => 
        agent.team_id === teamId 
          ? { ...agent, team_id: null }
          : agent
      )
      onAgentsChange(updatedAgents)
      console.log('Local state updated successfully');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to delete team';
      console.error('Team deletion failed:', {
        error: e,
        message: errorMessage,
        teamId
      });
      setError(errorMessage)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Teams</h2>
        <p className="text-muted-foreground mb-6">
          Create and manage teams of agents to handle specific focus areas.
        </p>
      </div>

      <form onSubmit={handleCreateTeam} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="teamName">Team Name</Label>
          <Input
            id="teamName"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Enter team name"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Focus Areas</Label>
          <MultiSelect
            options={availableFocusAreas.map(area => ({
              value: area.id.toString(),
              label: area.name || ''
            }))}
            selected={selectedFocusAreas || []}
            onChange={handleFocusAreasChange}
            placeholder="Select focus areas"
          />
        </div>

        <div className="space-y-2">
          <Label>Team Members</Label>
          <MultiSelect
            options={availableAgents.map(agent => ({
              value: agent.id,
              label: agent.full_name || ''
            }))}
            selected={selectedAgents || []}
            onChange={handleAgentsChange}
            placeholder="Select team members"
          />
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isLoading || !newTeamName.trim() || selectedFocusAreas.length === 0 || selectedAgents.length === 0}
        >
          Create Team
        </Button>
      </form>

      <div className="space-y-4">
        {teams.map((team) => (
          <div 
            key={team.id}
            className="p-4 border rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{team.name}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteTeam(team.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <div className="flex flex-wrap gap-1">
                {team.profiles.map((agent) => (
                  <Badge key={agent.id} variant="secondary">
                    {agent.full_name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {team.team_focus_areas.map((fa) => {
                const area = focusAreas.find(a => a.id === fa.focus_area_id)
                return area ? (
                  <FocusAreaPill key={area.id} name={area.name} />
                ) : null
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 