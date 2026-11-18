import { createClient, createCluster } from "redis";
import { env } from "./env.server";

/**
 * Sets separate deadlines for queued commands and silent connections.
 * Heartbeats keep healthy idle sockets open. Cluster reads use primaries
 * for read-after-write consistency.
 */
const createRedisClient = () => {
	const defaults = {
		RESP: 2,
		name: "zipwit-shop",
		username: env.REDIS_USERNAME,
		password: env.REDIS_PASSWORD,
		socket: {
			...(env.REDIS_TLS ||
			env.REDIS_CLUSTER_NODES?.some((url) => url.startsWith("rediss:"))
				? { tls: true as const }
				: {}),
			connectTimeout: 1_000,
			socketTimeout: 10_000,
			reconnectStrategy: (retries: number) =>
				retries >= 5
					? false
					: Math.min(100 * 2 ** retries, 2_000) +
						Math.floor(Math.random() * 200),
		},
		pingInterval: 5_000,
		commandOptions: { timeout: 1_000 },
		disableOfflineQueue: true,
		commandsQueueMaxLength: 1_000,
	} as const;
	return env.REDIS_CLUSTER_NODES
		? createCluster({
				RESP: 2,
				rootNodes: env.REDIS_CLUSTER_NODES.map((url) => ({ url })),
				defaults,
				useReplicas: false,
				commandOptions: { timeout: 1_000 },
			})
		: createClient({
				...defaults,
				socket: {
					...defaults.socket,
					host: env.REDIS_HOST,
					port: env.REDIS_PORT,
				},
			});
};

let client: Promise<ReturnType<typeof createRedisClient>> | undefined;

/** Opens a shared lazy connection and clears it after a failed connection or terminal disconnect. */
export const getRedis = () => {
	if (client) return client;

	const pending: Promise<ReturnType<typeof createRedisClient>> = (async () => {
		const connection = createRedisClient();
		connection.on("error", (error) =>
			console.warn("Redis client error:", error),
		);
		const reset = () => {
			if (client === pending) client = undefined;
		};
		connection.on("end", reset);
		connection.on("terminated", reset);
		try {
			await connection.connect();
			return connection;
		} catch (error) {
			if (connection.isOpen) connection.destroy();
			throw error;
		}
	})().catch((error: unknown) => {
		if (client === pending) client = undefined;
		throw error;
	});
	client = pending;
	return pending;
};

/** Raw commands have different signatures on standalone and Cluster clients. */
export async function redisCommand(args: string[]) {
	const redis = await getRedis();
	return "masters" in redis
		? redis.sendCommand(undefined, false, args)
		: redis.sendCommand(args);
}

/** SCAN is node-local. Visit every primary; use the router for subsequent key operations. */
export async function* scanRedisKeys(pattern: string) {
	const redis = await getRedis();
	const nodes =
		"masters" in redis
			? await Promise.all(redis.masters.map((node) => redis.nodeClient(node)))
			: [redis];
	for (const node of nodes) {
		let cursor = "0";
		do {
			const page = await node.scan(cursor, { MATCH: pattern, COUNT: 500 });
			cursor = String(page.cursor);
			if (page.keys.length) yield page.keys;
		} while (cursor !== "0");
	}
}

/** DEL with unrelated keys is CROSSSLOT in Cluster. Bound concurrent single-key commands. */
export async function deleteRedisKeys(keys: string[]) {
	const redis = await getRedis();
	for (let offset = 0; offset < keys.length; offset += 100) {
		await Promise.all(
			keys.slice(offset, offset + 100).map((key) => redis.del(key)),
		);
	}
}
