import { beforeEach, describe, expect, it, vi } from "vitest";

const { ft, redis, scan } = vi.hoisted(() => ({
	ft: { list: vi.fn(), create: vi.fn() },
	redis: { get: vi.fn(), set: vi.fn() },
	scan: vi.fn(),
}));
vi.mock("#/server/env.server", () => ({
	env: { BETTER_AUTH_SECRET: "test-store-id-secret" },
}));
vi.mock("./redis-ft.server", () => ({ ft }));
vi.mock("#/db", () => {
	throw new Error("Live catalog initialization must not import PostgreSQL");
});
vi.mock("#/server/redis.server", () => ({
	getRedis: async () => redis,
	scanRedisKeys: async function* () {
		scan();
		yield [];
	},
}));

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	ft.list.mockResolvedValue([]);
});

describe("Redis catalog initialization", () => {
	it("shares initialization and rebuilds from Redis after a schema change", async () => {
		const { ensureCatalogReady } = await import("./catalog-index.server");
		await Promise.all([ensureCatalogReady(), ensureCatalogReady()]);
		expect(ft.create).toHaveBeenCalledOnce();
		expect(scan).toHaveBeenCalledTimes(2);
	});
	it("uses existing catalog data without rebuilding or accessing SQL", async () => {
		const { INDEX, ensureCatalogReady } = await import(
			"./catalog-index.server"
		);
		ft.list.mockResolvedValue([INDEX]);
		redis.get.mockResolvedValue(INDEX);
		await ensureCatalogReady();
		expect(ft.create).not.toHaveBeenCalled();
		expect(scan).not.toHaveBeenCalled();
	});
	it("retries an interrupted initialization", async () => {
		ft.list.mockRejectedValueOnce(new Error("Redis unavailable"));
		const { ensureCatalogReady } = await import("./catalog-index.server");
		await expect(ensureCatalogReady()).rejects.toThrow("Redis unavailable");
		await expect(ensureCatalogReady()).resolves.toBeUndefined();
	});
});
