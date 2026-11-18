import { beforeEach, expect, it, vi } from "vitest";
import { PublicError } from "#/server/public-error";

const mocks = vi.hoisted(() => ({
	getSnapshot: vi.fn(),
	add: vi.fn(),
	setQuantity: vi.fn(),
	removeUnavailable: vi.fn(),
	header: vi.fn(),
}));
vi.mock("@tanstack/react-start", async (original) => ({
	...(await original<typeof import("@tanstack/react-start")>()),
	createServerFn: (await import("../../support/server-function"))
		.serverFunctionStub,
}));
vi.mock("@tanstack/react-start/server", () => ({
	getCookie: () => "en",
	setResponseHeader: mocks.header,
}));
vi.mock("#/features/cart/cart.server", () => ({ cart: mocks }));
const { getCartFn, addItemFn, setQuantityFn, removeUnavailableItemsFn } =
	await import("#/features/cart/cart.functions");
const sku = "00000000-0000-4000-8000-000000000001";
beforeEach(() => vi.resetAllMocks());

it("makes every visitor cart response private without requiring sign-in", async () => {
	for (const invoke of [
		() => getCartFn(),
		() => addItemFn({ data: { sku } }),
		() => setQuantityFn({ data: { sku, quantity: 0 } }),
		() => removeUnavailableItemsFn(),
	]) {
		mocks.header.mockClear();
		await invoke();
		expect(mocks.header).toHaveBeenCalledWith(
			"Cache-Control",
			"private, no-store",
		);
	}
});
it("preserves actionable cart errors and hides infrastructure details", async () => {
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	mocks.add.mockRejectedValueOnce(new PublicError("Maximum quantity reached."));
	await expect(addItemFn({ data: { sku } })).rejects.toThrow(
		"Maximum quantity reached.",
	);
	mocks.add.mockRejectedValueOnce(new Error("redis://secret@internal-host"));
	await expect(addItemFn({ data: { sku } })).rejects.toThrow(
		"Something went wrong. Please try again.",
	);
	expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
	log.mockRestore();
});
it("rejects invalid quantities before storage", async () => {
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	await expect(
		setQuantityFn({ data: { sku, quantity: -1 } }),
	).rejects.toThrow();
	expect(mocks.setQuantity).not.toHaveBeenCalled();
	log.mockRestore();
});
