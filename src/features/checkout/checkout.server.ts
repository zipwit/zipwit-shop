import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, type Transaction } from "#/db";
import {
	address,
	checkoutSession,
	orderCartCleanup,
	orderItem,
	orderNotification,
	orders,
	user,
} from "#/db/schema";
import { cart } from "#/features/cart/cart.server";
import { ensure } from "#/server/public-error";
import { processCartCleanup } from "./cart-cleanup.server";
import {
	type CheckoutView,
	QUOTE_LIFETIME_MS,
	usAddressSchema,
} from "./checkout";
import { checkoutPricing } from "./checkout-config.server";
import { calculateQuote, restoreCheckoutQuote } from "./checkout-quote.server";
import { readPaymentProof } from "./payment-proof.server";

const mine = (userId: string, id: string) =>
	and(eq(checkoutSession.id, id), eq(checkoutSession.userId, userId));
const publicColumns = {
	id: checkoutSession.id,
	quote: checkoutSession.quote,
	address: checkoutSession.shippingAddress,
	expiresAt: checkoutSession.expiresAt,
	submittedAt: checkoutSession.submittedAt,
	proofUploaded:
		sql<boolean>`${checkoutSession.proofBase64} is not null`.mapWith(Boolean),
};

export async function getCheckout(
	userId: string,
	id: string,
): Promise<CheckoutView> {
	const [row] = await db
		.select(publicColumns)
		.from(checkoutSession)
		.where(mine(userId, id));
	ensure(row, "Checkout not found.");
	return {
		...row,
		quote: restoreCheckoutQuote(row.quote),
		expiresAt: row.expiresAt.toISOString(),
		submittedAt: row.submittedAt?.toISOString() ?? null,
	};
}

async function checkedAddress(
	tx: Transaction,
	userId: string,
	addressId: string,
) {
	const [saved] = await tx
		.select()
		.from(address)
		.where(and(eq(address.id, addressId), eq(address.userId, userId)));
	const destination = usAddressSchema.safeParse(
		saved && { ...saved, line2: saved.line2 ?? "" },
	);
	ensure(
		destination.success,
		"Select a valid U.S. delivery address with a ZIP code.",
	);
	return destination.data;
}

async function quoteCart() {
	const pricing = await checkoutPricing();
	ensure(
		pricing,
		"Checkout is temporarily unavailable. Please try again later.",
	);
	const { cartId, items, supplierPages, offerExpiresAt } =
		await cart.getForCheckout();
	ensure(cartId && items.length, "Your cart is empty");

	const expiresAt = new Date(
		Math.min(Date.now() + QUOTE_LIFETIME_MS, offerExpiresAt),
	);
	return {
		cartId,
		quote: calculateQuote(items, pricing),
		expiresAt,
		supplierPages,
	};
}

const existingDraft = async (
	userId: string,
	id: string,
	connection: typeof db | Transaction = db,
) =>
	(
		await connection
			.select({ id: checkoutSession.id })
			.from(checkoutSession)
			.where(mine(userId, id))
			.limit(1)
	)[0];

/** Retries return the saved quote even if a pricing or cart service is now unavailable. */
export async function prepareCheckout(
	userId: string,
	id: string,
	addressId: string,
) {
	if (await existingDraft(userId, id)) return getCheckout(userId, id);
	let snapshot: Awaited<ReturnType<typeof quoteCart>>;
	try {
		snapshot = await quoteCart();
	} catch (error) {
		if (await existingDraft(userId, id)) return getCheckout(userId, id);
		throw error;
	}
	await db.transaction(async (tx) => {
		await tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, userId))
			.for("update");
		if (await existingDraft(userId, id, tx)) return;
		ensure(
			snapshot.expiresAt.getTime() > Date.now(),
			"Some cart items are no longer available. Please review your cart.",
		);
		const recent = await tx
			.select({ id: checkoutSession.id })
			.from(checkoutSession)
			.where(
				and(
					eq(checkoutSession.userId, userId),
					gt(
						checkoutSession.createdAt,
						new Date(Date.now() - QUOTE_LIFETIME_MS),
					),
				),
			)
			.limit(10);
		ensure(
			recent.length < 10,
			"Too many checkout attempts. Please try again later.",
		);
		await tx.insert(checkoutSession).values({
			id,
			userId,
			...snapshot,
			shippingAddress: await checkedAddress(tx, userId, addressId),
		});
	});
	return getCheckout(userId, id);
}

/**
 * Verifies ownership before reading the receipt. Accepts evidence after quote
 * expiry because the customer may already have transferred the payment.
 */
export async function uploadProof(userId: string, id: string, file: File) {
	const current = await getCheckout(userId, id);
	ensure(!current.submittedAt, "This order has already been submitted.");
	const proof = await readPaymentProof(file);
	const updated = await db
		.update(checkoutSession)
		.set({ proofBase64: proof.base64, proofType: proof.type })
		.where(and(mine(userId, id), isNull(checkoutSession.submittedAt)));
	ensure(updated.rowCount === 1, "This order has already been submitted.");
	return getCheckout(userId, id);
}

async function insertPendingOrder(
	tx: Transaction,
	draft: typeof checkoutSession.$inferSelect,
	customer: Pick<typeof user.$inferSelect, "name" | "email">,
	placedAt: Date,
) {
	await tx.insert(orders).values({
		id: draft.id,
		userId: draft.userId,
		status: "pending",
		currency: "USD",
		total: draft.quote.totalUsd,
		shippingAddress: draft.shippingAddress,
		checkoutQuote: draft.quote,
		customerName: customer.name,
		customerEmail: customer.email,
		createdAt: placedAt,
	});
	await tx.insert(orderItem).values(
		draft.quote.lines.map((line) => ({
			orderId: draft.id,
			skuId: line.id,
			name: line.name,
			price: line.usdPrice,
			quantity: line.quantity,
			imageUrl: line.image,
			color: line.color,
			size: line.size,
		})),
	);
	await tx.insert(orderNotification).values({ orderId: draft.id });
}

function commitCheckout(userId: string, id: string) {
	return db.transaction(async (tx) => {
		const [draft] = await tx
			.select()
			.from(checkoutSession)
			.where(mine(userId, id))
			.for("update");
		ensure(draft, "Checkout not found.");
		if (draft.submittedAt) return false;
		ensure(
			draft.proofBase64 && draft.proofType,
			"Upload your payment screenshot before placing the order.",
		);
		const [customer] = await tx
			.select({ name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, userId));
		ensure(customer, "Please sign in to continue.");
		draft.quote = restoreCheckoutQuote(draft.quote);
		const placedAt = new Date();
		await insertPendingOrder(tx, draft, customer, placedAt);
		const cartId = draft.cartId ?? cart.getId();
		if (cartId) {
			await tx.insert(orderCartCleanup).values({
				orderId: id,
				cartId,
				lines: draft.quote.lines.map(({ id, quantity }) => ({
					id,
					quantity,
				})),
			});
		}
		await tx
			.update(checkoutSession)
			.set({ submittedAt: placedAt })
			.where(mine(userId, id));
		return Boolean(cartId);
	});
}

/** Commit the pending order and its jobs together, then try cart cleanup. */
export async function submitCheckout(userId: string, id: string) {
	if (await commitCheckout(userId, id)) {
		try {
			await processCartCleanup(id);
		} catch {
			console.error("Order saved; cart cleanup remains queued", {
				orderId: id,
			});
		}
	}
	return getCheckout(userId, id);
}
