"use client";

import type { Database, Json } from "@/database.types";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreateTicketForm from "@/components/tickets/create-ticket-form";
import { Button } from "@/components/ui/button";
import { StatusBadge, Status } from "@/components/status-badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerConversationPanel } from "@/components/customer/conversation-panel";
import { ResizableLayout } from "@/components/shared/resizable-layout";
import { cn } from "@/lib/utils";
import { CustomerChatbot } from "@/components/customer/chatbot";

type Tables = Database["public"]["Tables"];
type Profile = Tables["profiles"]["Row"];

interface TicketFieldDefinition {
	id: number;
	name: string;
	label: string;
	field_type: string;
	is_required: boolean;
	allows_multiple: boolean;
	options: Json[] | null;
}

interface TicketField {
	value: string | null;
	field_definition: TicketFieldDefinition;
}

// Helper function to capitalize first letter
function capitalizeStatus(
	status: string,
): "New" | "Open" | "Resolved" | "Closed" {
	return (status.charAt(0).toUpperCase() + status.slice(1)) as
		| "New"
		| "Open"
		| "Resolved"
		| "Closed";
}

type Ticket = Tables["tickets"]["Row"] & {
	ticket_fields: TicketField[];
	status: "New" | "Open" | "Resolved" | "Closed";
};

export default function CustomerPage() {
	const [profile, setProfile] = useState<Profile | null>(null);
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [open, setOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
	const router = useRouter();

	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			const supabase = createClient();

			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();
			if (userError || !user) {
				router.push("/");
				return;
			}

			// Fetch profile
			const { data: profileData } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", user.id)
				.single();

			setProfile(profileData);

			// Fetch tickets
			const { data: ticketsData } = await supabase
				.from("tickets")
				.select(`
          *,
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
				.order("created_at", { ascending: false });

			// Transform the tickets data to ensure status is capitalized
			const transformedTickets = (ticketsData || []).map((ticket) => ({
				...ticket,
				status: capitalizeStatus(ticket.status),
			}));

			setTickets(transformedTickets as Ticket[]);
			setIsLoading(false);
		};

		fetchData();
	}, [router, open]); // Refetch when dialog closes

	const ticketTable = (
		<div className="h-full flex flex-col">
			<div className="relative flex-1 overflow-auto">
				<div className="sticky top-0 h-10 bg-custom-background-secondary border-b border-custom-ui-medium w-full">
					<div className="container mx-auto max-w-[1000px] h-full px-4">
						<div className="grid grid-cols-4 h-full px-6">
							<div className="flex items-center font-semibold text-custom-text text-xs uppercase">
								ID
							</div>
							<div className="flex items-center font-semibold text-custom-text text-xs uppercase">
								Subject
							</div>
							<div className="flex items-center font-semibold text-custom-text text-xs uppercase">
								Status
							</div>
							<div className="flex items-center font-semibold text-custom-text text-xs uppercase">
								Created
							</div>
						</div>
					</div>
				</div>
				{isLoading ? (
					<div className="w-full bg-custom-background border-b border-custom-ui-medium">
						<div className="container mx-auto max-w-[1000px] px-4">
							<div className="px-6 py-4 text-center text-custom-text-secondary">
								Loading tickets...
							</div>
						</div>
					</div>
				) : tickets.length === 0 ? (
					<div className="w-full bg-custom-background border-b border-custom-ui-medium">
						<div className="container mx-auto max-w-[1000px] px-4">
							<div className="px-6 py-4 text-center text-custom-text-secondary">
								No tickets found. Create your first ticket to get started.
							</div>
						</div>
					</div>
				) : (
					tickets.map((ticket) => (
						<div
							key={ticket.id}
							onClick={() => {
								// The ticket already has the correct status capitalization from the initial fetch
								setSelectedTicket(ticket);
							}}
							className={cn(
								"w-full border-b border-custom-ui-medium hover:bg-custom-background-secondary transition-colors cursor-pointer",
								selectedTicket?.id === ticket.id &&
									"bg-custom-ui-faint hover:bg-custom-ui-faint",
							)}
						>
							<div className="container mx-auto max-w-[1000px] px-4">
								<div className="grid grid-cols-4 px-6 py-4">
									<div className="flex items-center text-custom-text-secondary">
										#{ticket.id}
									</div>
									<div className="flex items-center text-custom-text-secondary">
										{ticket.ticket_fields?.find(
											(f) => f.field_definition.name === "subject",
										)?.value || "No Subject"}
									</div>
									<div className="flex items-center">
										<StatusBadge
											status={ticket.status.toLowerCase() as Status}
										/>
									</div>
									<div className="flex items-center text-custom-text-secondary text-sm">
										{new Date(ticket.created_at)
											.toISOString()
											.split("T")[0]
											.replace(/-/g, "/")}
									</div>
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);

	const conversationPanel = selectedTicket ? (
		<CustomerConversationPanel
			ticket={selectedTicket}
			onClose={() => setSelectedTicket(null)}
		/>
	) : undefined;

	return (
		<div className="flex flex-col h-screen bg-custom-background">
			{/* Header */}
			<header className="border-b border-custom-ui-medium">
				<div className="flex justify-between items-center p-8">
					<div>
						<h1 className="text-2xl font-bold text-custom-text">
							Customer Dashboard
						</h1>
						<p className="text-custom-text-secondary">
							Hi, {profile?.full_name}
						</p>
					</div>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button className="bg-custom-accent text-white hover:bg-custom-accent/90">
								Create New Ticket
							</Button>
						</DialogTrigger>
						<DialogContent className="bg-custom-background-secondary border-custom-ui-medium">
							<DialogHeader>
								<DialogTitle className="text-custom-text">
									Create New Ticket
								</DialogTitle>
							</DialogHeader>
							<CreateTicketForm onSuccess={() => setOpen(false)} />
						</DialogContent>
					</Dialog>
				</div>
			</header>

			<ResizableLayout
				mainContent={ticketTable}
				sideContent={conversationPanel}
			/>

			{/* Add the chatbot */}
			<CustomerChatbot />
		</div>
	);
}
