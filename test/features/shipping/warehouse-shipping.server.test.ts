import { expect, it, vi } from "vitest";
import { warehouseShippingRule } from "#/db/schema";
import { getWarehouseShippingRules } from "#/features/shipping/warehouse-shipping.server";

vi.mock("#/db", async () => ({
	db: await (await import("../../support/postgres")).testDatabase(),
}));
const { db } = await import("#/db");
it("uses confirmed PostgreSQL rules and omits unconfigured warehouses", async () => {
	await db
		.insert(warehouseShippingRule)
		.values({ warehouse: "free.example", flatRateUsd: 0, freeFromUsd: null });
	expect(
		await getWarehouseShippingRules(["free.example", "missing.example"]),
	).toEqual(new Map([["free.example", { flatRateUsd: 0, freeFromUsd: null }]]));
	await expect(
		db
			.insert(warehouseShippingRule)
			.values({ warehouse: "invalid.example", flatRateUsd: -1 }),
	).rejects.toThrow();
});
