import { getCookie, setCookie } from "@tanstack/react-start/server";
import { compact, keyBy } from "es-toolkit";
import { z } from "zod";
import { findCatalogSkus } from "#/features/catalog/catalog-read.server";
import { getGelPerUsd } from "#/features/checkout/exchange-rate.server";
import { unitPriceUsd } from "#/features/shipping/money.server";
import { getWarehouseShipping } from "#/features/shipping/warehouse-shipping.server";
import { PublicError } from "#/server/public-error";
import { getRedis } from "#/server/redis.server";
import { type CartSnapshot, unavailableCartEntries } from "./cart";
import { CART_TTL_SECONDS, createCartStore } from "./cart-store.server";

const CART_COOKIE = "cartId";

const cookieId = () => z.uuid().safeParse(getCookie(CART_COOKIE)).data;
const keyFor = (id: string) => `cart:${id}`;

/** The visitor's cart key, creating the cart (and its cookie) on first use. */
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
async function getCart(id = cookieId(), strict = false): Promise<CartSnapshot> {
	const entries = id
		? Object.entries(await (await getRedis()).hGetAll(keyFor(id)))
		: [];
	if (entries.length === 0) return { items: [], unavailableIds: [] };

	const available = keyBy(
		await findCatalogSkus(entries.map(([field]) => field)),
		(sku) => sku.id,
	);
	const unavailableIds = unavailableCartEntries(
		entries,
		new Set(Object.keys(available)),
	).map(([id]) => id);
	const unavailable = new Set(unavailableIds);
	if (strict && unavailableIds.length) {
		throw new PublicError(
			"Some cart items are no longer available. Please review your cart.",
		);
	}

	const rate =
		!strict && Object.values(available).some((sku) => sku.currency === "GEL")
			? await getGelPerUsd()
			: null;
	const items = compact(
		entries.map(([field, value]) => {
			const sku = available[String(field)];
			if (!sku || unavailable.has(field)) return undefined;
			const { warehouse, ...line } = sku;
			return {
				...line,
				quantity: Number(value),
				shipping: {
					...getWarehouseShipping(warehouse),
					estimatedUnitUsd: unitPriceUsd(
						sku.price,
						sku.currency,
						rate?.gelPerUsd ?? null,
					),
				},
			};
		}),
	);
	return { items, unavailableIds };
}

export const cart = {
	getId: cookieId,
	get: async () => (await getCart()).items,
	getSnapshot: () => getCart(),
	async getForCheckout() {
		const cartId = cookieId();
		return { cartId, items: cartId ? (await getCart(cartId, true)).items : [] };
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

	/** Empties the cart (for checkout to call once an order is placed). */
	async clear() {
		const id = cookieId();
		if (id) await (await getRedis()).del([keyFor(id)]);
	},
};
