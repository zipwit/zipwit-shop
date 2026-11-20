import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createCluster, settings } = vi.hoisted(() => ({
	createClient: vi.fn(),
	createCluster: vi.fn(),
	settings: {
		REDIS_HOST: "localhost",
		REDIS_PORT: 6379,
		REDIS_CLUSTER_NODES: undefined as string[] | undefined,
		REDIS_USERNAME: undefined as string | undefined,
		REDIS_PASSWORD: undefined as string | undefined,
	},
}));
vi.mock("redis", () => ({ createClient, createCluster }));
vi.mock("#/server/env.server", () => ({
	env: settings,
}));

function connection() {
	return Object.assign(new EventEmitter(), {
		connect: vi.fn().mockResolvedValue(undefined),
		isOpen: false,
		destroy: vi.fn(),
		close: vi.fn(),
	});
}

beforeEach(() => {
	vi.resetModules();
	createClient.mockReset();
	createCluster.mockReset();
	settings.REDIS_CLUSTER_NODES = undefined;
	settings.REDIS_USERNAME = undefined;
	settings.REDIS_PASSWORD = undefined;
});

afterEach(async () => {
	await (await import("#/server/redis.server")).closeRedis();
	vi.restoreAllMocks();
});

describe("getRedis", () => {
	it("uses Cluster seed nodes and primary reads, with credentials inherited by every node", async () => {
		settings.REDIS_CLUSTER_NODES = [
			"redis://one:6379",
			"redis://two:6379",
			"redis://three:6379",
		];
		settings.REDIS_USERNAME = "shop";
		settings.REDIS_PASSWORD = "fixture-only";
		const cluster = connection();
		createCluster.mockReturnValue(cluster);
		const { getRedis } = await import("#/server/redis.server");
		await expect(getRedis()).resolves.toBe(cluster);
		expect(createClient).not.toHaveBeenCalled();
		expect(createCluster).toHaveBeenCalledWith(
			expect.objectContaining({
				rootNodes: settings.REDIS_CLUSTER_NODES.map((url) => ({ url })),
				useReplicas: false,
				defaults: expect.objectContaining({
					username: "shop",
					password: "fixture-only",
					disableOfflineQueue: true,
				}),
			}),
		);
	});

	it("scans all primaries and deletes keys individually across slots", async () => {
		settings.REDIS_CLUSTER_NODES = ["redis://one:6379"];
		const nodes = [
			{
				scan: vi
					.fn()
					.mockResolvedValueOnce({ cursor: "5", keys: ["a"] })
					.mockResolvedValueOnce({ cursor: "0", keys: ["b"] }),
			},
			{ scan: vi.fn().mockResolvedValue({ cursor: "0", keys: ["c"] }) },
			{ scan: vi.fn().mockResolvedValue({ cursor: "0", keys: [] }) },
		];
		const cluster = Object.assign(connection(), {
			masters: nodes,
			nodeClient: vi.fn(async (node) => node),
			del: vi.fn(),
		});
		createCluster.mockReturnValue(cluster);
		const { scanRedisKeys, deleteRedisKeys } = await import(
			"#/server/redis.server"
		);
		const keys: string[] = [];
		for await (const page of scanRedisKeys("product:*")) keys.push(...page);
		expect(keys).toEqual(["a", "b", "c"]);
		expect(cluster.nodeClient).toHaveBeenCalledTimes(3);
		await deleteRedisKeys(keys);
		expect(cluster.del.mock.calls).toEqual([["a"], ["b"], ["c"]]);
	});
	it("shares a single connection between concurrent callers", async () => {
		const redis = connection();
		createClient.mockReturnValue(redis);
		const { getRedis } = await import("#/server/redis.server");
		expect(createClient).not.toHaveBeenCalled();
		const clients = await Promise.all([getRedis(), getRedis()]);
		expect(clients).toEqual([redis, redis]);
		expect(redis.connect).toHaveBeenCalledTimes(1);
	});

	it("closes the SSR connection from a separate lifecycle module instance", async () => {
		const redis = connection();
		redis.isOpen = true;
		createClient.mockReturnValue(redis);
		await (await import("#/server/redis.server")).getRedis();
		vi.resetModules();
		const { closeRedis } = await import("#/server/redis.server");
		await closeRedis();
		await closeRedis();
		expect(redis.close).toHaveBeenCalledTimes(1);
		expect(createClient).toHaveBeenCalledTimes(1);
	});

	it("allows another attempt after initialization fails", async () => {
		const failed = connection();
		failed.connect.mockRejectedValue(new Error("unavailable"));
		const recovered = connection();
		createClient.mockReturnValueOnce(failed).mockReturnValueOnce(recovered);
		const { getRedis } = await import("#/server/redis.server");
		await expect(getRedis()).rejects.toThrow("unavailable");
		await expect(getRedis()).resolves.toBe(recovered);
	});

	it.each(["end", "terminated"])(
		"replaces a connection after %s",
		async (event) => {
			const closed = connection();
			const recovered = connection();
			createClient.mockReturnValueOnce(closed).mockReturnValueOnce(recovered);
			const { getRedis } = await import("#/server/redis.server");
			await getRedis();
			closed.emit(event);
			await expect(getRedis()).resolves.toBe(recovered);
		},
	);

	it("does not let a late event from an old client discard its replacement", async () => {
		const closed = connection();
		const recovered = connection();
		createClient.mockReturnValueOnce(closed).mockReturnValueOnce(recovered);
		const { getRedis } = await import("#/server/redis.server");
		await getRedis();
		closed.emit("terminated");
		await expect(getRedis()).resolves.toBe(recovered);
		closed.emit("end");
		await expect(getRedis()).resolves.toBe(recovered);
		expect(createClient).toHaveBeenCalledTimes(2);
	});

	it("keeps a replacement when an older initialization subsequently rejects", async () => {
		const failed = connection();
		const connecting = Promise.withResolvers<void>();
		failed.connect.mockReturnValue(connecting.promise);
		const recovered = connection();
		createClient.mockReturnValueOnce(failed).mockReturnValueOnce(recovered);
		const { getRedis } = await import("#/server/redis.server");
		const pending = getRedis();
		failed.emit("terminated");
		await expect(getRedis()).resolves.toBe(recovered);
		connecting.reject(new Error("unavailable"));
		await expect(pending).rejects.toThrow("unavailable");
		await expect(getRedis()).resolves.toBe(recovered);
		expect(createClient).toHaveBeenCalledTimes(2);
	});

	it("destroys a partially open connection when initialization fails", async () => {
		const failed = connection();
		failed.isOpen = true;
		failed.connect.mockRejectedValue(new Error("handshake failed"));
		createClient.mockReturnValue(failed);
		const { getRedis } = await import("#/server/redis.server");
		await expect(getRedis()).rejects.toThrow("handshake failed");
		expect(failed.destroy).toHaveBeenCalledTimes(1);
	});

	it("uses bounded jittered retries and heartbeats below the socket idle timeout", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		createClient.mockReturnValue(connection());
		const { getRedis } = await import("#/server/redis.server");
		await getRedis();
		const options = createClient.mock.calls[0]?.[0];
		expect(options.socket.reconnectStrategy(0)).toBe(200);
		expect(options.socket.reconnectStrategy(4)).toBe(1700);
		expect(options.socket.reconnectStrategy(5)).toBe(false);
		expect(options.pingInterval).toBeLessThan(options.socket.socketTimeout);
		expect(options.disableOfflineQueue).toBe(true);
	});
});
