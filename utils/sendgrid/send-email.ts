import { MailService } from "@sendgrid/mail";

const sendgrid = new MailService();
const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
	throw new Error("SENDGRID_API_KEY environment variable is not set");
}

sendgrid.setApiKey(apiKey);

type SendThreadedEmailParams = {
	from: string; // Company's email address
	to: string; // Customer's email address
	subject: string;
	content: string;
	inReplyTo?: string; // Original Message-ID to reply to
	references?: string[]; // Array of previous Message-IDs in the thread
};

export async function sendThreadedEmail({
	from,
	to,
	subject,
	content,
	inReplyTo,
	references = [],
}: SendThreadedEmailParams) {
	// Generate a new Message-ID for this email
	const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@switchboard.mattstanbrell.com>`;

	// Combine previous references with the in-reply-to message ID
	const allReferences = [...references];
	if (inReplyTo && !allReferences.includes(inReplyTo)) {
		allReferences.push(inReplyTo);
	}

	const msg = {
		to,
		from,
		subject,
		text: content,
		headers: {
			"Message-ID": messageId,
			...(inReplyTo && { "In-Reply-To": inReplyTo }),
			...(allReferences.length > 0 && { References: allReferences.join(" ") }),
		},
	};

	await sendgrid.send(msg);

	return {
		messageId,
		references: allReferences,
	};
}
