import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { task, entrypoint, addMessages } from "@langchain/langgraph";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";

// Define required and optional fields
const requiredFields = ["subject", "operating_system", "content"];
const optionalFields = ["device_model", "priority"];

// In-memory form state (in production, you'd use a database or session)
const ticketFormState: Record<string, string> = {};

// Initialize the LLM
const llm = new ChatOpenAI({
	modelName: "gpt-4o-mini",
	temperature: 0.2,
});

// Define tools
export const updateField = tool(
	async ({ field, value }: { field: string; value: string }) => {
		ticketFormState[field] = value;
		return `Field "${field}" updated to "${value}". Current state: ${JSON.stringify(ticketFormState)}`;
	},
	{
		name: "updateField",
		description: `Update a single ticket field. 
      Provide { field: string, value: string }. 
      E.g. { field: "operating_system", value: "Windows 11" }`,
		schema: z.object({
			field: z.string(),
			value: z.string(),
		}),
	},
);

export const submitTicket = tool(
	async () => {
		// Check if all required fields are present
		const missing = requiredFields.filter((f) => !ticketFormState[f]);
		if (missing.length > 0) {
			return `Cannot submit—missing required fields: ${missing.join(", ")}`;
		}

		// In production, this would insert into your database
		console.log("SUBMITTING TICKET =>", ticketFormState);

		// Clear the form state after submission
		const submittedData = { ...ticketFormState };
		Object.keys(ticketFormState).forEach((key) => delete ticketFormState[key]);

		return `Ticket successfully submitted with data: ${JSON.stringify(submittedData)}`;
	},
	{
		name: "submitTicket",
		description: `Once all required fields are filled, call this to finalize the ticket. 
      If any required fields are missing, returns an error instead of submission.`,
	},
);

// Bind tools to LLM
const llmWithTools = llm.bindTools([updateField, submitTicket]);

// Define tasks
export const callTool = task("toolCall", async (toolCall: ToolCall) => {
	const { name, args } = toolCall;
	const myTools = { updateField, submitTicket };
	const toolFn = myTools[name as keyof typeof myTools];

	if (!toolFn) {
		return {
			role: "tool",
			content: `Error: no tool named "${name}"`,
			tool_call_id: toolCall.id,
		};
	}

	const result = await toolFn.invoke(args);
	return {
		role: "tool",
		content: result,
		tool_call_id: toolCall.id,
	};
});

export const callLlm = task("llmCall", async (messages: BaseMessageLike[]) => {
	const systemMsg = {
		role: "system",
		content: `
You are a helpdesk chatbot. The user is describing a support issue.
Required fields: ${requiredFields.join(", ")}
Optional fields: ${optionalFields.join(", ")}

If required fields are missing, politely ask the user for them in normal conversation.
Once the user clarifies a field, call "updateField" with { field, value }.
When all required fields are present, call "submitTicket" to finalize.

Important: 
- Do NOT call "submitTicket" if any required field is missing.
- If you're just speaking to the user, return a normal "assistant" message.
- If you want to store data, call the appropriate tool.
`.trim(),
	};

	const allMessages = [systemMsg, ...messages];
	return llmWithTools.invoke(allMessages);
});

// Create the agent
export const agent = entrypoint(
	"helpdeskAgent",
	async (messages: BaseMessageLike[]) => {
		let llmResponse = await callLlm(messages);

		while (true) {
			const toolCalls = llmResponse.tool_calls;
			if (!toolCalls?.length) {
				break;
			}

			const toolResults = await Promise.all(
				toolCalls.map((tc) => callTool(tc)),
			);
			messages = addMessages(messages, [llmResponse, ...toolResults]);
			llmResponse = await callLlm(messages);
		}

		messages = addMessages(messages, [llmResponse]);
		return messages;
	},
);
