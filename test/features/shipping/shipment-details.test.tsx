import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CartItem } from "#/features/cart/cart";
import { ShipmentDetails } from "#/features/shipping/shipment-details";
import { LocaleProvider } from "#/i18n/locale";

const item: CartItem = {
	id: "sku",
	name: "Cap",
	price: 2000,
	currency: "USD",
	image: null,
	quantity: 1,
	shipping: {
		groupId: "test-group",
		rule: { flatRateUsd: 600, freeFromUsd: 5000 },
		estimatedUnitUsd: 2000,
	},
};

describe("free shipping presentation", () => {
	it.each(["ka", "en"] as const)(
		"uses currency symbols and the remaining threshold for %s",
		(locale) => {
			const markup = renderToStaticMarkup(
				<LocaleProvider value={locale}>
					<ShipmentDetails number={1} items={[item]} />
				</LocaleProvider>,
			);
			expect(markup).toContain(locale === "ka" ? "30,00 $" : "$30.00");
			expect(markup).not.toContain("USD");
		},
	);
	it("hides the free-shipping threshold when a shipment contains conflicting rules", () => {
		const conflictingItem = {
			...item,
			id: "other",
			shipping: {
				groupId: "test-group",
				rule: { flatRateUsd: 900, freeFromUsd: null },
				estimatedUnitUsd: 2000,
			},
		};
		const markup = renderToStaticMarkup(
			<LocaleProvider value="en">
				<ShipmentDetails number={1} items={[item, conflictingItem]} />
			</LocaleProvider>,
		);
		expect(markup).toContain("Shipping is not available");
		expect(markup).not.toContain("Free shipping from");
	});
	it("shows free shipping once this store's own merchandise reaches its threshold", () => {
		const markup = renderToStaticMarkup(
			<LocaleProvider value="en">
				<ShipmentDetails number={1} items={[{ ...item, quantity: 3 }]} />
			</LocaleProvider>,
		);
		expect(markup).toContain("Estimated shipping: Free");
		expect(markup).not.toContain("Add $");
		expect(markup).not.toContain("USD");
	});
});
