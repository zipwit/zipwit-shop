import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "#/db";
import { checkoutSession, orderNotification, orders } from "#/db/schema";
import { sendEmail } from "#/features/auth/email.server";
import { env } from "#/server/env.server";
import { orderMessages } from "./telegram-message";

async function telegram(
	method: string,
	body: FormData | Record<string, unknown>,
) {
	const isForm = body instanceof FormData;
	const response = await fetch(
		`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
		{
			method: "POST",
			body: isForm ? body : JSON.stringify(body),
			headers: isForm ? undefined : { "Content-Type": "application/json" },
			signal: AbortSignal.timeout(15_000),
		},
	);
	const result: unknown = await response.json();
	if (
		!response.ok ||
		typeof result !== "object" ||
		result === null ||
		!("ok" in result) ||
		result.ok !== true
	)
		throw new Error("Telegram rejected notification");
}

const ALERT_AFTER_ATTEMPTS = 5;

async function alertOps(orderId: string, attempts: number) {
	if (!env.OPS_ALERT_EMAIL || attempts !== ALERT_AFTER_ATTEMPTS) return;
	try {
		await sendEmail({
			to: env.OPS_ALERT_EMAIL,
			subject: "Order notification is failing",
			html: `<p>Telegram delivery for order <code>${orderId}</code> has failed ${attempts} times. Check the order team's Telegram chat and the checkout-notifications logs.</p>`,
		});
	} catch {
		console.error("Ops alert email failed", { orderId });
	}
}

function claimNotification(orderId?: string) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [pending] = await tx
			.select()
			.from(orderNotification)
			.where(
				and(
					isNull(orderNotification.sentAt),
					lt(orderNotification.nextAttemptAt, now),
					or(
						isNull(orderNotification.leaseUntil),
						lt(orderNotification.leaseUntil, now),
					),
					orderId ? eq(orderNotification.orderId, orderId) : undefined,
				),
			)
			.orderBy(orderNotification.nextAttemptAt)
			.limit(1)
			.for("update", { skipLocked: true });
		if (!pending) return null;
		await tx
			.update(orderNotification)
			.set({
				leaseUntil: new Date(Date.now() + 10 * 60_000),
				attempts: pending.attempts + 1,
			})
			.where(eq(orderNotification.orderId, pending.orderId));
		return pending;
	});
}

async function sendOrderMessages(
	orderId: string,
	chatId: string,
	messages: string[],
	nextMessage: number,
) {
	for (let i = nextMessage; i < messages.length; i++) {
		await telegram("sendMessage", {
			chat_id: chatId,
			text: messages[i],
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
		});
		await db
			.update(orderNotification)
			.set({ nextMessage: i + 1 })
			.where(eq(orderNotification.orderId, orderId));
	}
}

async function sendPaymentProof(
	orderId: string,
	chatId: string,
	proofBase64: string,
	proofType: string,
) {
	const file = new FormData();
	file.set("chat_id", chatId);
	file.set(
		"caption",
		`Payment proof — order ${orderId}\nAwaiting bank verification`,
	);
	const extension =
		proofType === "image/png"
			? "png"
			: proofType === "image/jpeg"
				? "jpg"
				: "webp";
	file.set(
		"document",
		new Blob([Buffer.from(proofBase64, "base64")], {
			type: proofType,
		}),
		`payment-${orderId}.${extension}`,
	);
	await telegram("sendDocument", file);
}

/**
 * Delivers notifications at least once and saves progress after each accepted message.
 * Failure logs omit request errors because a Telegram URL can contain the bot token.
 */
export async function deliverOrderNotification(orderId?: string) {
	const chatId = env.TELEGRAM_CHAT_ID;
	if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;
	const job = await claimNotification(orderId);
	if (!job) return false;
	try {
		const [order] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, job.orderId));
		const [draft] = await db
			.select()
			.from(checkoutSession)
			.where(eq(checkoutSession.id, job.orderId));
		if (!order?.checkoutQuote || !draft?.proofBase64 || !draft.proofType)
			throw new Error("Missing order snapshot");
		const messages = orderMessages({
			id: order.id,
			name: order.customerName ?? "",
			email: order.customerEmail ?? "",
			createdAt: order.createdAt,
			quote: order.checkoutQuote,
			address: draft.shippingAddress,
		});
		await sendOrderMessages(job.orderId, chatId, messages, job.nextMessage);
		if (!job.proofSent) {
			await sendPaymentProof(
				job.orderId,
				chatId,
				draft.proofBase64,
				draft.proofType,
			);
			await db
				.update(orderNotification)
				.set({ proofSent: true })
				.where(eq(orderNotification.orderId, job.orderId));
		}
		await db
			.update(orderNotification)
			.set({ sentAt: new Date(), leaseUntil: null })
			.where(eq(orderNotification.orderId, job.orderId));
	} catch {
		console.error("Telegram notification will be retried", {
			orderId: job.orderId,
		});
		await alertOps(job.orderId, job.attempts + 1);
		await db
			.update(orderNotification)
			.set({
				leaseUntil: null,
				nextAttemptAt: new Date(
					Date.now() +
						Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000,
				),
			})
			.where(eq(orderNotification.orderId, job.orderId));
	}
	return true;
}

/** Deletes quotes that expired over 30 days ago and have neither an order nor payment evidence. */
export async function cleanExpiredDrafts() {
	await db
		.delete(checkoutSession)
		.where(
			and(
				isNull(checkoutSession.submittedAt),
				isNull(checkoutSession.proofBase64),
				lt(
					checkoutSession.expiresAt,
					new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
				),
			),
		);
}
