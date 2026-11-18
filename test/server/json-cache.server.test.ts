import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createJsonCache } from "#/server/json-cache.server";

const redis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("#/server/redis.server", () => ({ getRedis: async () => redis }));

beforeEach(() => vi.resetAllMocks());

describe("JSON cache", () => {
	it.each([0, false, ""])(
		"serves the cached value %j without recomputing",
		async (value) => {
			redis.get.mockResolvedValue(JSON.stringify(value));
			const compute = vi.fn();
			const cache = createJsonCache({
				key: "test",
				ttlSeconds: 60,
				schema: z.union([z.number(), z.boolean(), z.string()]),
				compute,
			});

			await expect(cache.get()).resolves.toBe(value);
			expect(compute).not.toHaveBeenCalled();
			expect(redis.set).not.toHaveBeenCalled();
		},
	);

	it.each([null, '"old shape"'])(
		"recomputes missing or incompatible cached data (%s)",
		async (value) => {
			redis.get.mockResolvedValue(value);
			const compute = vi.fn().mockResolvedValue(42);
			const cache = createJsonCache({
				key: "test",
				ttlSeconds: 60,
				schema: z.number(),
				compute,
			});

			await expect(cache.get()).resolves.toBe(42);
			expect(compute).toHaveBeenCalledOnce();
			expect(redis.set).toHaveBeenCalledWith("test", "42", { EX: 60 });
		},
	);
});

function numberCache(compute: () => Promise<number>) {
	return createJsonCache({
		key: "test",
		ttlSeconds: 60,
		schema: z.number(),
		compute,
	});
}
it("coalesces concurrent misses through completion of the cache write", async () => {
	const source = Promise.withResolvers<number>();
	const write = Promise.withResolvers<void>();
	const compute = vi.fn(() => source.promise);
	redis.get.mockResolvedValue(null);
	redis.set.mockReturnValue(write.promise);
	const cache = numberCache(compute);
	const reads = [cache.get(), cache.get(), cache.get()];
	await vi.waitFor(() => expect(compute).toHaveBeenCalledOnce());
	source.resolve(42);
	await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
	reads.push(cache.get());
	write.resolve();
	expect(await Promise.all(reads)).toEqual([42, 42, 42, 42]);
	expect(compute).toHaveBeenCalledOnce();
});
it("retries a failed source without poisoning future requests", async () => {
	redis.get.mockResolvedValue(null);
	const compute = vi
		.fn()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce(7);
	const cache = numberCache(compute);
	await expect(cache.get()).rejects.toThrow("offline");
	await expect(cache.get()).resolves.toBe(7);
});
it("publishes an explicit refresh after an older request finishes", async () => {
	redis.get.mockResolvedValue(null);
	const source = Promise.withResolvers<number>();
	const compute = vi
		.fn()
		.mockReturnValueOnce(source.promise)
		.mockResolvedValueOnce(9);
	const cache = numberCache(compute);
	const older = cache.get();
	await vi.waitFor(() => expect(compute).toHaveBeenCalledOnce());
	const refresh = cache.refresh();
	const reader = cache.get();
	source.resolve(1);
	expect(await older).toBe(1);
	expect(await refresh).toBe(9);
	expect(await reader).toBe(9);
	expect(redis.set.mock.calls.map((call) => call[1])).toEqual(["1", "9"]);
});
it("keeps source data usable when writing the cache fails", async () => {
	const log = vi.spyOn(console, "warn").mockImplementation(() => {});
	redis.get.mockResolvedValue(null);
	redis.set.mockRejectedValue(new Error("offline"));
	await expect(numberCache(async () => 3).get()).resolves.toBe(3);
	log.mockRestore();
});
