import { beforeEach, expect, it, vi } from "vitest";
import { db } from "#/db";
import {
	address,
	checkoutSession,
	orderCartCleanup,
	orderItem,
	orderNotification,
	orders,
	user,
} from "#/db/schema";
import {
	getCheckout,
	prepareCheckout,
	submitCheckout,
	uploadProof,
} from "#/features/checkout/checkout.server";
import { calculateQuote } from "#/features/checkout/checkout-quote.server";

const state = vi.hoisted(() => ({
	cleanup: vi.fn(),
	cart: vi.fn(),
	currentCartId: vi.fn(),
	pricing: vi.fn(),
}));
vi.mock("#/db", async () => ({
	db: await (await import("../../support/postgres")).testDatabase(),
}));
vi.mock("#/features/cart/cart.server", () => ({
	cart: { getForCheckout: state.cart, getId: state.currentCartId },
}));
vi.mock("#/features/checkout/cart-cleanup.server", () => ({
	processCartCleanup: state.cleanup,
}));
vi.mock("#/features/checkout/checkout-config.server", () => ({
	checkoutPricing: state.pricing,
}));
const id = "00000000-0000-4000-8000-000000000001";
const cartId = "00000000-0000-4000-8000-000000000002";
const quote = calculateQuote(
	[
		{
			id,
			name: "Shoes (Black, 8)",
			color: "Black",
			size: "8",
			price: 13500,
			currency: "GEL",
			quantity: 1,
			image: null,
			shipping: {
				groupId: "store-a",
				rule: { flatRateUsd: 700, freeFromUsd: 9900 },
				estimatedUnitUsd: null,
			},
		},
	],
	{
		gelPerUsd: 2.7,
		rateDate: "2026-10-26T00:00:00Z",
		serviceFeeBps: 500,
		iban: "GE29NB0000000101904917",
	},
);
const shippingAddress = {
	fullName: "Buyer",
	phone: "1234567",
	line1: "123 Main",
	line2: "",
	city: "Wilmington",
	state: "DE",
	postalCode: "19804",
	country: "US",
};
const draft = {
	id,
	userId: "buyer",
	cartId,
	quote,
	shippingAddress,
	proofBase64: "private-proof",
	proofType: "image/png",
	submittedAt: null,
};

async function saveDraft(
	fields: Partial<typeof checkoutSession.$inferInsert> = {},
) {
	await db
		.insert(checkoutSession)
		.values({ ...draft, expiresAt: new Date(Date.now() + 60_000), ...fields });
}

beforeEach(async () => {
	await db.delete(orders);
	await db.delete(checkoutSession);
	await db.delete(user);
	await db
		.insert(user)
		.values({ id: "buyer", name: "Buyer", email: "buyer@example.com" });
	await db.insert(address).values({ ...shippingAddress, id, userId: "buyer" });
	vi.resetAllMocks();
	state.pricing.mockResolvedValue(quote.pricing);
	state.cart.mockResolvedValue({
		cartId,
		items: quote.lines,
		offerExpiresAt: Infinity,
		supplierPages: {},
	});
});

it("resumes a prepared checkout without fetching a new exchange rate", async () => {
	await saveDraft();
	expect(await prepareCheckout("buyer", id, id)).toMatchObject({ id, quote });
	expect(state.pricing).not.toHaveBeenCalled();
});

it("restores legacy quote totals and the original rate date", async () => {
	const {
		totalGel,
		pricing: { rateDate, ...pricing },
		...old
	} = quote;
	await saveDraft();
	await db.$client.query(
		"UPDATE checkout_session SET quote = $1 WHERE id = $2",
		[
			JSON.stringify({
				...old,
				paymentTotal: totalGel,
				pricing: {
					...pricing,
					paymentCurrency: "GEL",
					rateUpdatedAt: rateDate,
				},
			}),
			id,
		],
	);
	expect((await getCheckout("buyer", id)).quote).toMatchObject(quote);
});

it("returns a concurrent checkout created while pricing was unavailable", async () => {
	state.pricing.mockImplementationOnce(async () => {
		await saveDraft();
		return null;
	});
	expect(await prepareCheckout("buyer", id, id)).toMatchObject({ id, quote });
});

it("requires ownership before reading or uploading a receipt", async () => {
	await saveDraft();
	await expect(getCheckout("other", id)).rejects.toThrow("Checkout not found");
	await expect(
		uploadProof("other", id, new File(["proof"], "proof.png")),
	).rejects.toThrow("Checkout not found");
});

it("reports missing proof as a boolean and rejects submission before proof is uploaded", async () => {
	await saveDraft({ proofBase64: null, proofType: null });
	expect((await getCheckout("buyer", id)).proofUploaded).toBe(false);
	await expect(submitCheckout("buyer", id)).rejects.toThrow(
		"Upload your payment screenshot",
	);
	expect(await db.select().from(orders)).toEqual([]);
	expect(state.cleanup).not.toHaveBeenCalled();
});

it("keeps an order, purchased lines and jobs together across a retry", async () => {
	await saveDraft();
	const first = await submitCheckout("buyer", id);
	expect(await submitCheckout("buyer", id)).toEqual(first);
	expect(first).toMatchObject({
		id,
		proofUploaded: true,
		submittedAt: expect.any(String),
	});
	expect(first).not.toHaveProperty("proofBase64");
	expect(await db.select().from(orders)).toMatchObject([
		{
			id,
			userId: "buyer",
			status: "pending",
			currency: "USD",
			total: 5950,
			checkoutQuote: quote,
			customerEmail: "buyer@example.com",
		},
	]);
	expect(await db.select().from(orderItem)).toMatchObject([
		{
			orderId: id,
			skuId: id,
			price: 5000,
			quantity: 1,
			name: "Shoes (Black, 8)",
		},
	]);
	expect(await db.select().from(orderNotification)).toMatchObject([
		{ orderId: id },
	]);
	expect(await db.select().from(orderCartCleanup)).toMatchObject([
		{ orderId: id, cartId, lines: [{ id, quantity: 1 }] },
	]);
	expect(state.cleanup).toHaveBeenCalledExactlyOnceWith(id);
});

it("rolls back the order and draft status if its notification cannot be saved", async () => {
	await saveDraft();
	await db.$client.query(
		"ALTER TABLE order_notification ADD CONSTRAINT reject_job CHECK (false)",
	);
	try {
		await expect(submitCheckout("buyer", id)).rejects.toThrow();
		expect(await db.select().from(orders)).toEqual([]);
		expect(await db.select().from(orderItem)).toEqual([]);
		expect((await getCheckout("buyer", id)).submittedAt).toBeNull();
		expect(state.cleanup).not.toHaveBeenCalled();
	} finally {
		await db.$client.query(
			"ALTER TABLE order_notification DROP CONSTRAINT reject_job",
		);
	}
});

it("queues cleanup for a draft without a saved cart when a cart cookie exists", async () => {
	await saveDraft({ cartId: null });
	state.currentCartId.mockReturnValue(cartId);
	await submitCheckout("buyer", id);
	expect((await db.select().from(orderCartCleanup))[0]).toMatchObject({
		orderId: id,
		cartId,
	});
});

it("preserves snapshots of multiple items, including a removed SKU", async () => {
	const first = quote.lines[0];
	if (!first) throw new Error("Missing test line");
	const second = { ...first, id: crypto.randomUUID(), name: "Removed product" };
	await saveDraft({ quote: calculateQuote([first, second], quote.pricing) });
	await submitCheckout("buyer", id);
	expect(await db.select().from(orderItem)).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ skuId: first.id }),
			expect.objectContaining({ skuId: second.id, name: second.name }),
		]),
	);
});

it("blocks checkout if a warehouse has no shipping rule", async () => {
	state.cart.mockResolvedValue({
		cartId,
		items: quote.lines.map((line) => ({ ...line, shipping: undefined })),
	});
	await expect(prepareCheckout("buyer", id, id)).rejects.toThrow(
		"Shipping is not available",
	);
	expect((await db.select().from(checkoutSession))[0]).toBeUndefined();
});

it("persists the per-warehouse breakdown once for concurrent preparations", async () => {
	await Promise.all([
		prepareCheckout("buyer", id, id),
		prepareCheckout("buyer", id, id),
	]);
	expect(await db.select().from(checkoutSession)).toMatchObject([
		{ cartId, quote: { shipments: quote.shipments, shippingUsd: 700 } },
	]);
});

it("caps payment instructions at the earliest quoted supplier expiry across retries", async () => {
	const expiry = new Date(Date.now() + 60_000).toISOString();
	const supplierPages = { [id]: "https://private.example/p/123" };
	state.cart.mockResolvedValue({
		cartId,
		items: quote.lines,
		offerExpiresAt: Date.parse(expiry),
		supplierPages,
	});
	const saved = await prepareCheckout("buyer", id, id);
	expect(saved.expiresAt).toBe(expiry);
	expect(JSON.stringify(saved)).not.toContain("private.example");
	expect((await db.select().from(checkoutSession))[0]?.supplierPages).toEqual(
		supplierPages,
	);
	state.cart.mockRejectedValue(new Error("catalog offline"));
	expect((await prepareCheckout("buyer", id, id)).expiresAt).toBe(expiry);
});

it("rejects an observation that expired while preparing the quote", async () => {
	state.cart.mockResolvedValue({
		cartId,
		items: quote.lines,
		offerExpiresAt: 0,
	});
	await expect(prepareCheckout("buyer", id, id)).rejects.toThrow(
		"no longer available",
	);
	expect((await db.select().from(checkoutSession))[0]).toBeUndefined();
});

it("preserves a catalog outage error", async () => {
	const error = new Error("catalog unavailable");
	state.cart.mockRejectedValueOnce(error);
	await expect(prepareCheckout("buyer", id, id)).rejects.toBe(error);
	expect((await db.select().from(checkoutSession))[0]).toBeUndefined();
});
