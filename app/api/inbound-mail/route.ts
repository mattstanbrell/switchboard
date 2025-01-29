import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Parse from "@sendgrid/inbound-mail-parser";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

export async function POST(request: Request) {
	try {
		console.log("=== INBOUND EMAIL PROCESSING STARTED ===");
		const formData = await request.formData();
		console.log("Form data received:", Object.fromEntries(formData.entries()));

		// Verify required environment variables
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!supabaseUrl || !supabaseServiceKey) {
			throw new Error("Missing required environment variables");
		}

		// Create admin client
		const supabase = createClient(supabaseUrl, supabaseServiceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});

		// Initialize parser with the fields we want to extract
		const parser = new Parse(
			{
				keys: ["from", "subject", "text", "html", "headers"],
			},
			{
				body: Object.fromEntries(formData.entries()),
			},
		);

		// Extract key values from the email
		const emailData = parser.keyValues();
		console.log("Parsed email data:", emailData);

		// Verify we have some content to process
		if (!emailData.text && !emailData.html) {
			console.error("No email content provided");
			throw new Error("No email content provided");
		}

		// Parse sender info from the From header
		const fromHeader = emailData.from;
		if (!fromHeader) {
			console.error("Missing from header");
			throw new Error("Missing from header");
		}

		// Parse email and name from the From header
		const emailMatch = fromHeader.match(/<(.+?)>/);
		const fromEmail = emailMatch ? emailMatch[1] : fromHeader;
		const nameMatch = fromHeader.match(/^([^<]+?)\s*</);
		const fullName = nameMatch ? nameMatch[1].trim() : fromEmail.split("@")[0];

		console.log("Parsed sender info:", {
			fromEmail,
			fullName,
		});

		if (!fromEmail.includes("@")) {
			console.error("Invalid email format:", fromEmail);
			throw new Error("Invalid email format");
		}

		// Get company based on the recipient email
		const envelope = formData.get("envelope");
		let toEmail: string | null = null;

		if (envelope) {
			try {
				const parsedEnvelope = JSON.parse(envelope as string);
				toEmail = Array.isArray(parsedEnvelope.to)
					? parsedEnvelope.to[0]
					: parsedEnvelope.to;
			} catch (e) {
				console.error("Failed to parse envelope:", e);
			}
		}

		if (!toEmail) {
			console.error("No recipient email found");
			throw new Error("No recipient email found");
		}

		// Get company by email
		console.log("Fetching company for email:", toEmail);
		const { data: company } = await supabase
			.from("companies")
			.select("id")
			.eq("email", toEmail)
			.single();

		console.log("Company found:", company);

		if (!company) {
			throw new Error("No company found to handle the email");
		}

		// Extract Message-ID from headers
		const headers = emailData.headers || "";
		const messageIdMatch = headers.match(/Message-Id:\s*<([^>]+)>/i);
		const messageId = messageIdMatch ? messageIdMatch[1] : null;

		if (!messageId) {
			console.error("No Message-ID found in headers");
			throw new Error("No Message-ID found in headers");
		}

		// Extract In-Reply-To and References headers
		const inReplyToMatch = headers.match(/In-Reply-To:\s*<([^>]+)>/i);
		const inReplyTo = inReplyToMatch ? inReplyToMatch[1] : null;

		const referencesMatch = headers.match(/References:\s*(.*?)(?:\r?\n\S|$)/i);
		const references = referencesMatch
			? referencesMatch[1]
					.split(/\s+/)
					.map((ref: string) => ref.replace(/[<>]/g, ""))
					.filter(Boolean)
			: [];

		console.log("Email headers parsed:", {
			messageId,
			inReplyTo,
			references,
		});

		// If this is a reply, try to find the existing ticket
		let existingTicketId: number | null = null;
		if (inReplyTo || references.length > 0) {
			const searchMessageIds = [inReplyTo, ...references].filter(Boolean);
			console.log(
				"Looking for existing ticket with message IDs:",
				searchMessageIds,
			);

			const { data: existingMessage } = await supabase
				.from("messages")
				.select("ticket_id")
				.in("email_message_id", searchMessageIds)
				.order("created_at", { ascending: true })
				.limit(1)
				.single();

			if (existingMessage) {
				existingTicketId = existingMessage.ticket_id;
				console.log("Found existing ticket:", existingTicketId);
			}
		}

		// Check if this email has been processed before
		const { data: isNewEmail } = await supabase.rpc("check_and_record_email", {
			p_message_id: messageId,
			p_company_id: company.id,
		});

		if (!isNewEmail) {
			console.log("Duplicate email detected, skipping processing");
			return NextResponse.json({ status: "skipped", reason: "duplicate" });
		}

		// Check if user exists
		console.log("Checking for existing profile...");
		const { data: existingProfile } = await supabase
			.from("profiles")
			.select("id")
			.eq("email", fromEmail)
			.eq("company_id", company.id)
			.single();

		console.log("Existing profile:", existingProfile);

		let customerId: string;

		if (!existingProfile) {
			console.log("No existing profile found, creating new user...");
			// Create auth user
			const { data: authData, error: signUpError } =
				await supabase.auth.admin.createUser({
					email: fromEmail,
					email_confirm: true,
					user_metadata: {
						full_name: fullName,
						role: "customer",
						company_id: company.id,
					},
				});

			if (signUpError) {
				console.error("Error creating auth user:", signUpError);
				throw signUpError;
			}
			if (!authData.user) {
				console.error("No user data returned");
				throw new Error("Failed to create user");
			}

			console.log("Auth user created:", {
				id: authData.user.id,
				email: authData.user.email,
			});

			customerId = authData.user.id;
		} else {
			console.log("Using existing profile");
			customerId = existingProfile.id;
		}

		if (existingTicketId) {
			// Add message to existing ticket
			// Clean up email content by removing quoted text
			const cleanContent =
				emailData.text?.split(/\r?\n\s*>[^\n]*/)[0].trim() ||
				emailData.html?.split(/\r?\n\s*>[^\n]*/)[0].trim() ||
				"No content provided";

			const { data: message, error: messageError } = await supabase
				.from("messages")
				.insert({
					ticket_id: existingTicketId,
					sender_id: customerId,
					content: cleanContent,
					type: "user",
					email_message_id: messageId,
					email_references: references,
				})
				.select()
				.single();

			if (messageError) {
				throw messageError;
			}

			console.log("Added reply to existing ticket:", {
				ticketId: existingTicketId,
				messageId: message.id,
				content: cleanContent,
			});

			return NextResponse.json({
				success: true,
				ticket_id: existingTicketId,
				is_reply: true,
			});
		}

		// Only fetch focus areas and use LLM for new tickets
		let focusAreaValue: string | null = null;
		if (!existingTicketId) {
			// Fetch available focus areas for this company
			console.log("Fetching focus areas...");
			const { data: focusAreas } = await supabase
				.from("focus_areas")
				.select("name")
				.eq("company_id", company.id);

			console.log("Focus areas found:", focusAreas);

			// Auto-generate ticket focus area
			const model = new ChatOpenAI({
				model: "gpt-4o-mini",
				temperature: 0,
			});

			const focusArea = z.object({
				focusArea: z.string().describe("The focus area of the ticket"),
			});

			const structuredLLM = model.withStructuredOutput(focusArea);
			const prompt = `Specify the most relevant focus area for this customer support ticket. Select from the available options: ${focusAreas?.map((fa) => fa.name).join(", ")}. If the ticket is not related to any of the focus areas, select 'Other'.

Email ${emailData.subject ? `Subject: ${emailData.subject}` : "has no subject"}

Content to analyze: ${emailData.text || emailData.html}`;

			console.log("Sending prompt to LLM:", prompt);

			const chosenFocusArea = await structuredLLM.invoke(prompt);
			console.log("Chosen focus area:", chosenFocusArea);

			// Convert 'Other' focus area to null
			focusAreaValue =
				chosenFocusArea.focusArea === "Other"
					? null
					: chosenFocusArea.focusArea;
		}

		// Process the email
		console.log("Processing email with params:", {
			customer_id: customerId,
			target_company_id: company.id,
			from_email: fromEmail,
			has_subject: !!emailData.subject,
			has_text: !!emailData.text,
			has_html: !!emailData.html,
			focus_area: focusAreaValue,
			message_id: messageId,
			existing_ticket_id: existingTicketId,
		});

		// If no existing ticket found, create a new one
		const { data, error } = await supabase.rpc("process_inbound_email", {
			customer_id: customerId,
			target_company_id: company.id,
			from_email: fromEmail,
			subject: emailData.subject || "",
			text_content: emailData.text || "",
			html_content: emailData.html || "",
			focus_area: focusAreaValue,
			message_id: messageId,
		});

		if (error) {
			console.error("Error processing email:", error);
			throw error;
		}

		console.log("Email processed successfully:", data);
		console.log("=== INBOUND EMAIL PROCESSING COMPLETED ===");

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error in inbound email route:", error);
		return NextResponse.json(
			{ error: "Failed to process message" },
			{ status: 500 },
		);
	}
}
