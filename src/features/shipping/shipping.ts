import { z } from "zod";
import type { CartItem } from "#/features/cart/cart";

/** USD cents, charged once per warehouse. Null means no free-shipping threshold. */
export const shippingRuleSchema = z.object({
	flatRateUsd: z.number().int().min(0).max(100_000),
	freeFromUsd: z.number().int().min(0).max(2_000_000_000).nullable(),
});
export type ShippingRule = z.infer<typeof shippingRuleSchema>;

/** Public shipping details for one line in the cart. */
export type ItemShipping = {
	groupId: string;
	rule: ShippingRule | null;
	/** Unit price in USD cents at the cart's preview rate, when available. */
	estimatedUnitUsd: number | null;
};

/** Shipping charge and rule saved when a checkout quote is created. */
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

/** Calculates one warehouse's charge in USD cents from its merchandise subtotal. */
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

/** Returns a preview in USD cents when every line has a usable price and shares one rule. */
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
