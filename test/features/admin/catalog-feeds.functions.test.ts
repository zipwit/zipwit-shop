import { beforeEach, expect, it, vi } from "vitest";
import { catalogFeedSchema } from "#/features/admin/catalog-feed";
import exampleFeeds from "../../../deal-scout/feeds.example.json";

const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	list: vi.fn(),
	save: vi.fn(),
	remove: vi.fn(),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-start")>()),
	createServerFn: (await import("../../support/server-function"))
		.serverFunctionStub,
}));
vi.mock("@tanstack/react-start/server", () => ({
	getCookie: () => "en",
	getRequestHeaders: () => new Headers(),
	setResponseHeader: vi.fn(),
}));
vi.mock("#/features/auth/auth.server", () => ({
	auth: { api: { getSession: mocks.session } },
}));
vi.mock("#/server/env.server", () => ({
	env: { CATALOG_ADMIN_USER_IDS: ["operator"] },
}));
vi.mock("#/features/admin/catalog-feeds.server", () => ({
	listFeeds: mocks.list,
	saveFeed: mocks.save,
	deleteFeed: mocks.remove,
}));
const { adminPageFn, saveFeedFn, deleteFeedFn } = await import(
	"#/features/admin/catalog-feeds.functions"
);
const data = {
	id: crypto.randomUUID(),
	revision: 0,
	enabled: true,
	config: catalogFeedSchema.parse(exampleFeeds[0]),
};

beforeEach(() => vi.clearAllMocks());
it.each([
	["guest", null],
	["denied", { user: { id: "shopper" } }],
] as const)(
	"blocks private reads and writes for %s",
	async (access, session) => {
		mocks.session.mockResolvedValue(session);
		expect(await adminPageFn()).toEqual({ access });
		await expect(saveFeedFn({ data })).rejects.toThrow();
		await expect(deleteFeedFn({ data })).rejects.toThrow();
		for (const spy of [mocks.list, mocks.save, mocks.remove])
			expect(spy).not.toHaveBeenCalled();
	},
);
it("allows the operator resolved by the server session", async () => {
	mocks.session.mockResolvedValue({ user: { id: "operator" } });
	mocks.list.mockReturnValue([]);
	expect(await adminPageFn()).toEqual({ access: "operator", feeds: [] });
	await saveFeedFn({ data });
	expect(mocks.save).toHaveBeenCalledWith(data);
	await deleteFeedFn({ data });
	expect(mocks.remove).toHaveBeenCalledWith(data.id, data.revision);
});
