import { beforeEach, expect, it, vi } from "vitest";
import { PublicError } from "#/server/public-error";

const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	header: vi.fn(),
	locale: "en",
	list: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	setPrimary: vi.fn(),
	remove: vi.fn(),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-start")>()),
	createServerFn: (await import("../../support/server-function"))
		.serverFunctionStub,
}));
vi.mock("@tanstack/react-start/server", () => ({
	getRequestHeaders: () => new Headers(),
	getCookie: () => mocks.locale,
	setResponseHeader: mocks.header,
}));
vi.mock("#/features/auth/auth.server", () => ({
	auth: { api: { getSession: mocks.session } },
}));
vi.mock("#/features/addresses/address.server", () => ({ addresses: mocks }));
const {
	listAddressesFn,
	createAddressFn,
	updateAddressFn,
	setPrimaryAddressFn,
	deleteAddressFn,
} = await import("#/features/addresses/address.functions");
const id = "00000000-0000-4000-8000-000000000001";
const address = {
	fullName: "Example User",
	phone: "+15551234567",
	line1: "123 Main St",
	line2: "",
	city: "Boston",
	state: "MA",
	postalCode: "02108",
	country: "US",
	isPrimary: true,
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.locale = "en";
	mocks.session.mockResolvedValue({ user: { id: "owner" } });
});

it("protects every address endpoint from anonymous callers", async () => {
	mocks.session.mockResolvedValue(null);
	const calls = [
		() => listAddressesFn(),
		() => createAddressFn({ data: address }),
		() => updateAddressFn({ data: { id, address } }),
		() => setPrimaryAddressFn({ data: { id } }),
		() => deleteAddressFn({ data: { id } }),
	];
	for (const call of calls)
		await expect(call()).rejects.toThrow("Please sign in to continue.");
	for (const name of [
		"list",
		"create",
		"update",
		"setPrimary",
		"remove",
	] as const)
		expect(mocks[name]).not.toHaveBeenCalled();
	expect(mocks.header).toHaveBeenCalledWith(
		"Cache-Control",
		"private, no-store",
	);
});

it("uses the session owner and strips client-supplied ownership", async () => {
	const data = { ...address, userId: "someone-else" };
	await createAddressFn({ data });
	expect(mocks.create).toHaveBeenCalledExactlyOnceWith("owner", address);
	expect(mocks.session).toHaveBeenCalledOnce();
});

it("localizes safe errors at the request boundary, including parameters", async () => {
	mocks.create.mockRejectedValue(
		new PublicError("You can save up to {{max}} addresses.", { max: 10 }),
	);
	await expect(createAddressFn({ data: address })).rejects.toThrow(
		"You can save up to 10 addresses.",
	);
	mocks.locale = "ka";
	const { translate } = await import("#/i18n/translate");
	await expect(createAddressFn({ data: address })).rejects.toThrow(
		translate("You can save up to {{max}} addresses.", { max: 10 }, "ka"),
	);
});
