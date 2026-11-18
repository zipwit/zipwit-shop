import { expect, it, vi } from "vitest";

vi.mock("#/server/env.server", () => ({
	env: {
		BETTER_AUTH_SECRET: "test-only-secret",
		WAREHOUSE_SHIPPING_RULES:
			'{"store.example":{"flatRateUsd":800,"freeFromUsd":7500}}',
	},
}));
const { parseWarehouseShippingRules, getWarehouseShipping } = await import(
	"#/features/shipping/warehouse-shipping.server"
);

it("requires explicit integer USD cents and an explicit threshold or null", () => {
	for (const value of [
		undefined,
		"",
		"invalid",
		"{}",
		'{"store.example":{"flatRateUsd":800}}',
		'{"store.example":{"flatRateUsd":-1,"freeFromUsd":null}}',
		'{"store.example":{"flatRateUsd":1.5,"freeFromUsd":null}}',
		'{"https://store.example":{"flatRateUsd":800,"freeFromUsd":null}}',
	])
		expect(parseWarehouseShippingRules(value)).toBeNull();
	expect(
		parseWarehouseShippingRules(
			'{"store.example":{"flatRateUsd":0,"freeFromUsd":null}}',
		),
	).toEqual({ "store.example": { flatRateUsd: 0, freeFromUsd: null } });
});
it("matches exact catalog domains and returns stable opaque groups with no default rate", () => {
	expect(getWarehouseShipping("store.example").rule).toEqual({
		flatRateUsd: 800,
		freeFromUsd: 7500,
	});
	expect(getWarehouseShipping("other.example").rule).toBeNull();
	expect(getWarehouseShipping("store.example").groupId).toBe(
		getWarehouseShipping("store.example").groupId,
	);
	expect(getWarehouseShipping("store.example").groupId).not.toContain(
		"store.example",
	);
	expect(getWarehouseShipping("other.example").groupId).not.toBe(
		getWarehouseShipping("store.example").groupId,
	);
});
