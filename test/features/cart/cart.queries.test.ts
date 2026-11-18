import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { CartSnapshot } from "#/features/cart/cart";
import { getCartFn } from "#/features/cart/cart.functions";
import { cartQuery } from "#/features/cart/cart.queries";

vi.mock("#/features/cart/cart.functions", () => ({ getCartFn: vi.fn() }));

it("aborts the transport and preserves the cart when a pending read is cancelled", async () => {
	const client = new QueryClient();
	const response = Promise.withResolvers<CartSnapshot>();
	vi.mocked(getCartFn).mockReturnValue(response.promise);
	const empty = { items: [], unavailableIds: [] };
	client.setQueryData(cartQuery.queryKey, empty);
	const request = client.query(cartQuery).catch((error: unknown) => error);
	const signal = vi.mocked(getCartFn).mock.calls[0]?.[0]?.signal;
	expect(signal).toBeInstanceOf(AbortSignal);

	await client.cancelQueries({ queryKey: cartQuery.queryKey });
	expect(signal?.aborted).toBe(true);
	expect(await request).toEqual(empty);
	response.resolve({
		unavailableIds: ["missing"],
		items: [
			{
				id: "stale",
				name: "Stale response",
				quantity: 1,
				price: 100,
				currency: "GEL",
				image: null,
			},
		],
	});
	await response.promise;
	expect(client.getQueryData(cartQuery.queryKey)).toEqual(empty);
	client.clear();
});
