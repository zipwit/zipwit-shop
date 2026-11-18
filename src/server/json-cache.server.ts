import type { z } from "zod";
import { getRedis } from "./redis.server";

type JsonCacheOptions<S extends z.ZodType> = {
	key: string;
	ttlSeconds: number;
	schema: S;
	compute: () => Promise<z.output<S>>;
};

/**
 * Misses and cache failures fall through to `compute`. Source errors propagate.
 * Concurrent reads in a process share a request through the cache write. `get`
 * tolerates write failures. `refresh` requires storage and waits for older writes.
 */
export function createJsonCache<S extends z.ZodType>({
	key,
	ttlSeconds,
	schema,
	compute,
}: JsonCacheOptions<S>) {
	type Value = z.output<S>;

	async function read(): Promise<Value | null> {
		try {
			const hit = await (await getRedis()).get(key);
			if (!hit) return null;

			const { success, data } = schema.safeParse(JSON.parse(String(hit)));
			return success ? data : null;
		} catch (error) {
			console.warn(`Cache read failed (${key}):`, error);
			return null;
		}
	}

	async function write(value: Value) {
		await (await getRedis()).set(key, JSON.stringify(value), {
			EX: ttlSeconds,
		});
	}

	let pendingRead: Promise<Value> | undefined;
	let pendingRefresh: Promise<Value> | undefined;

	return {
		get(): Promise<Value> {
			if (pendingRefresh) return pendingRefresh;
			if (pendingRead) return pendingRead;
			pendingRead = (async () => {
				const cached = await read();
				if (cached !== null) return cached;
				const value = await compute();
				await write(value).catch(() =>
					console.warn(`Cache write failed (${key})`),
				);
				return value;
			})().finally(() => {
				pendingRead = undefined;
			});
			return pendingRead;
		},
		refresh(): Promise<Value> {
			if (pendingRefresh) return pendingRefresh;
			const previous = pendingRead;
			pendingRefresh = (async () => {
				await previous?.catch(() => undefined);
				const value = await compute();
				await write(value);
				return value;
			})().finally(() => {
				pendingRefresh = undefined;
			});
			return pendingRefresh;
		},
	};
}
