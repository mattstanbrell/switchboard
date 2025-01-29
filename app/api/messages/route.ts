import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendThreadedEmail } from "@/utils/sendgrid/send-email";

type SupabaseTicket = {
	id: number;
	email: string | null;
	customer_id: string;
	profiles: {
		company_id: string;
		companies: {
			email: string;
		};
	};
};

export async function POST(request: Request) {
	console.log("POST /api/messages - Handler started");
	try {
		console.log("Checking environment variables...");
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!supabaseUrl || !supabaseServiceKey) {
			throw new Error("Missing required environment variables");
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});

		const body = await request.json();
		const { ticketId, content, senderId } = body;

		console.log("Looking up ticket:", { ticketId, content, senderId });

		// Get ticket details including customer email and company email
		const { data: ticket, error: ticketError } = await supabase
			.from("tickets")
			.select(`
        id,
        email,
        customer_id,
        profiles!tickets_customer_id_fkey (
          company_id,
          companies:companies (
            email
          )
        )
      `)
			.eq("id", ticketId)
			.single();

		console.log("Ticket lookup result:", { ticket, error: ticketError });

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		const typedTicket = ticket as unknown as SupabaseTicket;

		// Get the original message's email headers if they exist
		const { data: allMessages } = await supabase
			.from("messages")
			.select("*")
			.eq("ticket_id", ticketId)
			.order("created_at", { ascending: true });

		console.log("All messages in ticket:", {
			ticketId,
			messageCount: allMessages?.length,
			messages: allMessages?.map((m) => ({
				id: m.id,
				type: m.type,
				sender_id: m.sender_id,
				hasEmailId: Boolean(m.email_message_id),
				emailId: m.email_message_id,
				hasRefs: Boolean(m.email_references),
				created_at: m.created_at,
			})),
		});

		const { data: originalMessage } = await supabase
			.from("messages")
			.select("email_message_id, email_references")
			.eq("ticket_id", ticketId)
			.not("email_message_id", "is", null)
			.order("created_at", { ascending: true })
			.limit(1)
			.single();

		console.log("Original message headers:", {
			originalMessage,
			hasMessageId: Boolean(originalMessage?.email_message_id),
			hasReferences: Boolean(originalMessage?.email_references),
			ticketId,
		});

		// Insert the message into the database
		const { data: message, error: messageError } = await supabase
			.from("messages")
			.insert({
				ticket_id: ticketId,
				sender_id: senderId,
				content,
				type: "user",
			})
			.select()
			.single();

		if (messageError) {
			throw messageError;
		}

		// If the ticket has an associated email, send an email reply
		console.log("Checking email conditions:", {
			hasTicketEmail: Boolean(typedTicket.email),
			hasProfiles: Boolean(typedTicket.profiles),
			hasCompanies: Boolean(typedTicket.profiles?.companies),
			companiesArray: typedTicket.profiles?.companies,
			ticketEmail: typedTicket.email,
			fullProfiles: typedTicket.profiles,
		});

		if (
			typedTicket.email &&
			typedTicket.profiles &&
			typedTicket.profiles.companies
		) {
			console.log("Email conditions met, preparing to send email");
			console.log("Sending email with:", {
				from: typedTicket.profiles.companies.email,
				to: typedTicket.email,
				subject: `Re: Ticket #${ticketId}`,
				hasInReplyTo: Boolean(originalMessage?.email_message_id),
				hasReferences: Boolean(originalMessage?.email_references),
				content:
					content.substring(0, 100) + (content.length > 100 ? "..." : ""),
			});

			try {
				const { messageId, references } = await sendThreadedEmail({
					from: typedTicket.profiles.companies.email,
					to: typedTicket.email,
					subject: `Re: Ticket #${ticketId}`,
					content,
					inReplyTo: originalMessage?.email_message_id,
					references: originalMessage?.email_references || [],
				});

				console.log("Email sent successfully:", { messageId, references });

				// Update the message with the email headers
				const { error: updateError } = await supabase
					.from("messages")
					.update({
						email_message_id: messageId,
						email_references: references,
					})
					.eq("id", message.id);

				if (updateError) {
					console.error(
						"Error updating message with email headers:",
						updateError,
					);
				} else {
					console.log("Successfully updated message with email headers");
				}
			} catch (emailError) {
				console.error("Error sending email:", emailError);
				throw emailError;
			}
		} else {
			console.log("Email conditions not met, skipping email send");
		}

		return NextResponse.json(message);
	} catch (error) {
		console.error("Error in messages route:", error);
		return NextResponse.json(
			{ error: "Failed to send message" },
			{ status: 500 },
		);
	}
}
