import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	getCheckout: vi.fn(),
	prepare: vi.fn(),
	upload: vi.fn(),
	submit: vi.fn(),
	list: vi.fn(),
	header: vi.fn(),
	pricing: vi.fn(),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-start")>()),
	createServerFn: (await import("../../support/server-function"))
		.serverFunctionStub,
}));
vi.mock("@tanstack/react-start/server", () => ({
	getCookie: () => "en",
	getRequestHeaders: () => new Headers(),
	setResponseHeader: mocks.header,
}));
vi.mock("#/features/auth/auth.server", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("#/features/addresses/address.server", () => ({
	addresses: { list: mocks.list },
}));
vi.mock("#/features/checkout/checkout-config.server", () => ({
	checkoutPricing: mocks.pricing,
}));
vi.mock("#/features/checkout/checkout.server", () => ({
	getCheckout: mocks.getCheckout,
	prepareCheckout: mocks.prepare,
	uploadProof: mocks.upload,
	submitCheckout: mocks.submit,
}));
const {
	checkoutPageFn,
	getCheckoutFn,
	prepareCheckoutFn,
	uploadProofFn,
	submitCheckoutFn,
} = await import("#/features/checkout/checkout.functions");
const id = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
	vi.resetAllMocks();
	mocks.getSession.mockResolvedValue({ user: { id: "signed-in-user" } });
	mocks.list.mockResolvedValue([]);
	mocks.pricing.mockResolvedValue({});
});

it("rejects anonymous prepare, upload and submit requests at the server boundary", async () => {
	mocks.getSession.mockResolvedValue(null);
	const file = new FormData();
	file.set("id", id);
	file.set("file", new File(["test"], "proof.png", { type: "image/png" }));
	for (const request of [
		() => prepareCheckoutFn({ data: { id, addressId: id } }),
		() => uploadProofFn({ data: file }),
		() => submitCheckoutFn({ data: { id } }),
	])
		await expect(request()).rejects.toThrow("Please sign in to continue.");
	expect(mocks.prepare).not.toHaveBeenCalled();
	expect(mocks.upload).not.toHaveBeenCalled();
	expect(mocks.submit).not.toHaveBeenCalled();
});
it("uses server identity and strips forged totals, fees and user IDs", async () => {
	const data = {
		id,
		addressId: id,
		userId: "victim",
		totalUsd: 1,
		shippingUsd: 0,
		serviceFeeBps: 0,
	};
	await prepareCheckoutFn({ data });
	expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(
		"signed-in-user",
		id,
		id,
	);
});
it("returns a private resumable checkout response with no receipt bytes", async () => {
	const checkout = {
		id,
		proofUploaded: true,
		submittedAt: null,
		expiresAt: "2026-10-27T00:00:00Z",
	};
	mocks.getCheckout.mockResolvedValue(checkout);
	const response = await checkoutPageFn({ data: { id } });
	expect(response).toEqual({
		userId: "signed-in-user",
		ready: true,
		addresses: [],
		checkout,
	});
	expect(mocks.getCheckout).toHaveBeenCalledExactlyOnceWith(
		"signed-in-user",
		id,
	);
	expect(mocks.pricing).not.toHaveBeenCalled();
	expect(mocks.list).not.toHaveBeenCalled();
	expect(mocks.header).toHaveBeenCalledWith(
		"Cache-Control",
		"private, no-store",
	);
});

it("rejects a resumed checkout query under another user's cache key", async () => {
	await expect(
		getCheckoutFn({ data: { id, userId: "other-user" } }),
	).rejects.toThrow("Please sign in to continue.");
	expect(mocks.getCheckout).not.toHaveBeenCalled();
});

it("reports unavailable pricing only for new checkout sessions", async () => {
	mocks.pricing.mockResolvedValue(null);
	expect(await checkoutPageFn({ data: {} })).toMatchObject({
		ready: false,
		checkout: null,
	});
	expect(mocks.pricing).toHaveBeenCalledOnce();
});
it("does not load an anonymous visitor's requested checkout", async () => {
	mocks.getSession.mockResolvedValue(null);
	expect(await checkoutPageFn({ data: { id } })).toMatchObject({
		userId: null,
		checkout: null,
	});
	expect(mocks.getCheckout).not.toHaveBeenCalled();
});
it("rejects malformed input before touching order storage", async () => {
	await expect(submitCheckoutFn({ data: { id: "invalid" } })).rejects.toThrow();
	expect(mocks.submit).not.toHaveBeenCalled();
});

it("resolves the session only once when loading a signed-in checkout", async () => {
	await checkoutPageFn({ data: {} });
	expect(mocks.getSession).toHaveBeenCalledOnce();
});
it("hides infrastructure errors but keeps safe checkout errors", async () => {
	const { PublicError } = await import("#/server/public-error");
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		mocks.submit.mockRejectedValueOnce(new Error("database password and SQL"));
		await expect(submitCheckoutFn({ data: { id } })).rejects.toThrow(
			"Something went wrong. Please try again.",
		);
		mocks.submit.mockRejectedValueOnce(new PublicError("Checkout not found."));
		await expect(submitCheckoutFn({ data: { id } })).rejects.toThrow(
			"Checkout not found.",
		);
		expect(log).toHaveBeenCalledExactlyOnceWith("Private request failed", {
			reference: expect.any(String),
			name: "Error",
			code: "UNKNOWN",
		});
		expect(mocks.header).toHaveBeenCalledWith(
			"X-Request-Id",
			expect.any(String),
		);
	} finally {
		log.mockRestore();
	}
});
