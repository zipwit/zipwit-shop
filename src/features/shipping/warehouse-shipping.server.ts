import { z } from "zod";
import { publicStoreId } from "#/features/stores/store.server";
import { env } from "#/server/env.server";
import { shippingRuleSchema } from "./shipping";

const rulesSchema = z.record(
	z.string().regex(/^(?!www\.)[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/),
	shippingRuleSchema.strict(),
);

/** No fallback rate: an absent or malformed configuration cannot price shipping. */
export function parseWarehouseShippingRules(value: unknown) {
	if (typeof value !== "string") return null;
	try {
		const parsed = rulesSchema.safeParse(JSON.parse(value));
		return parsed.success && Object.keys(parsed.data).length
			? parsed.data
			: null;
	} catch {
		return null;
	}
}

const rulesByWarehouse = parseWarehouseShippingRules(
	env.WAREHOUSE_SHIPPING_RULES,
);

export function getWarehouseShipping(warehouse: string) {
	return {
		groupId: publicStoreId(warehouse),
		rule:
			rulesByWarehouse && Object.hasOwn(rulesByWarehouse, warehouse)
				? (rulesByWarehouse[warehouse] ?? null)
				: null,
	};
}
