"use client";

import type { Database } from "@/database.types";
import { useState, useEffect } from "react";
import { FocusAreaManager } from "@/components/admin/focus-area-manager";
import { AgentRegistration } from "@/components/admin/agent-registration";
import { FieldDefinitionManager } from "@/components/admin/field-definition-manager";
import { createClient } from "@/utils/supabase/client";
import {
	Users,
	Settings,
	BarChart3,
	UserPlus,
	UsersRound,
	Target,
	UserCheck,
	UserX,
	MoreVertical,
	Pencil,
	Trash2,
	Search,
	LogOut,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	Tooltip,
	Legend,
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
	Bar,
	Treemap,
} from "recharts";
import { FocusAreaPill } from "@/components/ui/focus-area-pill";

type Tables = Database["public"]["Tables"];
type Profile = Tables["profiles"]["Row"];
type FocusArea = Tables["focus_areas"]["Row"];
type BaseTeam = Tables["teams"]["Row"];
type BaseFieldDefinition = Tables["field_definitions"]["Row"];
type BaseTicket = Tables["tickets"]["Row"];

interface FieldOption {
	label: string;
	value: string;
}

interface FieldDefinition extends Omit<BaseFieldDefinition, "options"> {
	options: FieldOption[] | null;
}

interface TeamWithRelations extends BaseTeam {
	profiles: Array<Pick<Profile, "id" | "full_name">>;
	team_focus_areas: Array<{
		focus_area_id: number;
	}>;
}

interface AdminProfile {
	full_name: string;
	company_id: string;
}

type Ticket = BaseTicket & {
	customer: Pick<Profile, "company_id">;
};

interface Props {
	initialProfile: AdminProfile;
	initialFocusAreas: FocusArea[];
	initialAgents: Profile[];
	initialTeams: TeamWithRelations[];
	initialFieldDefinitions: FieldDefinition[];
	initialTickets: Ticket[];
}

interface NavItem {
	label: string;
	icon: React.ReactNode;
	id: string;
}

const navItems: NavItem[] = [
	{
		label: "Overview",
		icon: <BarChart3 className="w-5 h-5" />,
		id: "overview",
	},
	{
		label: "Agent Management",
		icon: <Users className="w-5 h-5" />,
		id: "agents",
	},
	{
		label: "Configuration",
		icon: <Settings className="w-5 h-5" />,
		id: "config",
	},
];

export default function AdminDashboard({
	initialProfile,
	initialFocusAreas,
	initialAgents,
	initialTeams,
	initialFieldDefinitions,
	initialTickets,
}: Props) {
	console.log("Initial Data:", {
		teams: initialTeams,
		agents: initialAgents,
		teamAgentRelationship: initialAgents.map((agent) => ({
			agentId: agent.id,
			agentName: agent.full_name,
			teamId: agent.team_id,
		})),
	});

	const [activeSection, setActiveSection] = useState("overview");
	const [focusAreas, setFocusAreas] = useState(initialFocusAreas);
	const [agents, setAgents] = useState(initialAgents);
	const [teams, setTeams] = useState(initialTeams);
	const [fieldDefinitions, setFieldDefinitions] = useState(
		initialFieldDefinitions,
	);
	const [tickets] = useState(initialTickets);
	const [newTeamName, setNewTeamName] = useState("");
	const [selectedFocusAreas, setSelectedFocusAreas] = useState<number[]>([]);
	const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
	const [isCreatingTeam, setIsCreatingTeam] = useState(false);
	const [isAssigningAgent, setIsAssigningAgent] = useState(false);
	const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
	const [isBulkAssigning, setIsBulkAssigning] = useState(false);
	const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedInitialMembers, setSelectedInitialMembers] = useState<
		string[]
	>([]);
	const [editingTeam, setEditingTeam] = useState<TeamWithRelations | null>(
		null,
	);
	const [isEditingTeam, setIsEditingTeam] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Chart colors
	const statusColors = {
		new: {
			bg: "rgb(246,226,160)",
			text: "rgb(122,92,1)",
			border: "rgb(122,92,1)",
		},
		open: {
			bg: "rgb(255,202,187)",
			text: "#AF3029",
			border: "#AF3029",
		},
		resolved: {
			bg: "rgb(221,226,178)",
			text: "rgb(82,102,9)",
			border: "rgb(82,102,9)",
		},
		closed: {
			bg: "rgb(230,228,217)",
			text: "rgb(78,77,74)",
			border: "rgb(78,77,74)",
		},
	};

	const priorityColors = {
		High: {
			bg: "rgb(255,202,187)",
			text: "#AF3029",
			border: "#AF3029",
		},
		Medium: {
			bg: "rgb(246,226,160)",
			text: "rgb(122,92,1)",
			border: "rgb(122,92,1)",
		},
		Low: {
			bg: "rgb(230,228,217)",
			text: "rgb(78,77,74)",
			border: "rgb(78,77,74)",
		},
	};

	// Status distribution data
	const statusData = [
		{ name: "New", value: tickets.filter((t) => t.status === "new").length },
		{ name: "Open", value: tickets.filter((t) => t.status === "open").length },
		{
			name: "Resolved",
			value: tickets.filter((t) => t.status === "resolved").length,
		},
		{
			name: "Closed",
			value: tickets.filter((t) => t.status === "closed").length,
		},
	];

	// Priority distribution data
	const priorityData = [
		{
			name: "High",
			value: tickets.filter((t) => t.priority === "High").length,
		},
		{
			name: "Medium",
			value: tickets.filter((t) => t.priority === "Medium").length,
		},
		{ name: "Low", value: tickets.filter((t) => t.priority === "Low").length },
	];

	// Team performance data
	const teamPerformanceData = teams.map((team) => ({
		name: team.name,
		resolved: tickets.filter(
			(t) => t.team_id === team.id && ["resolved", "closed"].includes(t.status),
		).length,
		open: tickets.filter((t) => t.team_id === team.id && t.status === "open")
			.length,
	}));

	// Add after the teamPerformanceData calculation
	const teamResolutionTimeData = teams
		.map((team) => {
			const resolvedTickets = tickets.filter(
				(t) => t.team_id === team.id && t.resolved_at !== null,
			);

			const avgResolutionTime =
				resolvedTickets.reduce((acc, ticket) => {
					const createdDate = new Date(ticket.created_at);
					if (!ticket.resolved_at) return acc;
					const resolvedDate = new Date(ticket.resolved_at);
					const hours =
						(resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
					return acc + hours;
				}, 0) / (resolvedTickets.length || 1);

			return {
				name: team.name,
				hours: Math.round(avgResolutionTime * 10) / 10, // Round to 1 decimal place
				ticketCount: resolvedTickets.length,
			};
		})
		.sort((a, b) => a.hours - b.hours); // Sort by resolution time

	// Focus area distribution data
	const focusAreaData = focusAreas.map((area) => ({
		name: area.name,
		size: tickets.filter((t) => t.focus_area_id === area.id).length,
	}));

	useEffect(() => {
		const supabase = createClient();

		const channel = supabase
			.channel("profiles-changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "profiles",
					filter: `company_id=eq.${initialProfile.company_id}`,
				},
				async () => {
					console.log("Profile change detected");
					const { data: updatedAgents, error } = await supabase
						.from("profiles")
						.select("*")
						.eq("company_id", initialProfile.company_id)
						.eq("role", "human_agent");

					if (error) {
						console.error("Error fetching updated agents:", error);
						return;
					}

					if (updatedAgents) {
						console.log("Updated Agents:", updatedAgents);
						setAgents(updatedAgents);
					}
				},
			)
			.subscribe();

		// Also fetch teams with their profiles
		const fetchTeams = async () => {
			const { data: fetchedTeams, error } = await supabase
				.from("teams")
				.select(`
          *,
          profiles!team_id(id, full_name),
          team_focus_areas(focus_area_id)
        `)
				.eq("company_id", initialProfile.company_id);

			if (error) {
				console.error("Error fetching teams:", error);
				return;
			}

			if (fetchedTeams) {
				console.log("Fetched Teams:", fetchedTeams);
				setTeams(fetchedTeams);
			}
		};

		fetchTeams();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [initialProfile.company_id]);

	// Get agents not in any team
	const unassignedAgents = agents.filter((agent) => !agent.team_id);

	useEffect(() => {
		console.log("Current State:", {
			teams,
			agents,
			unassignedAgents,
			teamAgentRelationship: agents.map((agent) => ({
				agentId: agent.id,
				agentName: agent.full_name,
				teamId: agent.team_id,
			})),
		});
	}, [teams, agents, unassignedAgents]);

	const handleCreateTeam = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!newTeamName.trim()) {
			setError("Team name is required");
			return;
		}
		if (selectedFocusAreas.length === 0) {
			setError("At least one focus area is required");
			return;
		}
		setIsCreatingTeam(true);
		setError(null);

		try {
			const supabase = createClient();

			// Create new team
			const { data: team, error: teamError } = await supabase
				.from("teams")
				.insert({
					name: newTeamName.trim(),
					company_id: initialProfile.company_id,
				})
				.select()
				.single();

			if (teamError) throw teamError;

			// Add focus areas
			const { error: focusAreaError } = await supabase
				.from("team_focus_areas")
				.insert(
					selectedFocusAreas.map((focusAreaId) => ({
						team_id: team.id,
						focus_area_id: focusAreaId,
					})),
				);

			if (focusAreaError) throw focusAreaError;

			// Assign selected members to the team
			if (selectedInitialMembers.length > 0) {
				const { error: memberError } = await supabase
					.from("profiles")
					.update({ team_id: team.id })
					.in("id", selectedInitialMembers);

				if (memberError) throw memberError;
			}

			// Get the selected member profiles
			const selectedMemberProfiles = selectedInitialMembers
				.map((id) => {
					const agent = agents.find((a) => a.id === id);
					return agent ? { id: agent.id, full_name: agent.full_name } : null;
				})
				.filter((p): p is NonNullable<typeof p> => p !== null);

			// Add to local state
			const newTeam: TeamWithRelations = {
				...team,
				profiles: selectedMemberProfiles,
				team_focus_areas: selectedFocusAreas.map((id) => ({
					focus_area_id: id,
				})),
			};

			setTeams([...teams, newTeam]);
			setNewTeamName("");
			setSelectedFocusAreas([]);
			setSelectedInitialMembers([]);
			setIsCreatingTeam(false);
			setError(null);
		} catch (error) {
			console.error("Error creating team:", error);
			setError(
				error instanceof Error ? error.message : "Failed to create team",
			);
			setIsCreatingTeam(false);
		}
	};

	const handleAssignAgent = async (agentId: string, teamId: number) => {
		if (!teamId) return;
		setIsAssigningAgent(true);

		try {
			const supabase = createClient();

			const { error } = await supabase
				.from("profiles")
				.update({ team_id: teamId })
				.eq("id", agentId);

			if (error) throw error;

			// Update local state
			const updatedAgents = agents.map((agent) =>
				agent.id === agentId ? { ...agent, team_id: teamId } : agent,
			);
			setAgents(updatedAgents);

			const updatedTeams = teams.map((team) => {
				if (team.id === teamId) {
					const agent = agents.find((a) => a.id === agentId);
					if (agent) {
						return {
							...team,
							profiles: [
								...team.profiles,
								{ id: agent.id, full_name: agent.full_name },
							],
						};
					}
				}
				return team;
			});
			setTeams(updatedTeams);

			setSelectedTeamId(null);
			setIsAssigningAgent(false);
		} catch (error) {
			console.error("Error assigning agent:", error);
			setIsAssigningAgent(false);
		}
	};

	const handleEditTeam = async () => {
		if (!editingTeam || !newTeamName.trim()) return;
		setIsEditingTeam(true);

		try {
			const supabase = createClient();

			// Update team name
			const { error: teamError } = await supabase
				.from("teams")
				.update({ name: newTeamName.trim() })
				.eq("id", editingTeam.id);

			if (teamError) throw teamError;

			// Delete existing focus areas
			const { error: deleteError } = await supabase
				.from("team_focus_areas")
				.delete()
				.eq("team_id", editingTeam.id);

			if (deleteError) throw deleteError;

			// Add new focus areas
			if (selectedFocusAreas.length > 0) {
				const { error: focusAreaError } = await supabase
					.from("team_focus_areas")
					.insert(
						selectedFocusAreas.map((focusAreaId) => ({
							team_id: editingTeam.id,
							focus_area_id: focusAreaId,
						})),
					);

				if (focusAreaError) throw focusAreaError;
			}

			// Update local state
			const updatedTeams = teams.map((team) => {
				if (team.id === editingTeam.id) {
					return {
						...team,
						name: newTeamName.trim(),
						team_focus_areas: selectedFocusAreas.map((id) => ({
							focus_area_id: id,
						})),
					};
				}
				return team;
			});

			setTeams(updatedTeams);
			setNewTeamName("");
			setSelectedFocusAreas([]);
			setEditingTeam(null);
			setIsEditingTeam(false);
		} catch (error) {
			console.error("Error editing team:", error);
			setIsEditingTeam(false);
		}
	};

	const handleDeleteTeam = async (teamId: number) => {
		try {
			const supabase = createClient();

			// First unassign all agents from the team
			const { error: unassignError } = await supabase
				.from("profiles")
				.update({ team_id: null })
				.eq("team_id", teamId);

			if (unassignError) throw unassignError;

			// Delete team focus areas
			const { error: focusAreaError } = await supabase
				.from("team_focus_areas")
				.delete()
				.eq("team_id", teamId);

			if (focusAreaError) throw focusAreaError;

			// Delete the team
			const { error: teamError } = await supabase
				.from("teams")
				.delete()
				.eq("id", teamId);

			if (teamError) throw teamError;

			// Update local state
			setTeams(teams.filter((team) => team.id !== teamId));
			setAgents(
				agents.map((agent) =>
					agent.team_id === teamId ? { ...agent, team_id: null } : agent,
				),
			);
		} catch (error) {
			console.error("Error deleting team:", error);
		}
	};

	const handleBulkAssign = async (teamId: number) => {
		if (!teamId || selectedAgents.length === 0) return;
		setIsBulkAssigning(true);

		try {
			const supabase = createClient();

			// Update all selected agents
			const { error } = await supabase
				.from("profiles")
				.update({ team_id: teamId })
				.in("id", selectedAgents);

			if (error) throw error;

			// Update local state
			const updatedAgents = agents.map((agent) =>
				selectedAgents.includes(agent.id)
					? { ...agent, team_id: teamId }
					: agent,
			);
			setAgents(updatedAgents);

			// Update teams state
			const updatedTeams = teams.map((team) => {
				if (team.id === teamId) {
					const newProfiles = selectedAgents
						.map((agentId) => {
							const agent = agents.find((a) => a.id === agentId);
							return agent
								? { id: agent.id, full_name: agent.full_name }
								: null;
						})
						.filter((p): p is NonNullable<typeof p> => p !== null);

					return {
						...team,
						profiles: [...team.profiles, ...newProfiles],
					};
				}
				return team;
			});
			setTeams(updatedTeams);

			setSelectedAgents([]);
			setSelectedTeamId(null);
			setIsBulkAssigning(false);
			setShowBulkAssignDialog(false);
		} catch (error) {
			console.error("Error bulk assigning agents:", error);
			setIsBulkAssigning(false);
		}
	};

	const filteredUnassignedAgents = unassignedAgents.filter(
		(agent) =>
			agent.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ??
			false,
	);

	const QuickStats = () => {
		const unassignedAgents = agents.filter((agent) => !agent.team_id).length;
		const totalFocusAreas = focusAreas.length;
		const totalTeams = teams.length;

		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<Card className="p-6 flex flex-col space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium text-custom-text-muted">
							Total Agents
						</h3>
						<Users className="w-5 h-5 text-custom-accent-teal" />
					</div>
					<p className="text-3xl font-semibold">{agents.length}</p>
				</Card>

				<Card className="p-6 flex flex-col space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium text-custom-text-muted">
							Unassigned
						</h3>
						<UserPlus className="w-5 h-5 text-custom-accent-teal" />
					</div>
					<p className="text-3xl font-semibold">{unassignedAgents}</p>
				</Card>

				<Card className="p-6 flex flex-col space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium text-custom-text-muted">
							Focus Areas
						</h3>
						<Target className="w-5 h-5 text-custom-accent-teal" />
					</div>
					<p className="text-3xl font-semibold">{totalFocusAreas}</p>
				</Card>

				<Card className="p-6 flex flex-col space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium text-custom-text-muted">
							Teams
						</h3>
						<UsersRound className="w-5 h-5 text-custom-accent-teal" />
					</div>
					<p className="text-3xl font-semibold">{totalTeams}</p>
				</Card>
			</div>
		);
	};

	const handleSignOut = async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
		window.location.href = "/";
	};

	const renderContent = () => {
		switch (activeSection) {
			case "overview":
				return (
					<div className="space-y-6">
						<QuickStats />

						{/* Ticket Statistics */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Status Distribution */}
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-6">
									Ticket Status Distribution
								</h3>
								<div className="h-[300px]">
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={statusData}
												cx="50%"
												cy="50%"
												innerRadius={60}
												outerRadius={80}
												fill="#8884d8"
												paddingAngle={5}
												dataKey="value"
												stroke="#FFFCF0"
												strokeWidth={2}
											>
												{statusData.map((entry) => (
													<Cell
														key={`cell-${entry.name}`}
														fill={
															statusColors[
																entry.name.toLowerCase() as keyof typeof statusColors
															].bg
														}
														stroke={
															statusColors[
																entry.name.toLowerCase() as keyof typeof statusColors
															].border
														}
													/>
												))}
											</Pie>
											<Tooltip
												contentStyle={{
													backgroundColor: "#F2F0E5",
													border: "none",
													borderRadius: "8px",
													boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
													color: "#100F0F",
												}}
												labelStyle={{ color: "#100F0F", fontWeight: 500 }}
											/>
											<Legend
												formatter={(value) => {
													const status =
														value.toLowerCase() as keyof typeof statusColors;
													return (
														<span style={{ color: statusColors[status].text }}>
															{value}
														</span>
													);
												}}
											/>
										</PieChart>
									</ResponsiveContainer>
								</div>
							</Card>

							{/* Priority Distribution */}
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-6">
									Ticket Priority Distribution
								</h3>
								<div className="h-[300px]">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={priorityData}
											margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
										>
											<CartesianGrid strokeDasharray="3 3" stroke="#DAD8CE" />
											<XAxis
												dataKey="name"
												tick={{ fill: "#100F0F" }}
												axisLine={{ stroke: "#CECDC3" }}
											/>
											<YAxis
												tick={{ fill: "#100F0F" }}
												axisLine={{ stroke: "#CECDC3" }}
											/>
											<Tooltip
												contentStyle={{
													backgroundColor: "#F2F0E5",
													border: "none",
													borderRadius: "8px",
													boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
													color: "#100F0F",
												}}
												labelStyle={{ color: "#100F0F", fontWeight: 500 }}
												cursor={false}
											/>
											<Bar dataKey="value" activeBar={false}>
												{priorityData.map((entry) => (
													<Cell
														key={`cell-${entry.name}`}
														fill={
															priorityColors[
																entry.name as keyof typeof priorityColors
															].bg
														}
														stroke={
															priorityColors[
																entry.name as keyof typeof priorityColors
															].border
														}
														strokeWidth={1}
													/>
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</Card>

							{/* Team Performance */}
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-6">Team Performance</h3>
								<div className="h-[300px]">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={teamPerformanceData}
											margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
										>
											<CartesianGrid strokeDasharray="3 3" stroke="#DAD8CE" />
											<XAxis
												dataKey="name"
												tick={{ fill: "#100F0F" }}
												axisLine={{ stroke: "#CECDC3" }}
											/>
											<YAxis
												tick={{ fill: "#100F0F" }}
												axisLine={{ stroke: "#CECDC3" }}
											/>
											<Tooltip
												contentStyle={{
													backgroundColor: "#F2F0E5",
													border: "none",
													borderRadius: "8px",
													boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
													color: "#100F0F",
												}}
												labelStyle={{ color: "#100F0F", fontWeight: 500 }}
												cursor={false}
											/>
											<Legend
												formatter={(value) => {
													const color = value.includes("Resolved")
														? statusColors.resolved.text
														: statusColors.open.text;
													return <span style={{ color }}>{value}</span>;
												}}
											/>
											<Bar
												dataKey="resolved"
												stackId="a"
												fill={statusColors.resolved.bg}
												stroke={statusColors.resolved.border}
												name="Resolved Tickets"
												activeBar={false}
											/>
											<Bar
												dataKey="open"
												stackId="a"
												fill={statusColors.open.bg}
												stroke={statusColors.open.border}
												name="Open Tickets"
												activeBar={false}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</Card>

							{/* Add after the Team Performance card */}
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-6">
									Average Resolution Time by Team
								</h3>
								<div className="h-[300px]">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={teamResolutionTimeData}
											layout="vertical"
											margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												stroke="#DAD8CE"
												horizontal={false}
											/>
											<XAxis
												type="number"
												tick={{ fill: "#100F0F" }}
												axisLine={{ stroke: "#CECDC3" }}
												label={{
													value: "Hours to Resolve",
													position: "insideBottom",
													offset: -5,
													fill: "#100F0F",
												}}
											/>
											<YAxis
												type="category"
												dataKey="name"
												tick={{ fill: "#100F0F" }}
												axisLine={{ stroke: "#CECDC3" }}
												width={120}
											/>
											<Tooltip
												contentStyle={{
													backgroundColor: "#F2F0E5",
													border: "none",
													borderRadius: "8px",
													boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
												}}
												labelStyle={{ color: "#100F0F", fontWeight: 500 }}
												formatter={(value: number) => [
													<span
														key="value"
														style={{ color: "#100F0F", fontWeight: 500 }}
													>
														{value} hours (
														{
															teamResolutionTimeData.find(
																(t) => t.hours === value,
															)?.ticketCount
														}{" "}
														tickets)
													</span>,
													<span
														key="label"
														style={{ color: "#100F0F", fontWeight: 500 }}
													>
														Avg. Resolution Time
													</span>,
												]}
												cursor={false}
											/>
											<Bar
												dataKey="hours"
												fill="#DDDFB2"
												stroke="#100F0F"
												strokeWidth={1}
												activeBar={false}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</Card>

							{/* Focus Area Distribution */}
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-6">
									Tickets by Focus Area
								</h3>
								<div className="h-[300px]">
									<ResponsiveContainer width="100%" height="100%">
										<Treemap
											data={focusAreaData}
											dataKey="size"
											aspectRatio={4 / 3}
											stroke={statusColors.new.border}
											fill={statusColors.new.bg}
										>
											{(props: {
												x: number;
												y: number;
												width: number;
												height: number;
												name: string;
												value: number;
											}) => {
												const { x, y, width, height, name, value } = props;
												return (
													<g>
														<rect
															x={x}
															y={y}
															width={width}
															height={height}
															style={{
																fill: statusColors.new.bg,
																stroke: statusColors.new.border,
																strokeWidth: 1,
															}}
														/>
														{width > 50 && height > 30 && (
															<text
																x={x + width / 2}
																y={y + height / 2}
																textAnchor="middle"
																dominantBaseline="middle"
																style={{
																	fill: statusColors.new.text,
																	fontSize: 14,
																	fontWeight: 500,
																}}
															>
																{name}
																{value > 0 && (
																	<tspan
																		x={x + width / 2}
																		y={y + height / 2 + 16}
																		style={{
																			fill: statusColors.new.text,
																			fontSize: 12,
																			opacity: 0.8,
																		}}
																	>
																		{value} ticket{value !== 1 ? "s" : ""}
																	</tspan>
																)}
															</text>
														)}
													</g>
												);
											}}
											<Tooltip
												contentStyle={{
													backgroundColor: "#F2F0E5",
													border: "none",
													borderRadius: "8px",
													boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
													color: "#100F0F",
												}}
												labelStyle={{ color: "#100F0F", fontWeight: 500 }}
												formatter={(value) => [
													`${value} ticket${value !== 1 ? "s" : ""}`,
												]}
											/>
										</Treemap>
									</ResponsiveContainer>
								</div>
							</Card>
						</div>
					</div>
				);
			case "agents":
				return (
					<div className="space-y-6">
						<div className="flex items-center justify-between mb-6">
							<div>
								<h2 className="text-2xl font-bold">Agent Management</h2>
								<p className="text-muted-foreground">
									Manage your support team members and their assignments
								</p>
							</div>
							<div className="flex gap-2">
								<div className="flex items-center gap-2 px-4 py-2 bg-custom-background-secondary rounded-lg">
									<div className="flex items-center gap-2">
										<UserCheck className="w-4 h-4 text-custom-accent-teal" />
										<span className="text-2xl font-semibold">
											{agents.length - unassignedAgents.length}
										</span>
									</div>
									<span className="text-custom-text-secondary">Assigned</span>
								</div>
								<div className="flex items-center gap-2 px-4 py-2 bg-custom-background-secondary rounded-lg">
									<div className="flex items-center gap-2">
										<UserX className="w-4 h-4 text-custom-accent-orange" />
										<span className="text-2xl font-semibold">
											{unassignedAgents.length}
										</span>
									</div>
									<span className="text-custom-text-secondary">Unassigned</span>
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
									{teams.map((team) => (
										<Card key={team.id} className="p-6">
											<div className="flex items-start justify-between mb-4">
												<div>
													<div className="flex items-center gap-2">
														<h3 className="text-lg font-semibold">
															{team.name}
														</h3>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8"
																>
																	<MoreVertical className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onClick={() => {
																		setEditingTeam(team);
																		setNewTeamName(team.name);
																		setSelectedFocusAreas(
																			team.team_focus_areas.map(
																				(fa) => fa.focus_area_id,
																			),
																		);
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
															{team.profiles
																.slice(0, 3)
																.map((p) => p.full_name)
																.join(", ")}
															{team.profiles.length > 3 &&
																` and ${team.profiles.length - 3} more`}
														</span>
													) : (
														<span className="text-sm text-muted-foreground">
															No members
														</span>
													)}
												</div>
											</div>
											<div className="space-y-2">
												<div className="text-sm">Focus Areas:</div>
												<div className="flex flex-wrap gap-2">
													{team.team_focus_areas.map(({ focus_area_id }) => {
														const area = focusAreas.find(
															(a) => a.id === focus_area_id,
														);
														return area ? (
															<FocusAreaPill key={area.id} name={area.name} />
														) : null;
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
												<DialogDescription>
													Create a new team and assign focus areas and members.
												</DialogDescription>
											</DialogHeader>
											<form
												onSubmit={handleCreateTeam}
												className="space-y-4 py-4"
											>
												<div className="space-y-2">
													<Label htmlFor="teamName">Team Name</Label>
													<Input
														id="teamName"
														placeholder="Enter team name"
														value={newTeamName}
														onChange={(e) => setNewTeamName(e.target.value)}
														disabled={isCreatingTeam}
														required
													/>
												</div>

												<div className="space-y-2">
													<Label>Focus Areas</Label>
													<div className="flex flex-wrap gap-2">
														{focusAreas.map((area) => (
															<button
																type="button"
																key={area.id}
																onClick={() => {
																	setSelectedFocusAreas((prev) =>
																		prev.includes(area.id)
																			? prev.filter((id) => id !== area.id)
																			: [...prev, area.id],
																	);
																}}
																className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
																	selectedFocusAreas.includes(area.id)
																		? "bg-primary text-primary-foreground"
																		: "bg-muted hover:bg-muted/80"
																}`}
																disabled={isCreatingTeam}
															>
																{area.name}
															</button>
														))}
													</div>
												</div>

												<div className="space-y-2">
													<Label>Team Members</Label>
													{unassignedAgents.length > 0 ? (
														<div className="space-y-3 max-h-[200px] overflow-y-auto">
															{unassignedAgents.map((agent) => (
																<div
																	key={agent.id}
																	className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
																>
																	<Checkbox
																		checked={selectedInitialMembers.includes(
																			agent.id,
																		)}
																		onCheckedChange={(checked) => {
																			setSelectedInitialMembers((prev) =>
																				checked
																					? [...prev, agent.id]
																					: prev.filter(
																							(id) => id !== agent.id,
																						),
																			);
																		}}
																		disabled={isCreatingTeam}
																	/>
																	<div className="flex items-center gap-2">
																		<span className="font-medium">
																			{agent.full_name ?? "Unnamed Agent"}
																		</span>
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

												{error && (
													<div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
														{error}
													</div>
												)}

												<Button
													type="submit"
													className="w-full"
													disabled={
														!newTeamName.trim() ||
														selectedFocusAreas.length === 0 ||
														isCreatingTeam
													}
												>
													{isCreatingTeam ? "Creating..." : "Create Team"}
												</Button>
											</form>
										</DialogContent>
									</Dialog>

									{/* Edit Team Dialog */}
									<Dialog
										open={!!editingTeam}
										onOpenChange={(open) => !open && setEditingTeam(null)}
									>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>
													Edit Team: {editingTeam?.name}
												</DialogTitle>
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
														{focusAreas.map((area) => (
															<button
																type="button"
																key={area.id}
																onClick={() => {
																	setSelectedFocusAreas((prev) =>
																		prev.includes(area.id)
																			? prev.filter((id) => id !== area.id)
																			: [...prev, area.id],
																	);
																}}
																className="hover:opacity-80 transition-opacity"
															>
																<FocusAreaPill name={area.name} />
															</button>
														))}
													</div>
												</div>
												<Button
													className="w-full"
													onClick={handleEditTeam}
													disabled={!newTeamName.trim() || isEditingTeam}
												>
													{isEditingTeam ? "Saving..." : "Save Changes"}
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
												<h3 className="text-lg font-semibold">
													Unassigned Agents
												</h3>
												<div className="flex items-center gap-3">
													{selectedAgents.length > 0 ? (
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button variant="default" size="sm">
																	Actions ({selectedAgents.length})
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onClick={() => setShowBulkAssignDialog(true)}
																>
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
																	onChange={(e) =>
																		setSearchQuery(e.target.value)
																	}
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
														checked={
															selectedAgents.length ===
																filteredUnassignedAgents.length &&
															filteredUnassignedAgents.length > 0
														}
														onCheckedChange={(checked) => {
															setSelectedAgents(
																checked
																	? filteredUnassignedAgents.map(
																			(agent) => agent.id,
																		)
																	: [],
															);
														}}
													/>
													<span className="text-sm text-muted-foreground">
														{selectedAgents.length > 0
															? `Selected ${selectedAgents.length} of ${filteredUnassignedAgents.length}`
															: `Select all ${filteredUnassignedAgents.length} agents`}
													</span>
												</div>

												<div className="grid gap-3">
													{filteredUnassignedAgents.map((agent) => (
														<div
															key={agent.id}
															className="flex items-center gap-4 p-4 bg-muted rounded-lg"
														>
															<Checkbox
																checked={selectedAgents.includes(agent.id)}
																onCheckedChange={(checked) => {
																	setSelectedAgents((prev) =>
																		checked
																			? [...prev, agent.id]
																			: prev.filter((id) => id !== agent.id),
																	);
																}}
															/>
															<div className="flex items-center justify-between flex-1">
																<div className="flex items-center gap-3">
																	<div className="font-medium">
																		{agent.full_name ?? "Unnamed Agent"}
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
																			<DialogTitle>
																				Assign Agent to Team
																			</DialogTitle>
																		</DialogHeader>
																		<div className="space-y-4 py-4">
																			<div className="space-y-2">
																				<Label>Select Team</Label>
																				<Select
																					value={
																						selectedTeamId?.toString() ?? ""
																					}
																					onValueChange={(value) =>
																						setSelectedTeamId(
																							Number.parseInt(value, 10),
																						)
																					}
																				>
																					<SelectTrigger>
																						<SelectValue placeholder="Select a team" />
																					</SelectTrigger>
																					<SelectContent>
																						{teams.map((team) => (
																							<SelectItem
																								key={team.id}
																								value={team.id.toString()}
																							>
																								{team.name}
																							</SelectItem>
																						))}
																					</SelectContent>
																				</Select>
																			</div>
																			<Button
																				className="w-full"
																				onClick={() =>
																					selectedTeamId &&
																					handleAssignAgent(
																						agent.id,
																						selectedTeamId,
																					)
																				}
																				disabled={
																					!selectedTeamId || isAssigningAgent
																				}
																			>
																				{isAssigningAgent
																					? "Assigning..."
																					: "Assign to Team"}
																			</Button>
																		</div>
																	</DialogContent>
																</Dialog>
															</div>
														</div>
													))}
												</div>
											</div>

											<AlertDialog
												open={showBulkAssignDialog}
												onOpenChange={setShowBulkAssignDialog}
											>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															Assign Multiple Agents
														</AlertDialogTitle>
														<AlertDialogDescription>
															Select a team to assign {selectedAgents.length}{" "}
															agent{selectedAgents.length > 1 ? "s" : ""} to.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<div className="space-y-4 py-4">
														<div className="space-y-2">
															<Label>Select Team</Label>
															<Select
																value={selectedTeamId?.toString() ?? ""}
																onValueChange={(value) =>
																	setSelectedTeamId(Number.parseInt(value, 10))
																}
															>
																<SelectTrigger>
																	<SelectValue placeholder="Select a team" />
																</SelectTrigger>
																<SelectContent>
																	{teams.map((team) => (
																		<SelectItem
																			key={team.id}
																			value={team.id.toString()}
																		>
																			{team.name}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
														</div>
													</div>
													<AlertDialogFooter>
														<AlertDialogCancel
															onClick={() => {
																setSelectedTeamId(null);
																setShowBulkAssignDialog(false);
															}}
														>
															Cancel
														</AlertDialogCancel>
														<AlertDialogAction
															onClick={() =>
																selectedTeamId &&
																handleBulkAssign(selectedTeamId)
															}
															disabled={!selectedTeamId || isBulkAssigning}
														>
															{isBulkAssigning
																? "Assigning..."
																: "Assign to Team"}
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
				);
			case "config":
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
				);
		}
	};

	return (
		<div className="flex h-screen bg-custom-background">
			{/* Sidebar */}
			<div className="w-64 bg-custom-background-secondary border-r border-custom-ui-medium flex flex-col">
				{/* Admin Info */}
				<div className="p-6">
					<h1 className="text-2xl font-bold text-custom-text mb-2">
						Admin Dashboard
					</h1>
					<p className="text-sm text-custom-text-secondary mb-4">
						{initialProfile.full_name}
					</p>
				</div>

				{/* Navigation Items */}
				<div className="flex-1 p-4">
					<div className="space-y-2">
						{navItems.map((item) => (
							<button
								type="button"
								key={item.id}
								onClick={() => setActiveSection(item.id)}
								className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
									activeSection === item.id
										? "bg-primary text-primary-foreground"
										: "hover:bg-custom-ui-faint text-custom-text"
								}`}
							>
								{item.icon}
								<span>{item.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Sign Out Button */}
				<div className="p-4 border-t border-custom-ui-medium">
					<Button
						variant="ghost"
						className="w-full flex items-center justify-start space-x-3 text-custom-text hover:bg-custom-ui-faint hover:text-custom-text"
						onClick={handleSignOut}
					>
						<LogOut className="w-5 h-5" />
						<span>Sign Out</span>
					</Button>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-auto p-8">{renderContent()}</div>
		</div>
	);
}
