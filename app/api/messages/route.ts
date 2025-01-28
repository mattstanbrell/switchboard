import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendThreadedEmail } from "@/utils/sendgrid/send-email";

type SupabaseTicket = {
	id: number;
	email: string | null;
	customer_id: string;
	profiles: {
		email: string;
	}[];
	companies: {
		email: string;
	}[];
};

export async function POST(request: Request) {
	try {
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

		// Get ticket details including customer email and company email
		const { data: ticket } = await supabase
			.from("tickets")
			.select(`
        id,
        email,
        customer_id,
        profiles!tickets_customer_id_fkey (
          email
        ),
        companies (
          email
        )
      `)
			.eq("id", ticketId)
			.single();

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		const typedTicket = ticket as SupabaseTicket;

		// Get the original message's email headers if they exist
		const { data: originalMessage } = await supabase
			.from("messages")
			.select("email_message_id, email_references")
			.eq("ticket_id", ticketId)
			.order("created_at", { ascending: true })
			.limit(1)
			.single();

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
		if (
			typedTicket.email &&
			typedTicket.profiles[0] &&
			typedTicket.companies[0]
		) {
			const { messageId, references } = await sendThreadedEmail({
				from: typedTicket.companies[0].email,
				to: typedTicket.profiles[0].email,
				subject: `Re: Ticket #${ticketId}`,
				content,
				inReplyTo: originalMessage?.email_message_id,
				references: originalMessage?.email_references || [],
			});

			// Update the message with the email headers
			await supabase
				.from("messages")
				.update({
					email_message_id: messageId,
					email_references: references,
				})
				.eq("id", message.id);
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
