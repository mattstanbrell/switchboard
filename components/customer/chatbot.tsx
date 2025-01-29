"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
	MessageSquare,
	Eraser,
	Info,
	WrenchIcon,
	CheckCircle,
} from "lucide-react";
import React from "react";

interface ToolCall {
	id: string;
	type: string;
	function: {
		name: string;
		arguments: string;
	};
}

interface Message {
	role: "human" | "ai" | "tool" | "system";
	content: string;
	tool_call_id?: string;
}

export function CustomerChatbot() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const messagesEndRef = React.useRef<HTMLDivElement>(null);

	// Add effect to handle ticket submission
	React.useEffect(() => {
		const hasSubmittedTicket = messages.some(
			(message) =>
				message.role === "tool" &&
				message.content.includes("Ticket successfully submitted"),
		);
		if (hasSubmittedTicket) {
			setIsSubmitted(true);
		}
	}, [messages]);

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setIsOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	const scrollToBottom = React.useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	React.useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputValue.trim() || isLoading) return;

		const userMessage = {
			content: inputValue,
			role: "human" as const,
		};
		setMessages((prev) => [...prev, userMessage]);
		setInputValue("");
		setIsLoading(true);

		try {
			const response = await fetch("/api/ticket-agent", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messages: [...messages, userMessage],
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to get response from ticket agent");
			}

			const data = await response.json();
			console.log("Agent response:", data);

			if (data.error) {
				throw new Error(data.error);
			}

			if (Array.isArray(data.messages) && data.messages.length > 0) {
				console.log("Setting messages to server's response:", data.messages);
				setMessages(data.messages);
			} else {
				console.log("No valid messages array in response");
				const errorMessage = {
					content:
						"I'm sorry, I didn't understand. Could you please try again?",
					role: "ai" as const,
				};
				setMessages((prev) => [...prev, errorMessage]);
			}
		} catch (error) {
			console.error("Error:", error);
			const errorMessage = {
				content: "Sorry, I encountered an error. Please try again.",
				role: "ai" as const,
			};
			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	const renderMessage = (message: Message, index: number) => {
		// Skip empty messages
		if (!message.content.trim()) return null;

		// Check if this is a tool message or a tool result in an AI message
		const isTool =
			message.role === "tool" ||
			(message.role === "ai" && message.content.startsWith("Tool Result:"));

		// For tool messages, simplify the content if it's a field update
		const isFieldUpdate = isTool && message.content.includes('Field "');
		const isTicketSubmitted =
			isTool && message.content.includes("Ticket successfully submitted");

		// Extract the actual content from tool result messages
		const toolContent = message.content.startsWith("Tool Result:")
			? message.content.replace("Tool Result: ", "")
			: message.content;

		if (isTicketSubmitted) {
			return (
				<div
					key={`${message.role}-${index}`}
					className="bg-custom-ui-medium mr-8 p-4 rounded-lg text-sm"
				>
					<div className="flex items-center gap-2 text-custom-text-secondary">
						<CheckCircle className="h-4 w-4" />
						<span>Ticket submitted successfully</span>
					</div>
				</div>
			);
		}

		const content = isFieldUpdate
			? `${toolContent.split('"')[1]} updated`
			: toolContent;

		return (
			<div
				key={`${message.role}-${index}`}
				className={cn(
					"p-4 rounded-lg",
					message.role === "human"
						? "bg-custom-ui-faint ml-8"
						: isTool
							? "bg-custom-ui-medium mr-8 text-sm"
							: "bg-custom-ui-medium mr-8",
				)}
			>
				{isTool ? (
					<div className="flex items-center gap-2 text-custom-text-secondary">
						<WrenchIcon className="h-4 w-4" />
						<span>{content}</span>
					</div>
				) : (
					<p className="text-custom-text whitespace-pre-wrap">{content}</p>
				)}
			</div>
		);
	};

	return (
		<>
			{/* Floating button */}
			<Button
				onClick={() => setIsOpen(true)}
				className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg bg-custom-accent hover:bg-custom-accent/90"
			>
				<MessageSquare className="h-6 w-6" />
			</Button>

			{/* Chat dialog */}
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent
					className={cn(
						"sm:max-w-[600px]",
						"h-[80vh]",
						"flex flex-col",
						"bg-custom-background-secondary",
						"overflow-hidden",
					)}
				>
					<div className="flex justify-between items-center p-4 border-b border-custom-ui-medium">
						<h2 className="text-custom-text font-medium">Submit Ticket</h2>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setMessages([])}
							className="text-custom-text-secondary hover:text-custom-text hover:bg-custom-ui-faint"
							disabled={messages.length === 0 || isLoading}
						>
							<Eraser className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-custom-ui-strong hover:[&::-webkit-scrollbar-thumb]:bg-custom-ui-strong/70">
						{messages.length === 0 ? (
							<div className="flex-1 py-8 flex items-center justify-center">
								<p className="text-custom-text-secondary">
									How can I help you today?
								</p>
							</div>
						) : (
							messages
								.filter((message) => message.role !== "system")
								.map((message, index) => renderMessage(message, index))
						)}
						{isLoading && (
							<div className="bg-custom-ui-medium mr-8 p-4 rounded-lg animate-pulse">
								<p className="text-custom-text">...</p>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					<div className="border-t border-custom-ui-medium">
						{isSubmitted ? (
							<div className="p-4 flex justify-center">
								<Button
									onClick={() => {
										setIsOpen(false);
										// Reset state for next conversation
										setMessages([]);
										setIsSubmitted(false);
									}}
									variant="outline"
									className="text-custom-text-secondary hover:text-custom-text"
								>
									Close Chat
								</Button>
							</div>
						) : (
							<form onSubmit={handleSubmit} className="p-4">
								<Textarea
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									placeholder={
										messages.length === 0
											? "Describe the issue you're experiencing..."
											: "Provide additional details..."
									}
									className={cn(
										"bg-custom-background",
										"border-custom-ui-medium",
										"text-custom-text",
										"placeholder:text-custom-text-tertiary",
										"min-h-[100px]",
										"resize-none",
									)}
									disabled={isLoading}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleSubmit(e);
										}
									}}
								/>
							</form>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
