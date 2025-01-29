"use client";

import type { Database } from "@/database.types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, PencilLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RealtimeChannel } from "@supabase/supabase-js";
import { InternalNotesPanel } from "@/components/human-agent/internal-notes-panel";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";

type Tables = Database["public"]["Tables"];

type Message = Tables["messages"]["Row"] & {
	sender?: {
		full_name: string | null;
	};
};

interface FieldDefinition {
	id: number;
	name: string;
	label: string;
	field_type: string;
	is_required: boolean;
	allows_multiple: boolean;
	options: Tables["field_definitions"]["Row"]["options"];
}

interface TicketField {
	value: string | null;
	field_definition: FieldDefinition;
}

type Ticket = Tables["tickets"]["Row"] & {
	ticket_fields: TicketField[];
};

type Variant = "agent" | "customer";

interface Props {
	ticket: Ticket;
	onClose: () => void;
	variant: Variant;
	onOpenTicket?: () => void;
	onResolveTicket?: () => void;
	onCloseTicket?: () => void;
}

export function ConversationPanel({
	ticket: initialTicket,
	onClose,
	variant,
	onOpenTicket,
	onResolveTicket,
	onCloseTicket,
}: Props) {
	const [ticket, setTicket] = useState(initialTicket);
	const [messages, setMessages] = useState<Message[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [otherPartyName, setOtherPartyName] = useState<string>("Unknown");
	const [showInternalNotes, setShowInternalNotes] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [channel, setChannel] = useState<RealtimeChannel | null>(null);

	const isAgent = variant === "agent";
	const isCustomer = variant === "customer";

	useEffect(() => {
		setTicket(initialTicket);
	}, [initialTicket]);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Scroll when messages change
	useEffect(() => {
		const timeoutId = setTimeout(scrollToBottom, 100);
		return () => clearTimeout(timeoutId);
	}, [messages, scrollToBottom]);

	useEffect(() => {
		const fetchMessages = async () => {
			setIsLoading(true);
			const supabase = createClient();

			const { data, error: fetchError } = await supabase
				.from("messages")
				.select(`
          *,
          sender:sender_id (
            full_name
          )
        `)
				.eq("ticket_id", ticket.id)
				.order("created_at", { ascending: true });

			if (fetchError) {
				console.error("Error fetching messages:", fetchError);
			}

			if (!fetchError && data) {
				// If agent view, get customer name
				if (isAgent) {
					const { data: customerData } = await supabase
						.from("profiles")
						.select("full_name")
						.eq("id", ticket.customer_id)
						.single();
					setOtherPartyName(customerData?.full_name || "Customer");
				}
				setMessages(data);
			}
			setIsLoading(false);
		};

		fetchMessages();

		// Set up real-time subscription
		const supabase = createClient();
		const newChannel = supabase
			.channel(`messages:ticket_id=eq.${ticket.id}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "messages",
					filter: `ticket_id=eq.${ticket.id}`,
				},
				async (payload) => {
					console.log("Real-time message update:", payload);

					if (payload.eventType === "INSERT") {
						// Fetch the complete message with sender info
						const { data: newMessage } = await supabase
							.from("messages")
							.select(`
                *,
                sender:sender_id (
                  full_name
                )
              `)
							.eq("id", payload.new.id)
							.single();

						if (newMessage) {
							setMessages((prev) => [...prev, newMessage]);
						}
					}
				},
			)
			.subscribe();

		setChannel(newChannel);

		return () => {
			const supabase = createClient();
			if (newChannel) {
				supabase.removeChannel(newChannel);
			}
		};
	}, [ticket.id, isAgent, ticket.customer_id]);

	useEffect(() => {
		const getCurrentUser = async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setCurrentUserId(user?.id || null);
		};
		getCurrentUser();
	}, []);

	const handleSendMessage = async () => {
		if (!newMessage.trim()) return;

		const supabase = createClient();

		try {
			const { data: profile } = await supabase.auth.getUser();
			if (!profile.user) throw new Error("Not authenticated");

			// Send message through API endpoint which handles both DB and email
			const response = await fetch("/api/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					ticketId: ticket.id,
					content: newMessage.trim(),
					senderId: profile.user.id,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to send message");
			}

			setNewMessage("");
		} catch (err) {
			console.error("Failed to send message:", err);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const renderTicketActions = () => {
		if (!isAgent) return null;

		// Convert status to lowercase for comparison
		const status = ticket.status.toLowerCase();

		return (
			<div className="flex gap-2 items-center">
				{status === "new" && onOpenTicket && (
					<Button
						variant="ghost"
						onClick={onOpenTicket}
						className="bg-[rgb(255,202,187)] border border-custom-accent-red text-custom-accent-red hover:bg-[rgb(255,202,187)]/90 hover:text-custom-accent-red rounded-md px-3 py-1 h-auto text-sm"
					>
						Open Ticket
					</Button>
				)}
				{status === "open" && onResolveTicket && (
					<Button
						variant="ghost"
						onClick={onResolveTicket}
						className="bg-[rgb(221,226,178)] border border-[rgb(102,128,11)] text-[rgb(82,102,9)] hover:bg-[rgb(221,226,178)]/90 hover:text-[rgb(82,102,9)] rounded-md px-3 py-1 h-auto text-sm"
					>
						Resolve
					</Button>
				)}
				{status === "resolved" && onCloseTicket && (
					<Button
						variant="ghost"
						onClick={onCloseTicket}
						className="bg-[rgb(230,228,217)] border border-[rgb(111,110,105)] text-[rgb(78,77,74)] hover:bg-[rgb(230,228,217)]/90 hover:text-[rgb(78,77,74)] rounded-md px-3 py-1 h-auto text-sm"
					>
						Close
					</Button>
				)}
			</div>
		);
	};

	const getStatusBackgroundColor = (status: string) => {
		const lowercaseStatus = status.toLowerCase();
		switch (lowercaseStatus) {
			case "resolved":
				return "bg-[rgb(221,226,178)]";
			case "closed":
				return "bg-[rgb(230,228,217)]";
			case "open":
				return "bg-[rgb(255,202,187)]";
			case "new":
				return "bg-[rgb(246,226,160)]";
			default:
				return "bg-custom-background";
		}
	};

	return (
		<div className="h-full flex flex-col">
			<header
				className={`border-b border-custom-ui-medium ${getStatusBackgroundColor(ticket.status)}`}
			>
				<div className="flex justify-between items-center px-6 py-2.5">
					<div>
						<h2 className="text-lg font-semibold text-custom-text mb-2">
							{ticket.ticket_fields?.find(
								(f) => f.field_definition.name === "subject",
							)?.value || "No Subject"}
						</h2>
						{renderTicketActions()}
					</div>
					<div className="flex flex-col gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="text-custom-text-secondary hover:text-custom-text hover:bg-transparent"
						>
							<X className="h-5 w-5" />
						</Button>
						{isAgent && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowInternalNotes(true)}
								className="text-custom-text-secondary hover:text-custom-text hover:bg-transparent"
							>
								<PencilLine className="h-5 w-5" />
							</Button>
						)}
					</div>
				</div>
			</header>

			<div className="flex-1 min-h-0 flex">
				{isAgent && showInternalNotes ? (
					<ResizablePanelGroup direction="horizontal">
						<ResizablePanel defaultSize={60} minSize={30}>
							<div className="h-full flex flex-col">
								<ScrollArea className="flex-1 [&_[data-radix-scroll-area-scrollbar]]:opacity-0 [&_[data-radix-scroll-area-scrollbar]]:transition-opacity hover:[&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-scrollbar]]:data-[state=visible]:opacity-100">
									<div className="p-6 space-y-6">
										{isLoading ? (
											<div className="text-center text-custom-text-secondary">
												Loading messages...
											</div>
										) : messages.length === 0 ? (
											<div className="text-center text-custom-text-secondary">
												No messages yet
											</div>
										) : (
											messages.map((message) => {
												const isMyMessage = message.sender_id === currentUserId;
												const isSystemMessage = message.type === "system";

												if (isSystemMessage) {
													return (
														<div
															key={message.id}
															className="flex justify-center"
														>
															<div className="bg-custom-background-secondary border border-custom-ui-medium text-custom-text-secondary text-sm px-4 py-2 rounded-full">
																{message.content}
															</div>
														</div>
													);
												}

												return (
													<div
														key={message.id}
														className={`space-y-2 max-w-[85%] ${isMyMessage ? "ml-auto" : "mr-auto"}`}
													>
														<div
															className={`flex gap-2 text-sm text-custom-text-secondary ${isMyMessage ? "flex-row-reverse" : ""}`}
														>
															{!isMyMessage && (
																<span>
																	{isCustomer
																		? message.sender?.full_name ||
																			"Support Agent"
																		: otherPartyName}
																</span>
															)}
															<span>
																{new Date(message.created_at).toLocaleString()}
															</span>
														</div>
														<div
															className={`p-4 rounded-lg border ${
																isMyMessage
																	? "bg-custom-accent/10 border-custom-accent/20 rounded-tr-none"
																	: "bg-custom-background-secondary border-custom-ui-medium rounded-tl-none"
															}`}
														>
															<div className="text-custom-text whitespace-pre-wrap">
																{message.content}
															</div>
														</div>
													</div>
												);
											})
										)}
										<div ref={messagesEndRef} />
									</div>
								</ScrollArea>

								{isCustomer && ticket.status === "new" ? (
									<div className="border-t border-custom-ui-medium bg-custom-background p-4">
										<Alert>
											<AlertDescription>
												Your ticket has been submitted. Please wait for a
												support agent to respond.
											</AlertDescription>
										</Alert>
									</div>
								) : (
									<div className="border-t border-custom-ui-medium bg-custom-background p-4">
										<Textarea
											value={newMessage}
											onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
												setNewMessage(e.target.value)
											}
											onKeyDown={handleKeyPress}
											className="min-h-[80px] resize-none bg-custom-background-secondary border-custom-ui-medium focus:border-custom-ui-medium/50 focus:ring-0"
										/>
									</div>
								)}
							</div>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel defaultSize={40} minSize={20}>
							<InternalNotesPanel
								ticketId={ticket.id}
								onClose={() => setShowInternalNotes(false)}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				) : (
					<div className="flex-1 flex flex-col">
						<ScrollArea className="flex-1 [&_[data-radix-scroll-area-scrollbar]]:opacity-0 [&_[data-radix-scroll-area-scrollbar]]:transition-opacity hover:[&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-scrollbar]]:data-[state=visible]:opacity-100">
							<div className="p-6 space-y-6">
								{isLoading ? (
									<div className="text-center text-custom-text-secondary">
										Loading messages...
									</div>
								) : messages.length === 0 ? (
									<div className="text-center text-custom-text-secondary">
										No messages yet
									</div>
								) : (
									messages.map((message) => {
										const isMyMessage = message.sender_id === currentUserId;
										const isSystemMessage = message.type === "system";

										if (isSystemMessage) {
											return (
												<div key={message.id} className="flex justify-center">
													<div className="bg-custom-background-secondary border border-custom-ui-medium text-custom-text-secondary text-sm px-4 py-2 rounded-full">
														{message.content}
													</div>
												</div>
											);
										}

										return (
											<div
												key={message.id}
												className={`space-y-2 max-w-[85%] ${isMyMessage ? "ml-auto" : "mr-auto"}`}
											>
												<div
													className={`flex gap-2 text-sm text-custom-text-secondary ${isMyMessage ? "flex-row-reverse" : ""}`}
												>
													{!isMyMessage && (
														<span>
															{isCustomer
																? message.sender?.full_name || "Support Agent"
																: otherPartyName}
														</span>
													)}
													<span>
														{new Date(message.created_at).toLocaleString()}
													</span>
												</div>
												<div
													className={`p-4 rounded-lg border ${
														isMyMessage
															? "bg-custom-accent/10 border-custom-accent/20 rounded-tr-none"
															: "bg-custom-background-secondary border-custom-ui-medium rounded-tl-none"
													}`}
												>
													<div className="text-custom-text whitespace-pre-wrap">
														{message.content}
													</div>
												</div>
											</div>
										);
									})
								)}
								<div ref={messagesEndRef} />
							</div>
						</ScrollArea>

						{isCustomer && ticket.status === "new" ? (
							<div className="border-t border-custom-ui-medium bg-custom-background p-4">
								<Alert>
									<AlertDescription>
										Your ticket has been submitted. Please wait for a support
										agent to respond.
									</AlertDescription>
								</Alert>
							</div>
						) : (
							<div className="border-t border-custom-ui-medium bg-custom-background p-4">
								<Textarea
									value={newMessage}
									onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
										setNewMessage(e.target.value)
									}
									onKeyDown={handleKeyPress}
									className="min-h-[80px] resize-none bg-custom-background-secondary border-custom-ui-medium focus:border-custom-ui-medium/50 focus:ring-0"
								/>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
