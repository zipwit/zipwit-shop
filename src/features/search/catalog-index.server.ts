import { createHash } from "node:crypto";
import { catalogSummary } from "#/features/catalog/catalog-projection.server";
import {
	catalogKeys,
	catalogRecordSchema,
} from "#/features/catalog/catalog-record";
import { publicStoreId } from "#/features/stores/store.server";
import { getRedis, scanRedisKeys } from "#/server/redis.server";
import { schemaArgs } from "./catalog-fields";
import { ft } from "./redis-ft.server";

const FAMILY = "catalog_";
const KEY_PREFIX = "product:";
const PROJECTION_VERSION = "variants-v2";
export const INDEX = `${FAMILY}${createHash("sha1").update(schemaArgs().join("|")).update(PROJECTION_VERSION).update(publicStoreId("catalog-index")).digest("hex").slice(0, 8)}`;
let indexReady: Promise<void> | undefined;

/** Keeps older index versions available during rolling deployments. */
async function createIndex() {
	const existing = await ft.list();
	if (!existing.includes(INDEX)) {
		try {
			await ft.create(INDEX, KEY_PREFIX, schemaArgs());
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/index already exists/i.test(error.message)
			)
				throw error;
		}
	}
}
const ensureIndex = () =>
	(indexReady ??= createIndex().catch((error: unknown) => {
		indexReady = undefined;
		throw error;
	}));

/** Rebuilds derived Search data from Redis catalog records and preserves concurrent updates. */
export async function syncCatalogIndex() {
	await ensureIndex();
	const redis = await getRedis();
	let count = 0;
	for await (const keys of scanRedisKeys("catalog:product:*")) {
		for (const key of keys) {
			const value = await redis.json.get(key);
			if (value === null) continue;
			const record = catalogRecordSchema.parse(value);
			const summary = catalogSummary(record);
			await redis.eval(
				`
local current = redis.call('JSON.GET', KEYS[1])
if not current or cjson.decode(current).updatedAt ~= ARGV[1] then return 0 end
if ARGV[2] == '' then redis.call('DEL', KEYS[2])
else
 redis.call('JSON.SET', KEYS[2], '$', ARGV[2])
 if ARGV[3] ~= '' then redis.call('EXPIREAT', KEYS[2], ARGV[3]) else redis.call('PERSIST', KEYS[2]) end
end
return 1
`,
				{
					keys: [key, catalogKeys.search(record.id)],
					arguments: [
						record.updatedAt,
						summary ? JSON.stringify(summary) : "",
						summary?.expiresAt ? String(summary.expiresAt) : "",
					],
				},
			);
			if (summary) count++;
		}
	}
	for await (const keys of scanRedisKeys(`${KEY_PREFIX}*`)) {
		for (const key of keys) {
			if (!key.startsWith("product:{")) {
				await redis.del(key);
				continue;
			}
			const id = key.slice("product:{".length, -1);
			await redis.eval(
				`if redis.call('EXISTS', KEYS[1]) == 0 then return redis.call('DEL', KEYS[2]) end return 0`,
				{ keys: [catalogKeys.record(id), key], arguments: [] },
			);
		}
	}
	await redis.set("catalog:format", INDEX);
	return count;
}

let catalogReady: Promise<void> | undefined;
/** Initialize the Search schema and rebuild derived fields after a format change. */
export const ensureCatalogReady = () =>
	(catalogReady ??= (async () => {
		await ensureIndex();
		if ((await (await getRedis()).get("catalog:format")) !== INDEX)
			await syncCatalogIndex();
	})().catch((error: unknown) => {
		catalogReady = undefined;
		throw error;
	}));
