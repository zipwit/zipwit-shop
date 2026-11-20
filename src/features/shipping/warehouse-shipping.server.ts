import { inArray } from "drizzle-orm";
import { db } from "#/db";
import { warehouseShippingRule } from "#/db/schema";
import type { ShippingRule } from "./shipping";

export async function getWarehouseShippingRules(warehouses: readonly string[]) {
	const rules = new Map<string, ShippingRule>();
	if (!warehouses.length) return rules;
	try {
		const rows = await db
			.select()
			.from(warehouseShippingRule)
			.where(
				inArray(warehouseShippingRule.warehouse, [...new Set(warehouses)]),
			);
		for (const { warehouse, flatRateUsd, freeFromUsd } of rows)
			rules.set(warehouse, { flatRateUsd, freeFromUsd });
	} catch (error) {
		console.warn("Warehouse shipping rules unavailable:", error);
	}
	return rules;
}
