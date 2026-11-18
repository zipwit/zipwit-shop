import { escape as escapeHtml } from "es-toolkit";
import type { CheckoutAddress } from "./checkout";
import {
	restoreCheckoutQuote,
	type StoredCheckoutQuote,
} from "./checkout-quote.server";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)} USD`;
export type OrderNotice = {
	id: string;
	name: string;
	email: string;
	createdAt: Date;
	quote: StoredCheckoutQuote;
	address: CheckoutAddress;
};

/** Keep chunks below Telegram's 4096-character limit without splitting HTML entities. */
export function orderMessages(order: OrderNotice) {
	const { address } = order;
	const quote = restoreCheckoutQuote(order.quote);
	const blocks = [
		`<b>🛍 New Zipwit Shop order</b>\n<code>${escapeHtml(order.id)}</code>\n<b>Payment awaiting verification</b>`,
		`<b>Customer</b>\n${escapeHtml(order.name)}\n${escapeHtml(order.email)}\n${escapeHtml(order.createdAt.toISOString())}`,
		`<b>U.S. delivery</b>\n${[address.fullName, address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`, "United States", address.phone].filter(Boolean).map(escapeHtml).join("\n")}`,
		"<b>Items</b>",
		...quote.lines.map(
			(line, i) =>
				`${i + 1}. ${escapeHtml(line.name.slice(0, 400))}\n${line.quantity} × ${usd(line.usdPrice)} = <b>${usd(line.usdTotal)}</b>\nSKU: <code>${escapeHtml(line.id)}</code>`,
		),
		...(quote.shipments ?? []).map(
			(shipment, index) =>
				`<b>Shipment ${index + 1}</b>\nItems: ${usd(shipment.subtotalUsd)}\nShipping: ${shipment.shippingUsd ? usd(shipment.shippingUsd) : "FREE"}\nFlat rate: ${usd(shipment.rule.flatRateUsd)}; free from: ${shipment.rule.freeFromUsd === null ? "not offered" : usd(shipment.rule.freeFromUsd)}\nItem numbers: ${shipment.itemIds.map((id) => quote.lines.findIndex((line) => line.id === id) + 1).join(", ")}`,
		),
		`<b>Price breakdown</b>\nItems: ${usd(quote.subtotalUsd)}\nService fee (${quote.pricing.serviceFeeBps / 100}%): ${usd(quote.serviceFeeUsd)}\nU.S. shipping: ${quote.shippingUsd ? usd(quote.shippingUsd) : "FREE"}\n<b>Total: ${usd(quote.totalUsd)}</b>\nCustomer may pay either ${usd(quote.totalUsd)} or ${(quote.totalGel / 100).toFixed(2)} GEL\nExchange rate at quote: 1 USD = ${quote.pricing.gelPerUsd} GEL\nRate date: ${escapeHtml(quote.pricing.rateDate)}\n\nVerify the bank deposit (either amount) before marking this order paid.`,
	];
	const chunks: string[] = [];
	let chunk = "";
	for (const block of blocks) {
		if (chunk.length + block.length + 2 > 3500) {
			chunks.push(chunk);
			chunk = "";
		}
		chunk += `${chunk ? "\n\n" : ""}${block}`;
	}
	if (chunk) chunks.push(chunk);
	return chunks;
}
