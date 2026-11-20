import { getCookie, setCookie } from "@tanstack/react-start/server";
import { compact, keyBy } from "es-toolkit";
import { z } from "zod";
import { findCatalogSkus } from "#/features/catalog/catalog-read.server";
import { getGelPerUsd } from "#/features/checkout/exchange-rate.server";
import { unitPriceUsd } from "#/features/shipping/money.server";
import { getWarehouseShippingRules } from "#/features/shipping/warehouse-shipping.server";
import { publicStoreId } from "#/features/stores/store.server";
import { PublicError } from "#/server/public-error";
import { getRedis } from "#/server/redis.server";
import { type CartSnapshot, unavailableCartEntries } from "./cart";
import { CART_TTL_SECONDS, createCartStore } from "./cart-store.server";

const CART_COOKIE = "cartId";

const cookieId = () => z.uuid().safeParse(getCookie(CART_COOKIE)).data;
const keyFor = (id: string) => `cart:${id}`;

/** Issues or renews the visitor's cart cookie before adding an item. */
const cartKey = () => {
	const id = cookieId() ?? crypto.randomUUID();
	setCookie(CART_COOKIE, id, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: CART_TTL_SECONDS,
		path: "/",
	});
	return keyFor(id);
};

const store = async () => createCartStore(await getRedis(), findCatalogSkus);

/**
 * Joins saved quantities with current catalog prices and warehouse rules.
 * A preview lists unavailable entries for removal. Checkout rejects those
 * entries and lets the quote supply its own exchange rate.
 */
async function getCart(id: string | undefined, mode: "preview" | "checkout") {
	const entries = id
		? Object.entries(await (await getRedis()).hGetAll(keyFor(id)))
		: [];
	const available = keyBy(
		entries.length
			? await findCatalogSkus(entries.map(([field]) => field))
			: [],
		(sku) => sku.id,
	);
	const unavailableIds = unavailableCartEntries(
		entries,
		new Set(Object.keys(available)),
	).map(([id]) => id);
	const unavailable = new Set(unavailableIds);
	if (mode === "checkout" && unavailableIds.length) {
		throw new PublicError(
			"Some cart items are no longer available. Please review your cart.",
		);
	}

	const lines = compact(
		entries.map(([id, value]) => {
			const sku = available[id];
			if (!sku || unavailable.has(id)) return undefined;
			return { ...sku, quantity: Number(value) };
		}),
	);
	const [rules, rate] = await Promise.all([
		getWarehouseShippingRules(lines.map((line) => line.warehouse)),
		mode === "preview" && lines.some((line) => line.currency === "GEL")
			? getGelPerUsd()
			: null,
	]);
	const items = lines.map((line) => ({
		id: line.id,
		name: line.name,
		color: line.color,
		size: line.size,
		currency: line.currency,
		image: line.image,
		price: line.price,
		quantity: line.quantity,
		shipping: {
			groupId: publicStoreId(line.warehouse),
			rule: rules.get(line.warehouse) ?? null,
			estimatedUnitUsd: unitPriceUsd(
				line.price,
				line.currency,
				rate?.gelPerUsd ?? null,
			),
		},
	}));
	return {
		snapshot: { items, unavailableIds },
		supplierPages: Object.fromEntries(
			lines.flatMap((line) =>
				line.sourceUrl ? [[line.id, line.sourceUrl] as const] : [],
			),
		),
		offerExpiresAt: Math.min(
			...lines.flatMap((line) =>
				line.sourceExpiresAt ? [Date.parse(line.sourceExpiresAt)] : [],
			),
		),
	};
}

export const cart = {
	getId: cookieId,
	get: async () => (await getCart(cookieId(), "preview")).snapshot.items,
	getSnapshot: async (): Promise<CartSnapshot> =>
		(await getCart(cookieId(), "preview")).snapshot,
	async getForCheckout() {
		const cartId = cookieId();
		const { snapshot, supplierPages, offerExpiresAt } = await getCart(
			cartId,
			"checkout",
		);
		return { cartId, items: snapshot.items, supplierPages, offerExpiresAt };
	},

	async removeUnavailable() {
		const id = cookieId();
		if (id) await (await store()).removeUnavailable(keyFor(id));
	},

	async removePurchased(
		id: string,
		orderId: string,
		items: { id: string; quantity: number }[],
		deadline: Date,
	) {
		await (await store()).removePurchased(keyFor(id), orderId, items, deadline);
	},

	async acknowledgePurchaseCleanup(id: string, orderId: string) {
		await (await store()).acknowledgePurchaseCleanup(keyFor(id), orderId);
	},

	async add(skuId: string) {
		await (await store()).add(cartKey(), skuId);
	},

	async setQuantity(skuId: string, quantity: number) {
		const id = cookieId();
		if (id) await (await store()).setQuantity(keyFor(id), skuId, quantity);
	},

	/** Deletes every line in the visitor's cart. */
	async clear() {
		const id = cookieId();
		if (id) await (await getRedis()).del([keyFor(id)]);
	},
};
