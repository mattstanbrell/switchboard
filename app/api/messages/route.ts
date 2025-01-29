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

		// Get the original message to determine if this is an email ticket
		const { data: originalMessage } = await supabase
			.from("messages")
			.select("email_message_id, email_references")
			.eq("ticket_id", ticketId)
			.eq("type", "user")
			.order("created_at", { ascending: true })
			.limit(1)
			.single();

		console.log("Original message:", {
			hasEmailId: Boolean(originalMessage?.email_message_id),
			emailId: originalMessage?.email_message_id,
			references: originalMessage?.email_references,
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

		// Only send email if this ticket originated from email
		if (
			originalMessage?.email_message_id &&
			typedTicket.email &&
			typedTicket.profiles &&
			typedTicket.profiles.companies
		) {
			console.log("Email ticket - preparing to send email reply");
			console.log("Sending email with:", {
				from: typedTicket.profiles.companies.email,
				to: typedTicket.email,
				subject: `Re: Ticket #${ticketId}`,
				inReplyTo: originalMessage.email_message_id,
				references: originalMessage.email_references,
			});

			try {
				const { messageId, references } = await sendThreadedEmail({
					from: typedTicket.profiles.companies.email,
					to: typedTicket.email,
					subject: `Re: Ticket #${ticketId}`,
					content,
					inReplyTo: originalMessage.email_message_id,
					references: originalMessage.email_references || [],
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
			console.log(
				"Not an email ticket or missing required data - skipping email send",
			);
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
