import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { LocaleProvider } from "#/i18n/locale";
import type { CheckoutView } from "../checkout";
import { CheckoutPayment } from "./checkout-payment";

const checkout: CheckoutView = {
	id: "test-order",
	expiresAt: "2026-11-14T12:00:00Z",
	proofUploaded: false,
	submittedAt: null,
	address: {
		fullName: "Test",
		phone: "1234567",
		line1: "123 Main",
		line2: "",
		city: "Boston",
		state: "MA",
		postalCode: "02108",
		country: "US",
	},
	quote: {
		lines: [],
		sourceCurrency: "USD",
		sourceSubtotal: 100,
		subtotalUsd: 100,
		shippingUsd: 0,
		serviceFeeUsd: 0,
		totalUsd: 100,
		totalGel: 270,
		pricing: {
			gelPerUsd: 2.7,
			rateDate: "2026-11-14T00:00:00Z",
			serviceFeeBps: 0,
			iban: "test-iban",
		},
	},
};

it("renders identical initial markup across expiry without displaying unchecked payment instructions", () => {
	const clock = vi.spyOn(Date, "now");
	const render = () =>
		renderToStaticMarkup(
			<LocaleProvider value="en">
				<CheckoutPayment checkout={checkout} onContinue={() => {}} />
			</LocaleProvider>,
		);
	try {
		clock.mockReturnValue(Date.parse(checkout.expiresAt) - 1);
		const server = render();
		clock.mockReturnValue(Date.parse(checkout.expiresAt) + 1);
		expect(render()).toBe(server);
		expect(server).toContain("Checking payment instructions…");
		expect(server).not.toContain("test-iban");
	} finally {
		clock.mockRestore();
	}
});
