import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	rows: vi.fn(),
	entries: vi.fn(),
	rate: vi.fn(),
	eval: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
	getCookie: () => "00000000-0000-4000-8000-000000000001",
	setCookie: vi.fn(),
}));
vi.mock("#/features/catalog/catalog-read.server", () => ({
	findCatalogSkus: mocks.rows,
}));
vi.mock("#/features/search/catalog-index.server", () => ({
	ensureCatalogReady: vi.fn(),
}));
vi.mock("#/server/redis.server", () => ({
	getRedis: async () => ({ hGetAll: mocks.entries, eval: mocks.eval }),
}));
vi.mock("#/features/checkout/exchange-rate.server", () => ({
	getGelPerUsd: mocks.rate,
}));
vi.mock("#/server/env.server", () => ({
	env: {
		BETTER_AUTH_SECRET: "test-secret",
		WAREHOUSE_SHIPPING_RULES:
			'{"store.example":{"flatRateUsd":800,"freeFromUsd":7500}}',
	},
}));
const { cart } = await import("#/features/cart/cart.server");

beforeEach(() => {
	vi.resetAllMocks();
	mocks.entries.mockResolvedValue({ a: "2", b: "1", c: "1" });
	mocks.rows.mockResolvedValue([
		{
			id: "a",
			name: "A",
			warehouse: "store.example",
			currency: "GEL",
			price: 2700,
			image: null,
		},
		{
			id: "b",
			name: "B",
			warehouse: "store.example",
			currency: "GEL",
			price: 5400,
			image: null,
		},
		{
			id: "c",
			name: "C",
			warehouse: "unknown.example",
			currency: "GEL",
			price: 8100,
			image: null,
		},
	]);
	mocks.rate.mockResolvedValue({ gelPerUsd: 2.7 });
});

it("attaches warehouse policies from the catalog and estimates using the current rate", async () => {
	const items = await cart.get();
	expect(items[0]).toMatchObject({
		quantity: 2,
		shipping: {
			rule: { flatRateUsd: 800, freeFromUsd: 7500 },
			estimatedUnitUsd: 1000,
		},
	});
	expect(items[0]?.shipping?.groupId).toBe(items[1]?.shipping?.groupId);
	expect(items[2]?.shipping?.rule).toBeNull();
	expect(items.every((line) => !("warehouse" in line))).toBe(true);
});
it("keeps the cart readable without a conversion rate and avoids rate requests during checkout locks", async () => {
	mocks.rate.mockResolvedValue(null);
	expect((await cart.get())[0]?.shipping?.estimatedUnitUsd).toBeNull();
	mocks.rate.mockClear();
	expect(
		(await cart.getForCheckout()).items[0]?.shipping?.rule?.flatRateUsd,
	).toBe(800);
	expect(mocks.rate).not.toHaveBeenCalled();
});
it("does not need an exchange rate for a USD cart", async () => {
	mocks.entries.mockResolvedValue({ a: "1" });
	mocks.rows.mockResolvedValue([
		{
			id: "a",
			name: "A",
			warehouse: "store.example",
			currency: "USD",
			price: 5000,
			image: null,
		},
	]);
	expect((await cart.get())[0]?.shipping?.estimatedUnitUsd).toBe(5000);
	expect(mocks.rate).not.toHaveBeenCalled();
});

it("reports missing saved SKUs as an actionable availability error", async () => {
	mocks.entries.mockResolvedValue({ stale: "1" });
	mocks.rows.mockResolvedValue([]);
	await expect(cart.getForCheckout()).rejects.toMatchObject({
		name: "PublicError",
		message:
			"Some cart items are no longer available. Please review your cart.",
	});
});

it("exposes stale entries even when no displayable items remain", async () => {
	mocks.entries.mockResolvedValue({ missing: "2", b: "NaN" });
	const snapshot = await cart.getSnapshot();
	expect(snapshot.items).toEqual([]);
	expect(snapshot.unavailableIds).toEqual(["missing", "b"]);
	expect(mocks.eval).not.toHaveBeenCalled();
});
it("removes only entries still unavailable at recovery time", async () => {
	mocks.entries.mockResolvedValue({ a: "2", missing: "1", b: "0" });
	await cart.removeUnavailable();
	expect(mocks.eval).toHaveBeenCalledWith(expect.any(String), {
		keys: ["cart:00000000-0000-4000-8000-000000000001"],
		arguments: ["missing", "1", "b", "0"],
	});
});
it("does not remove anything when the catalog lookup fails", async () => {
	mocks.rows.mockRejectedValue(new Error("redis unavailable"));
	await expect(cart.removeUnavailable()).rejects.toThrow("redis unavailable");
	expect(mocks.eval).not.toHaveBeenCalled();
});
it("retains an item that became available again before recovery", async () => {
	await cart.removeUnavailable();
	expect(mocks.eval).not.toHaveBeenCalled();
});
