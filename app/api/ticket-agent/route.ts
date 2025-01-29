import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { task, entrypoint, addMessages } from "@langchain/langgraph";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import {
	HumanMessage,
	AIMessage,
	SystemMessage,
	ToolMessage,
} from "@langchain/core/messages";
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/database.types";

type FieldDefinition = Database["public"]["Tables"]["field_definitions"]["Row"];

// Initialize Supabase and fetch field definitions
let fieldDefinitions: FieldDefinition[] = [];
let focusAreas: { id: number; name: string }[] = [];

// In-memory form state (in production, you'd use a database or session)
const ticketFormState: Record<string, string> = {};
let selectedFocusAreaId: number | null | undefined = undefined; // undefined = not set, null = "Other"

// Initialize the LLM
console.log("Initializing ChatOpenAI with model: gpt-4o-mini");
const llm = new ChatOpenAI({
	modelName: "gpt-4o-mini",
	temperature: 0.2,
});

// Helper function to convert plain messages to LangChain messages
function convertToLangChainMessage(msg: {
	role: "human" | "ai" | "tool" | "system";
	content: string;
	tool_call_id?: string;
}): BaseMessageLike {
	console.log("Converting message:", msg);
	switch (msg.role) {
		case "human":
			return new HumanMessage(msg.content);
		case "ai":
			return new AIMessage(msg.content);
		case "system":
			return new SystemMessage(msg.content);
		case "tool":
			// Convert tool messages to AI messages for conversation history
			return new AIMessage(`Tool Result: ${msg.content}`);
		default:
			console.warn("Unknown message role:", msg.role);
			return new AIMessage(msg.content);
	}
}

// Define tools
const updateField = tool(
	async ({ field, value }: { field: string; value: string }) => {
		console.log("updateField tool called with:", { field, value });

		// Validate field exists
		const fieldDef = fieldDefinitions.find((f) => f.name === field);
		if (!fieldDef) {
			return `Error: Field "${field}" is not defined in the ticket form`;
		}

		ticketFormState[field] = value;
		console.log("Updated ticket form state:", ticketFormState);
		return `Field "${fieldDef.label}" updated to "${value}". Current state: ${JSON.stringify(ticketFormState)}`;
	},
	{
		name: "updateField",
		description: `Update a single ticket field. 
      Provide { field: string, value: string }. 
      E.g. { field: "subject", value: "Login Issue" }`,
		schema: z.object({
			field: z.string(),
			value: z.string(),
		}),
	},
);

const submitTicket = tool(
	async () => {
		console.log("submitTicket tool called. Current state:", {
			fields: ticketFormState,
			focusArea: selectedFocusAreaId,
		});

		// Get required fields
		const requiredFields = fieldDefinitions
			.filter((f) => f.is_required)
			.map((f) => f.name);

		// Check if all required fields are present
		const missing = requiredFields.filter((f) => !ticketFormState[f]);
		if (missing.length > 0) {
			const missingLabels = missing
				.map(
					(name) =>
						fieldDefinitions.find((f) => f.name === name)?.label || name,
				)
				.join(", ");
			console.log("Missing required fields:", missing);
			return `Cannot submit—missing required fields: ${missingLabels}`;
		}

		// Check if focus area is set (undefined means not set yet)
		if (selectedFocusAreaId === undefined) {
			const availableAreas = focusAreas
				.map((fa) => fa.name)
				.concat(["Other"])
				.join(", ");
			return `Please set a focus area before submitting. Available areas: ${availableAreas}`;
		}

		try {
			// Get the current user
			const supabase = await createClient();
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();
			if (userError || !user) {
				console.error("Error getting user:", userError);
				return "Error: User not authenticated";
			}

			// Get customer's company ID
			const { data: profile } = await supabase
				.from("profiles")
				.select("company_id")
				.eq("id", user.id)
				.single();

			if (!profile?.company_id) {
				console.error("User has no associated company");
				return "Error: User has no associated company";
			}

			// Create the ticket
			const { data: ticket, error: ticketError } = await supabase
				.from("tickets")
				.insert({
					customer_id: user.id,
					status: "new",
					focus_area_id: selectedFocusAreaId,
				})
				.select()
				.single();

			if (ticketError) {
				console.error("Error creating ticket:", ticketError);
				return "Error: Failed to create ticket";
			}

			// Insert ticket fields
			const fieldEntries = Object.entries(ticketFormState)
				.map(([name, value]) => {
					const field = fieldDefinitions.find((f) => f.name === name);
					if (!field) return null;
					return {
						ticket_id: ticket.id,
						field_definition_id: field.id,
						value: value,
					};
				})
				.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

			if (fieldEntries.length > 0) {
				const { error: fieldsError } = await supabase
					.from("ticket_fields")
					.insert(fieldEntries);

				if (fieldsError) {
					console.error("Error inserting ticket fields:", fieldsError);
					return "Error: Failed to save ticket fields";
				}
			}

			// Create initial message with all field values
			const messageContent = Object.entries(ticketFormState)
				.map(([name, value]) => {
					const field = fieldDefinitions.find((f) => f.name === name);
					return `${field?.label || name}: ${value}`;
				})
				.join("\n");

			// Insert the initial message
			const { error: messageError } = await supabase.from("messages").insert({
				ticket_id: ticket.id,
				sender_id: user.id,
				content: messageContent,
				type: "user",
			});

			if (messageError) {
				console.error("Error creating initial message:", messageError);
				return "Error: Failed to save ticket message";
			}

			// Get focus area name before clearing state
			const focusAreaName =
				selectedFocusAreaId === null
					? "Other"
					: focusAreas.find((fa) => fa.id === selectedFocusAreaId)?.name ||
						"Unknown";

			// Clear the form state after submission
			for (const key of Object.keys(ticketFormState)) {
				delete ticketFormState[key];
			}
			selectedFocusAreaId = undefined; // Reset to unset state

			return `Ticket #${ticket.id} successfully created with focus area "${focusAreaName}" and the following details:\n${messageContent}`;
		} catch (error) {
			console.error("Error submitting ticket:", error);
			return "Error: Failed to submit ticket";
		}
	},
	{
		name: "submitTicket",
		description: `Once all required fields are filled and a focus area is set, call this to finalize the ticket. 
      If any required fields are missing or no focus area is set, returns an error instead of submission.`,
	},
);

const setFocusArea = tool(
	async ({ name }: { name: string }) => {
		console.log("setFocusArea tool called with:", { name });

		// Handle "Other" as null
		if (name.toLowerCase() === "other") {
			selectedFocusAreaId = null; // null means "Other" was explicitly selected
			return "Focus area set to Other";
		}

		// Find matching focus area
		const focusArea = focusAreas.find(
			(fa) => fa.name.toLowerCase() === name.toLowerCase(),
		);
		if (!focusArea) {
			const availableAreas = focusAreas
				.map((fa) => fa.name)
				.concat(["Other"])
				.join(", ");
			return `Error: "${name}" is not a valid focus area. Available areas are: ${availableAreas}`;
		}

		selectedFocusAreaId = focusArea.id;
		return `Focus area set to "${focusArea.name}"`;
	},
	{
		name: "setFocusArea",
		description: `Set the focus area for the ticket. Must be one of the valid focus areas or "Other".
		This must be set before submitting the ticket.`,
		schema: z.object({
			name: z.string(),
		}),
	},
);

// Bind tools to LLM
console.log("Binding tools to LLM");
const llmWithTools = llm.bindTools([updateField, submitTicket, setFocusArea]);

// Define tasks
const callTool = task("toolCall", async (toolCall: ToolCall) => {
	const { name, args, id } = toolCall;
	console.log("Tool call received:", { name, args, id });

	const myTools = { updateField, setFocusArea, submitTicket };
	const toolFn = myTools[name as keyof typeof myTools];

	if (!toolFn) {
		console.log("Error: Tool not found:", name);
		return new ToolMessage({
			content: `Error: no tool named "${name}"`,
			tool_call_id: id || `error_${Date.now()}`,
		});
	}

	try {
		console.log("Invoking tool:", name);
		let result: string;
		switch (name) {
			case "updateField":
				result = await updateField.invoke({
					field: (args as { field: string }).field,
					value: (args as { value: string }).value,
				});
				break;
			case "setFocusArea":
				result = await setFocusArea.invoke({
					name: (args as { name: string }).name,
				});
				break;
			case "submitTicket":
				result = await submitTicket.invoke({});
				break;
			default:
				throw new Error(`Unknown tool: ${name}`);
		}
		console.log("Tool result:", result);
		return new ToolMessage({
			content: result,
			tool_call_id: id || `tool_${Date.now()}`,
		});
	} catch (error) {
		console.error("Tool execution error:", error);
		throw error;
	}
});

function getSystemMessage(fields: FieldDefinition[]): SystemMessage {
	const requiredFields = fields
		.filter((f) => f.is_required)
		.map((f) => `${f.label} (${f.name})`);

	const optionalFields = fields
		.filter((f) => !f.is_required)
		.map((f) => `${f.label} (${f.name})`);

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const availableFocusAreas = focusAreas
		.map((fa) => fa.name)
		.concat(["Other"])
		.join(", ");

	return new SystemMessage(
		`
You are a ticket intake agent. Your role is to efficiently gather information needed to create a support ticket, while maintaining a professional and courteous tone.

Today is ${today}.

Required fields to collect: ${requiredFields.join(", ")}
Optional fields to collect if mentioned: ${optionalFields.join(", ")}

IMPORTANT - Immediate Field Updates:
- Update fields IMMEDIATELY as soon as you learn any information
- Don't wait to collect all information before updating fields
- If a user provides multiple pieces of information, update all fields before asking your next question
- If information changes or becomes more specific, update the fields right away

Focus Area Requirement:
- Every ticket MUST have a focus area assigned before submission
- Available focus areas: ${availableFocusAreas}
- Set the focus area as soon as you can confidently determine it
- If none of the specific areas fit, set it to "Other"
- The focus area helps route the ticket to the right team

Guidelines:
1. Information Collection Strategy:
   - Start updating fields from the very first user message
   - Extract and save any provided information immediately
   - Then ask about missing required information
   - Keep the conversation flowing naturally

2. Progressive Information Gathering:
   GOOD Example:
   User: "I can't log in to my account on Chrome"
   [Immediately call updateField for subject="Login Issue" and browser="Chrome"]
   Assistant: "I understand you're having trouble logging in. I've noted that you're using Chrome. What happens when you try to log in?"
   [Set focus area to Authentication right away]

   BAD Example:
   User: "I can't log in to my account on Chrome"
   Assistant: "I understand you're having trouble logging in. What happens when you try?"
   [Waiting to update fields until later]

3. Handling Multiple Pieces of Information:
   GOOD Example:
   User: "I need to book a flight from London to Austin for a conference"
   [Immediately make multiple tool calls in sequence:]
   1. updateField for departure_city="London"
   2. updateField for arrival_city="Austin"
   4. updateField for reason="conference"
   5. setFocusArea to "Travel"
   Assistant: "I've noted your travel details. What day would you prefer to depart?"

   BAD Example:
   User: "I need to book a flight from London to Austin next Saturday for a conference"
   Assistant: "I'll help you with your travel booking. What time would you prefer to depart?"
   [Waiting to update fields until later]

4. Information Updates:
   - If a user corrects or refines information, update the field immediately
   - Example: If user says "Actually, I meant Firefox, not Chrome"
   - Immediately update the browser field, don't wait

5. Tool Usage:
   - Use updateField as soon as you learn any field information
   - Use setFocusArea as soon as you can confidently determine the area
   - Only use submitTicket when all required fields are filled and verified

Remember:
- Update fields IMMEDIATELY - this is crucial
- Be proactive about setting focus area
- Keep the conversation natural while gathering information
- When all information is collected, submit the ticket AND provide a summary
- Never say you will submit a ticket without actually submitting it
- After submitting, provide a clear summary but DO NOT invite further conversation
- The conversation ENDS after ticket submission`.trim(),
	);
}

const callLlm = task("llmCall", async (messages: BaseMessageLike[]) => {
	console.log("LLM call received with messages:", messages);

	const allMessages = [getSystemMessage(fieldDefinitions), ...messages];
	console.log("Sending messages to LLM with system prompt");

	try {
		const response = await llmWithTools.invoke(allMessages);
		console.log("LLM response received:", response);
		return response;
	} catch (error) {
		console.error("LLM call error:", error);
		throw error;
	}
});

// Create the agent
console.log("Creating agent with entrypoint");
const agent = entrypoint(
	"helpdeskAgent",
	async (initialMessages: BaseMessageLike[]) => {
		console.log("Agent invoked with initial messages:", initialMessages);

		let currentMessages = initialMessages;
		console.log("Calling LLM with initial messages");
		let llmResponse = await llmWithTools.invoke(currentMessages);
		console.log("Initial LLM response:", llmResponse);

		while (true) {
			const toolCalls = llmResponse.tool_calls;
			console.log("Checking for tool calls:", toolCalls?.length || 0);

			if (!toolCalls?.length) {
				console.log("No tool calls, breaking loop");
				break;
			}

			console.log("Processing tool calls");
			const toolResults = await Promise.all(
				toolCalls.map((tc) => callTool(tc)),
			);
			console.log("Tool results:", toolResults);

			currentMessages = addMessages(currentMessages, [
				llmResponse,
				...toolResults,
			]);
			console.log("Updated messages with tool results");

			llmResponse = await llmWithTools.invoke(currentMessages);
			console.log("New LLM response after tool calls:", llmResponse);
		}

		currentMessages = addMessages(currentMessages, [llmResponse]);
		console.log("Final messages:", currentMessages);
		return currentMessages;
	},
);

export async function POST(request: Request) {
	console.log("POST request received to /api/ticket-agent");

	try {
		const body = await request.json();
		console.log("Request body:", body);

		const { messages } = body;

		if (!messages || !Array.isArray(messages)) {
			console.log("Invalid request: messages array is required");
			return NextResponse.json(
				{ error: "Messages array is required" },
				{ status: 400 },
			);
		}

		// Get the current user and their company_id in one query
		const supabase = await createClient();
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			console.error("Error getting user:", userError);
			return NextResponse.json(
				{ error: "User not authenticated" },
				{ status: 401 },
			);
		}

		// Get customer's company ID
		const { data: profile } = await supabase
			.from("profiles")
			.select("company_id")
			.eq("id", user.id)
			.single();

		if (!profile?.company_id) {
			console.error("User has no associated company");
			return NextResponse.json(
				{ error: "User has no associated company" },
				{ status: 400 },
			);
		}

		// Fetch field definitions for the customer's company
		const { data: fields, error: fieldsError } = await supabase
			.from("field_definitions")
			.select("*")
			.eq("company_id", profile.company_id)
			.order("display_order");

		if (fieldsError || !fields?.length) {
			console.error("Error fetching field definitions:", fieldsError);
			return NextResponse.json(
				{ error: "Failed to load ticket form configuration" },
				{ status: 500 },
			);
		}

		// Update field definitions
		fieldDefinitions = fields;

		// Fetch focus areas for the customer's company
		const { data: areas, error: areasError } = await supabase
			.from("focus_areas")
			.select("*")
			.eq("company_id", profile.company_id)
			.order("id");

		if (areasError || !areas?.length) {
			console.error("Error fetching focus areas:", areasError);
			return NextResponse.json(
				{ error: "Failed to load focus areas" },
				{ status: 500 },
			);
		}

		// Update focus areas
		focusAreas = areas;

		// Clear any existing form state
		for (const key of Object.keys(ticketFormState)) {
			delete ticketFormState[key];
		}

		// Convert messages to LangChain format, filtering out only system messages
		const langChainMessages = [
			getSystemMessage(fieldDefinitions),
			...messages
				.filter((msg) => msg.role !== "system")
				.map(convertToLangChainMessage),
		];

		// Invoke agent
		const result = await agent.invoke(langChainMessages);
		console.log("Agent execution completed");

		// Convert LangChain messages to simple format for frontend
		const transformedMessages = result.map((msg) => {
			if (typeof msg === "string") {
				return {
					role: "ai",
					content: msg,
				};
			}

			if ("_getType" in msg && typeof msg._getType === "function") {
				const type = msg._getType();
				if (type === "tool") {
					// For the frontend, keep tool messages as they are
					return {
						role: "tool",
						content: msg.content,
						tool_call_id:
							msg instanceof ToolMessage ? msg.tool_call_id : undefined,
					};
				}
				return {
					role: type,
					content: msg.content,
				};
			}

			console.warn("Unknown message type:", msg);
			return {
				role: "ai",
				content: typeof msg === "string" ? msg : JSON.stringify(msg),
			};
		});

		return NextResponse.json({ messages: transformedMessages });
	} catch (error: unknown) {
		const err = error as Error;
		console.error("Ticket agent error:", {
			name: err?.name,
			message: err?.message,
			stack: err?.stack,
		});
		return NextResponse.json(
			{ error: "Failed to process ticket request" },
			{ status: 500 },
		);
	}
}
