'use client'

import type { Database } from '@/database.types'
import { useState, useEffect } from 'react'
import { FocusAreaManager } from '@/components/admin/focus-area-manager'
import { TeamManager } from '@/components/admin/team-manager'
import { AgentRegistration } from '@/components/admin/agent-registration'
import { FieldDefinitionManager } from '@/components/admin/field-definition-manager'
import { createClient } from '@/utils/supabase/client'
import { Users, Settings, BarChart3, UserPlus, UsersRound, Target, ListPlus, UserCheck, UserX, MoreVertical, Pencil, Trash2, Search } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

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

interface NavItem {
  label: string
  icon: React.ReactNode
  id: string
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: <BarChart3 className="w-5 h-5" />, id: 'overview' },
  { label: 'Agent Management', icon: <Users className="w-5 h-5" />, id: 'agents' },
  { label: 'Configuration', icon: <Settings className="w-5 h-5" />, id: 'config' },
]

export default function AdminDashboard({ 
  initialProfile,
  initialFocusAreas,
  initialAgents,
  initialTeams,
  initialFieldDefinitions
}: Props) {
  console.log('Initial Data:', {
    teams: initialTeams,
    agents: initialAgents,
    teamAgentRelationship: initialAgents.map(agent => ({
      agentId: agent.id,
      agentName: agent.full_name,
      teamId: agent.team_id
    }))
  })

  const [activeSection, setActiveSection] = useState('overview')
  const [focusAreas, setFocusAreas] = useState(initialFocusAreas)
  const [agents, setAgents] = useState(initialAgents)
  const [teams, setTeams] = useState(initialTeams)
  const [fieldDefinitions, setFieldDefinitions] = useState(initialFieldDefinitions)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<number[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [isAssigningAgent, setIsAssigningAgent] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [editingTeam, setEditingTeam] = useState<TeamWithRelations | null>(null)
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [isDeletingTeam, setIsDeletingTeam] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [isBulkAssigning, setIsBulkAssigning] = useState(false)
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInitialMembers, setSelectedInitialMembers] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()

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
          console.log('Profile change detected')
          const { data: updatedAgents, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', initialProfile.company_id)
            .eq('role', 'human_agent')
          
          if (error) {
            console.error('Error fetching updated agents:', error)
            return
          }
          
          if (updatedAgents) {
            console.log('Updated Agents:', updatedAgents)
            setAgents(updatedAgents)
          }
        }
      )
      .subscribe()

    // Also fetch teams with their profiles
    const fetchTeams = async () => {
      const { data: fetchedTeams, error } = await supabase
        .from('teams')
        .select(`
          *,
          profiles!team_id(id, full_name),
          team_focus_areas(focus_area_id)
        `)
        .eq('company_id', initialProfile.company_id)

      if (error) {
        console.error('Error fetching teams:', error)
        return
      }

      if (fetchedTeams) {
        console.log('Fetched Teams:', fetchedTeams)
        setTeams(fetchedTeams)
      }
    }

    fetchTeams()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initialProfile.company_id])

  // Get agents not in any team
  const unassignedAgents = agents.filter(agent => !agent.team_id)

  useEffect(() => {
    console.log('Current State:', {
      teams,
      agents,
      unassignedAgents,
      teamAgentRelationship: agents.map(agent => ({
        agentId: agent.id,
        agentName: agent.full_name,
        teamId: agent.team_id
      }))
    })
  }, [teams, agents])

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    setIsCreatingTeam(true)

    try {
      const supabase = createClient()
      
      // Create new team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: newTeamName.trim(),
          company_id: initialProfile.company_id
        })
        .select()
        .single()

      if (teamError) throw teamError

      // Add focus areas
      if (selectedFocusAreas.length > 0) {
        const { error: focusAreaError } = await supabase
          .from('team_focus_areas')
          .insert(
            selectedFocusAreas.map(focusAreaId => ({
              team_id: team.id,
              focus_area_id: focusAreaId
            }))
          )

        if (focusAreaError) throw focusAreaError
      }

      // Assign selected members to the team
      if (selectedInitialMembers.length > 0) {
        const { error: memberError } = await supabase
          .from('profiles')
          .update({ team_id: team.id })
          .in('id', selectedInitialMembers)

        if (memberError) throw memberError
      }

      // Get the selected member profiles
      const selectedMemberProfiles = selectedInitialMembers
        .map(id => {
          const agent = agents.find(a => a.id === id)
          return agent ? { id: agent.id, full_name: agent.full_name } : null
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)

      // Add to local state
      const newTeam: TeamWithRelations = {
        ...team,
        profiles: selectedMemberProfiles,
        team_focus_areas: selectedFocusAreas.map(id => ({ focus_area_id: id }))
      }
      
      setTeams([...teams, newTeam])
      setNewTeamName('')
      setSelectedFocusAreas([])
      setSelectedInitialMembers([])
      setIsCreatingTeam(false)
    } catch (error) {
      console.error('Error creating team:', error)
      setIsCreatingTeam(false)
    }
  }

  const handleAssignAgent = async (agentId: string, teamId: number) => {
    if (!teamId) return
    setIsAssigningAgent(true)

    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .eq('id', agentId)

      if (error) throw error

      // Update local state
      const updatedAgents = agents.map(agent =>
        agent.id === agentId ? { ...agent, team_id: teamId } : agent
      )
      setAgents(updatedAgents)

      const updatedTeams = teams.map(team => {
        if (team.id === teamId) {
          const agent = agents.find(a => a.id === agentId)
          if (agent) {
            return {
              ...team,
              profiles: [...team.profiles, { id: agent.id, full_name: agent.full_name }]
            }
          }
        }
        return team
      })
      setTeams(updatedTeams)

      setSelectedTeamId(null)
      setSelectedAgentId('')
      setIsAssigningAgent(false)
    } catch (error) {
      console.error('Error assigning agent:', error)
      setIsAssigningAgent(false)
    }
  }

  const handleEditTeam = async () => {
    if (!editingTeam || !newTeamName.trim()) return
    setIsEditingTeam(true)

    try {
      const supabase = createClient()
      
      // Update team name
      const { error: teamError } = await supabase
        .from('teams')
        .update({ name: newTeamName.trim() })
        .eq('id', editingTeam.id)

      if (teamError) throw teamError

      // Delete existing focus areas
      const { error: deleteError } = await supabase
        .from('team_focus_areas')
        .delete()
        .eq('team_id', editingTeam.id)

      if (deleteError) throw deleteError

      // Add new focus areas
      if (selectedFocusAreas.length > 0) {
        const { error: focusAreaError } = await supabase
          .from('team_focus_areas')
          .insert(
            selectedFocusAreas.map(focusAreaId => ({
              team_id: editingTeam.id,
              focus_area_id: focusAreaId
            }))
          )

        if (focusAreaError) throw focusAreaError
      }

      // Update local state
      const updatedTeams = teams.map(team => {
        if (team.id === editingTeam.id) {
          return {
            ...team,
            name: newTeamName.trim(),
            team_focus_areas: selectedFocusAreas.map(id => ({ focus_area_id: id }))
          }
        }
        return team
      })
      
      setTeams(updatedTeams)
      setNewTeamName('')
      setSelectedFocusAreas([])
      setEditingTeam(null)
      setIsEditingTeam(false)
    } catch (error) {
      console.error('Error editing team:', error)
      setIsEditingTeam(false)
    }
  }

  const handleDeleteTeam = async (teamId: number) => {
    setIsDeletingTeam(true)

    try {
      const supabase = createClient()

      // First unassign all agents from the team
      const { error: unassignError } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', teamId)

      if (unassignError) throw unassignError

      // Delete team focus areas
      const { error: focusAreaError } = await supabase
        .from('team_focus_areas')
        .delete()
        .eq('team_id', teamId)

      if (focusAreaError) throw focusAreaError

      // Delete the team
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)

      if (teamError) throw teamError

      // Update local state
      setTeams(teams.filter(team => team.id !== teamId))
      setAgents(agents.map(agent => 
        agent.team_id === teamId ? { ...agent, team_id: null } : agent
      ))
      setIsDeletingTeam(false)
    } catch (error) {
      console.error('Error deleting team:', error)
      setIsDeletingTeam(false)
    }
  }

  const handleBulkAssign = async (teamId: number) => {
    if (!teamId || selectedAgents.length === 0) return
    setIsBulkAssigning(true)

    try {
      const supabase = createClient()
      
      // Update all selected agents
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .in('id', selectedAgents)

      if (error) throw error

      // Update local state
      const updatedAgents = agents.map(agent =>
        selectedAgents.includes(agent.id) ? { ...agent, team_id: teamId } : agent
      )
      setAgents(updatedAgents)

      // Update teams state
      const updatedTeams = teams.map(team => {
        if (team.id === teamId) {
          const newProfiles = selectedAgents.map(agentId => {
            const agent = agents.find(a => a.id === agentId)
            return agent ? { id: agent.id, full_name: agent.full_name } : null
          }).filter((p): p is NonNullable<typeof p> => p !== null)
          
          return {
            ...team,
            profiles: [...team.profiles, ...newProfiles]
          }
        }
        return team
      })
      setTeams(updatedTeams)

      setSelectedAgents([])
      setSelectedTeamId(null)
      setIsBulkAssigning(false)
      setShowBulkAssignDialog(false)
    } catch (error) {
      console.error('Error bulk assigning agents:', error)
      setIsBulkAssigning(false)
    }
  }

  const filteredUnassignedAgents = unassignedAgents.filter(agent => 
    agent.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
  )

  const QuickStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-card p-6 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <UsersRound className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Total Agents</h3>
            <p className="text-2xl font-bold">{agents.length}</p>
          </div>
        </div>
      </div>
      <div className="bg-card p-6 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Unassigned</h3>
            <p className="text-2xl font-bold">{unassignedAgents.length}</p>
          </div>
        </div>
      </div>
      <div className="bg-card p-6 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Focus Areas</h3>
            <p className="text-2xl font-bold">{focusAreas.length}</p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <QuickStats />
          </div>
        )
      case 'agents':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Agent Management</h2>
                <p className="text-muted-foreground">Manage your support team members and their assignments</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg">
                  <UserCheck className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{agents.length - unassignedAgents.length} Assigned</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg">
                  <UserX className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">{unassignedAgents.length} Unassigned</span>
                </div>
              </div>
            </div>

            <Tabs defaultValue="teams" className="space-y-4">
              <TabsList>
                <TabsTrigger value="teams">Teams</TabsTrigger>
                <TabsTrigger value="agents">Agents</TabsTrigger>
              </TabsList>

              <TabsContent value="teams" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {teams.map(team => (
                    <Card key={team.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{team.name}</h3>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingTeam(team)
                                    setNewTeamName(team.name)
                                    setSelectedFocusAreas(team.team_focus_areas.map(fa => fa.focus_area_id))
                                  }}
                                >
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit Team
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteTeam(team.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {team.profiles.length} members
                          </p>
                        </div>
                        <div className="flex -space-x-2">
                          {team.profiles.length > 0 ? (
                            <span className="text-sm text-muted-foreground">
                              {team.profiles.slice(0, 3).map(p => p.full_name).join(', ')}
                              {team.profiles.length > 3 && ` and ${team.profiles.length - 3} more`}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">No members</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm">Focus Areas:</div>
                        <div className="flex flex-wrap gap-2">
                          {team.team_focus_areas.map(({ focus_area_id }) => {
                            const area = focusAreas.find(a => a.id === focus_area_id)
                            return area ? (
                              <span key={area.id} className="px-2 py-1 text-xs rounded-full bg-primary/10">
                                {area.name}
                              </span>
                            ) : null
                          })}
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="p-6 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-3 rounded-full bg-muted">
                            <Users className="w-6 h-6" />
                          </div>
                          <span>Create New Team</span>
                        </div>
                      </Card>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Team</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="teamName">Team Name</Label>
                          <Input
                            id="teamName"
                            placeholder="Enter team name"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Focus Areas</Label>
                          {focusAreas.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {focusAreas.map(area => (
                                <button
                                  key={area.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedFocusAreas(prev =>
                                      prev.includes(area.id)
                                        ? prev.filter(id => id !== area.id)
                                        : [...prev, area.id]
                                    )
                                  }}
                                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedFocusAreas.includes(area.id)
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                >
                                  {area.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No focus areas available. Create some in the Configuration section.
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Team Members</Label>
                          {unassignedAgents.length > 0 ? (
                            <div className="space-y-3 max-h-[200px] overflow-y-auto">
                              {unassignedAgents.map(agent => (
                                <div
                                  key={agent.id}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                                >
                                  <Checkbox
                                    checked={selectedInitialMembers.includes(agent.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedInitialMembers(prev =>
                                        checked
                                          ? [...prev, agent.id]
                                          : prev.filter(id => id !== agent.id)
                                      )
                                    }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{agent.full_name ?? 'Unnamed Agent'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No unassigned agents available.
                            </p>
                          )}
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={handleCreateTeam}
                          disabled={!newTeamName.trim() || isCreatingTeam}
                        >
                          {isCreatingTeam ? 'Creating...' : 'Create Team'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Team Dialog */}
                  <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Team: {editingTeam?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="editTeamName">Team Name</Label>
                          <Input
                            id="editTeamName"
                            placeholder="Enter team name"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Focus Areas</Label>
                          <div className="flex flex-wrap gap-2">
                            {focusAreas.map(area => (
                              <button
                                key={area.id}
                                onClick={() => {
                                  setSelectedFocusAreas(prev =>
                                    prev.includes(area.id)
                                      ? prev.filter(id => id !== area.id)
                                      : [...prev, area.id]
                                  )
                                }}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                  selectedFocusAreas.includes(area.id)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                              >
                                {area.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={handleEditTeam}
                          disabled={!newTeamName.trim() || isEditingTeam}
                        >
                          {isEditingTeam ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </TabsContent>

              <TabsContent value="agents" className="space-y-6">
                <Card className="p-6">
                  <AgentRegistration companyId={initialProfile.company_id} />
                </Card>

                <div className="grid gap-6">
                  {unassignedAgents.length > 0 && (
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Unassigned Agents</h3>
                        <div className="flex items-center gap-3">
                          {selectedAgents.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="default" size="sm">
                                  Actions ({selectedAgents.length})
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setShowBulkAssignDialog(true)}>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Assign to Team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  placeholder="Search agents..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 w-[200px] sm:w-[300px]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-4">
                          <Checkbox
                            checked={selectedAgents.length === filteredUnassignedAgents.length && filteredUnassignedAgents.length > 0}
                            onCheckedChange={(checked) => {
                              setSelectedAgents(
                                checked 
                                  ? filteredUnassignedAgents.map(agent => agent.id)
                                  : []
                              )
                            }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {selectedAgents.length > 0 
                              ? `Selected ${selectedAgents.length} of ${filteredUnassignedAgents.length}`
                              : `Select all ${filteredUnassignedAgents.length} agents`
                            }
                          </span>
                        </div>

                        <div className="grid gap-3">
                          {filteredUnassignedAgents.map(agent => (
                            <div 
                              key={agent.id}
                              className="flex items-center gap-4 p-4 bg-muted rounded-lg"
                            >
                              <Checkbox
                                checked={selectedAgents.includes(agent.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedAgents(prev =>
                                    checked
                                      ? [...prev, agent.id]
                                      : prev.filter(id => id !== agent.id)
                                  )
                                }}
                              />
                              <div className="flex items-center justify-between flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="font-medium">
                                    {agent.full_name ?? 'Unnamed Agent'}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Pending team assignment
                                  </div>
                                </div>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Assign to Team
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Assign Agent to Team</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label>Select Team</Label>
                                        <Select
                                          value={selectedTeamId?.toString() ?? ''}
                                          onValueChange={(value) => setSelectedTeamId(parseInt(value, 10))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select a team" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {teams.map(team => (
                                              <SelectItem key={team.id} value={team.id.toString()}>
                                                {team.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Button 
                                        className="w-full"
                                        onClick={() => selectedTeamId && handleAssignAgent(agent.id, selectedTeamId)}
                                        disabled={!selectedTeamId || isAssigningAgent}
                                      >
                                        {isAssigningAgent ? 'Assigning...' : 'Assign to Team'}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <AlertDialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Assign Multiple Agents</AlertDialogTitle>
                            <AlertDialogDescription>
                              Select a team to assign {selectedAgents.length} agent{selectedAgents.length > 1 ? 's' : ''} to.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Select Team</Label>
                              <Select
                                value={selectedTeamId?.toString() ?? ''}
                                onValueChange={(value) => setSelectedTeamId(parseInt(value, 10))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a team" />
                                </SelectTrigger>
                                <SelectContent>
                                  {teams.map(team => (
                                    <SelectItem key={team.id} value={team.id.toString()}>
                                      {team.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                              setSelectedTeamId(null)
                              setShowBulkAssignDialog(false)
                            }}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => selectedTeamId && handleBulkAssign(selectedTeamId)}
                              disabled={!selectedTeamId || isBulkAssigning}
                            >
                              {isBulkAssigning ? 'Assigning...' : 'Assign to Team'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )
      case 'config':
        return (
          <div className="space-y-6">
            <div className="grid gap-6">
              <Card className="p-6">
          <FocusAreaManager 
            initialFocusAreas={focusAreas} 
            companyId={initialProfile.company_id}
            onUpdate={setFocusAreas}
          />
              </Card>

              <Card className="p-6">
          <FieldDefinitionManager
            initialFieldDefinitions={fieldDefinitions}
            companyId={initialProfile.company_id}
            onUpdate={setFieldDefinitions}
          />
              </Card>
            </div>
        </div>
        )
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r">
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {initialProfile.full_name}
          </p>
          
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors
                  ${activeSection === item.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-muted'
                  }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 bg-background overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
} 