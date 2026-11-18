import Decimal from "decimal.js";
import { sumBy } from "es-toolkit";
import {
	type CartItem,
	MAX_CART_LINES,
	MAX_QUANTITY,
} from "#/features/cart/cart";
import {
	roundMinorUnits,
	unitPriceUsd,
} from "#/features/shipping/money.server";
import {
	getShipmentRule,
	groupShipments,
	shippingCharge,
} from "#/features/shipping/shipping";
import { ensure } from "#/server/public-error";
import type { CheckoutPricing, CheckoutQuote } from "./checkout";

function validatePricing(pricing: CheckoutPricing) {
	if (
		!Number.isFinite(pricing.gelPerUsd) ||
		pricing.gelPerUsd <= 0 ||
		pricing.gelPerUsd > 100
	)
		throw new Error("Invalid exchange rate");
	if (
		!Number.isSafeInteger(pricing.serviceFeeBps) ||
		pricing.serviceFeeBps < 0 ||
		pricing.serviceFeeBps > 10000
	)
		throw new Error("Invalid checkout fees");
}

function priceCheckoutLine(
	item: CartItem,
	sourceCurrency: CheckoutQuote["sourceCurrency"],
	gelPerUsd: number,
) {
	if (
		item.currency !== sourceCurrency ||
		!Number.isSafeInteger(item.price) ||
		item.price <= 0 ||
		!Number.isInteger(item.quantity) ||
		item.quantity < 1 ||
		item.quantity > MAX_QUANTITY
	)
		throw new Error("Invalid cart item");
	const usdPrice = unitPriceUsd(item.price, sourceCurrency, gelPerUsd);
	if (usdPrice === null || usdPrice < 1)
		throw new Error("Invalid converted price");
	return { ...item, usdPrice, usdTotal: usdPrice * item.quantity };
}

function quoteShipment({
	groupId,
	lines,
}: {
	groupId: string;
	lines: CheckoutQuote["lines"];
}) {
	const rule = getShipmentRule(lines);
	ensure(
		rule,
		"Shipping is not available for some items. Please review your cart or contact us.",
	);
	const subtotalUsd = sumBy(lines, (line) => line.usdTotal);
	return {
		groupId,
		itemIds: lines.map((line) => line.id),
		subtotalUsd,
		shippingUsd: shippingCharge(subtotalUsd, rule),
		rule: { ...rule },
	};
}

/**
 * Freeze prices in integer minor units: convert each unit to USD before applying
 * quantities, charge the fee on merchandise, then convert the final total to GEL.
 * Decimal half-up rounding avoids binary floating-point errors at half a cent.
 * Each warehouse qualifies for free shipping using only its own merchandise.
 */
export function calculateQuote(
	items: CartItem[],
	pricing: CheckoutPricing,
): CheckoutQuote {
	if (!items.length || items.length > MAX_CART_LINES)
		throw new Error("Your cart is empty or too large.");
	validatePricing(pricing);
	const sourceCurrency = items[0]?.currency;
	if (sourceCurrency !== "GEL" && sourceCurrency !== "USD")
		throw new Error("Unsupported cart currency");
	const lines = items.map((item) =>
		priceCheckoutLine(item, sourceCurrency, pricing.gelPerUsd),
	);
	const sourceSubtotal = sumBy(lines, (line) => line.price * line.quantity);
	const subtotalUsd = sumBy(lines, (line) => line.usdTotal);
	const shipments = groupShipments(lines).map(quoteShipment);
	const shippingUsd = sumBy(shipments, (shipment) => shipment.shippingUsd);
	const serviceFeeUsd = Math.round(
		(subtotalUsd * pricing.serviceFeeBps) / 10000,
	);
	const totalUsd = subtotalUsd + shippingUsd + serviceFeeUsd;
	const totalGel = roundMinorUnits(
		new Decimal(totalUsd).mul(pricing.gelPerUsd),
	);
	if (
		![sourceSubtotal, subtotalUsd, totalUsd, totalGel].every(
			(n) => Number.isSafeInteger(n) && n > 0 && n <= 2_000_000_000,
		)
	)
		throw new Error("Order total is too large");
	return {
		lines,
		shipments,
		sourceCurrency,
		sourceSubtotal,
		subtotalUsd,
		shippingUsd,
		serviceFeeUsd,
		totalUsd,
		totalGel,
		pricing,
	};
}

export type StoredCheckoutQuote = Omit<
	CheckoutQuote,
	"totalGel" | "pricing"
> & {
	totalGel?: number;
	paymentTotal?: number;
	pricing: Omit<CheckoutPricing, "rateDate"> & {
		rateDate?: string;
		rateUpdatedAt?: string;
		paymentCurrency?: "USD" | "GEL";
	};
};

/**
 * Read snapshots created before automatic rates without repricing an order.
 * Preserve an already quoted GEL payment amount and the original rate date.
 */
export function restoreCheckoutQuote(
	quote: StoredCheckoutQuote,
): CheckoutQuote {
	const totalGel =
		quote.totalGel ??
		(quote.pricing.paymentCurrency === "GEL"
			? quote.paymentTotal
			: roundMinorUnits(
					new Decimal(quote.totalUsd).mul(quote.pricing.gelPerUsd),
				));
	const rateDate = quote.pricing.rateDate ?? quote.pricing.rateUpdatedAt;
	if (
		!totalGel ||
		totalGel < 0 ||
		!Number.isSafeInteger(totalGel) ||
		!rateDate ||
		!Number.isFinite(Date.parse(rateDate))
	)
		throw new Error("Invalid checkout snapshot");
	return { ...quote, totalGel, pricing: { ...quote.pricing, rateDate } };
}
