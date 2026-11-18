import { z } from "zod";
import type { CartItem } from "#/features/cart/cart";

/** USD cents, charged once per warehouse. Null means no free-shipping threshold. */
export const shippingRuleSchema = z.object({
	flatRateUsd: z.number().int().min(0).max(100_000),
	freeFromUsd: z.number().int().min(0).max(2_000_000_000).nullable(),
});
export type ShippingRule = z.infer<typeof shippingRuleSchema>;
export type ItemShipping = {
	groupId: string;
	rule: ShippingRule | null;
	/** Cart estimate only; checkout converts again using its frozen rate. */
	estimatedUnitUsd: number | null;
};
export type ShipmentQuote = {
	groupId: string;
	itemIds: string[];
	subtotalUsd: number;
	shippingUsd: number;
	rule: ShippingRule;
};

/** All lines in a warehouse shipment must agree on the rate and threshold. */
export function getShipmentRule(items: CartItem[]) {
	const shipping = items[0]?.shipping;
	if (
		!shipping?.groupId ||
		!shipping.rule ||
		!shippingRuleSchema.safeParse(shipping.rule).success
	)
		return null;
	const { groupId, rule } = shipping;
	const consistent = items.every(
		(item) =>
			item.shipping?.groupId === groupId &&
			item.shipping.rule?.flatRateUsd === rule.flatRateUsd &&
			item.shipping.rule.freeFromUsd === rule.freeFromUsd,
	);
	return consistent ? rule : null;
}

export function shippingCharge(subtotalUsd: number, rule: ShippingRule) {
	return rule.freeFromUsd !== null && subtotalUsd >= rule.freeFromUsd
		? 0
		: rule.flatRateUsd;
}

/** Stable numbering in the drawer, checkout and saved quote; no supplier names. */
export function groupShipments<T extends CartItem>(items: T[]) {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const id = item.shipping?.groupId ?? `unknown-${item.id}`;
		const group = groups.get(id) ?? [];
		group.push(item);
		groups.set(id, group);
	}
	return [...groups]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([groupId, lines]) => ({ groupId, lines }));
}

export function estimateShipment(items: CartItem[]) {
	const rule = getShipmentRule(items);
	if (!rule) return null;
	let subtotalUsd = 0;
	for (const item of items) {
		const unit = item.shipping?.estimatedUnitUsd;
		if (unit == null || !Number.isSafeInteger(unit) || unit <= 0) return null;
		subtotalUsd += unit * item.quantity;
	}
	return { subtotalUsd, shippingUsd: shippingCharge(subtotalUsd, rule), rule };
}
