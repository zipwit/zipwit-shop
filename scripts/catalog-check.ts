/** Real catalog storage check. Only runs against the disposable loopback cluster. */
import assert from "node:assert/strict";
import { createCartStore } from "#/features/cart/cart-store.server";
import {
	findCatalogSkus,
	getCatalogProduct,
} from "#/features/catalog/catalog-read.server";
import {
	type CatalogRecord,
	catalogKeys,
} from "#/features/catalog/catalog-record";
import {
	deleteCatalogProduct,
	putCatalogProduct,
} from "#/features/catalog/catalog-store.server";
import { findProductBySlug } from "#/features/catalog/product.server";
import { DEFAULT_FILTERS } from "#/features/search/catalog-filters";
import { syncCatalogIndex } from "#/features/search/catalog-index.server";
import { searchCatalog } from "#/features/search/catalog-search.server";
import { getStats } from "#/features/stats/stats.server";
import {
	deleteRedisKeys,
	getRedis,
	scanRedisKeys,
} from "#/server/redis.server";

const seeds = (process.env.REDIS_CLUSTER_NODES ?? "").split(",");
assert.ok(
	seeds.length === 3 &&
		seeds.every((seed) => {
			const url = new URL(seed);
			return (
				url.hostname === "127.0.0.1" &&
				["17379", "17380", "17381"].includes(url.port)
			);
		}),
	"Use the disposable loopback cluster on ports 17379–17381.",
);
const redis = await getRedis();
assert.ok("masters" in redis, "This check requires Redis Cluster.");
assert.equal(redis.masters.length, 3, "Expected three primaries.");
const run = crypto.randomUUID();
const now = new Date().toISOString();
const rows: CatalogRecord[] = ["a", "b", "c"].map((name, index) => ({
	id: crypto.randomUUID(),
	slug: `cluster-check-${run}-${name}`,
	name: `Cluster product ${name}`,
	brand: run,
	description: null,
	department: "men",
	category: "shoes",
	currency: "USD",
	browseOnly: false,
	warehouse: `cluster-${index % 2}.example`,
	lastSeenAt: now,
	updatedAt: now,
	skus: [
		{
			id: crypto.randomUUID(),
			color: "Black",
			size: "9",
			price: 1000 + index * 500,
			originalPrice: 3000,
			discount: Math.round(((3000 - (1000 + index * 500)) * 100) / 3000),
			inStock: true,
			sourceExpiresAt: null,
			imageUrl: null,
		},
	],
}));
try {
	for (const row of rows) assert.equal(await putCatalogProduct(row), true);
	const filters = { ...DEFAULT_FILTERS, brands: [run] };
	assert.equal(
		(await searchCatalog({ mode: "listing" }, filters, 1, 20)).total,
		3,
	);
	const first = rows[0];
	const variant = first?.skus[0];
	assert.ok(first && variant);
	assert.equal((await getCatalogProduct(first.slug))?.skus[0]?.id, variant.id);
	const detail = await findProductBySlug(first.slug);
	assert.equal(detail?.purchasable, true);
	assert.ok(!JSON.stringify(detail).includes("cluster-0.example"));
	const ids = rows.flatMap((row) => row.skus.map((sku) => sku.id));
	assert.equal((await findCatalogSkus(ids)).length, 3);
	const stats = await getStats();
	assert.ok(stats.deals >= 3 && stats.warehouses >= 2);
	console.log(
		"✓ Direct Redis catalog writes, details, multi-SKU lookups, listings and live stats (no PostgreSQL)",
	);
	const cartKey = `catalog-check:cart:${run}`;
	const cart = createCartStore(redis, findCatalogSkus);
	try {
		await Promise.all(ids.map((id) => cart.add(cartKey, id)));
		assert.equal(await redis.hLen(cartKey), 3);
		await cart.removePurchased(cartKey, [{ id: variant.id, quantity: 1 }]);
		assert.equal(await redis.hLen(cartKey), 2);
	} finally {
		await redis.del(cartKey);
	}
	console.log("✓ Atomic cart scripts across product shards");
	const revision = (offset: number) =>
		new Date(Date.parse(now) + offset).toISOString();
	const updated = {
		...first,
		updatedAt: revision(1),
		skus: [{ ...variant, price: 500, discount: 83 }],
	};
	assert.equal(await putCatalogProduct(updated), true);
	assert.equal(
		await putCatalogProduct(first),
		false,
		"Older writes must not overwrite new prices",
	);
	assert.equal((await getCatalogProduct(first.slug))?.skus[0]?.price, 500);
	assert.equal((await findCatalogSkus([variant.id]))[0]?.price, 500);
	assert.equal(
		await putCatalogProduct({
			...updated,
			updatedAt: revision(2),
			skus: [
				{
					...variant,
					price: 500,
					discount: 83,
					sourceExpiresAt: new Date(Date.now() - 1000).toISOString(),
				},
			],
		}),
		true,
	);
	assert.equal((await findCatalogSkus([variant.id])).length, 0);
	assert.equal(
		(await searchCatalog({ mode: "listing" }, filters, 1, 20)).total,
		2,
	);
	console.log(
		"✓ Incremental price writes, stale-event rejection and expired stock",
	);
	await syncCatalogIndex();
	assert.equal(
		(await searchCatalog({ mode: "listing" }, filters, 1, 20)).total,
		2,
	);
	const orphanKeys = Array.from(
		{ length: 40 },
		(_, i) => `catalog-check:${run}:orphan-${i}`,
	);
	await Promise.all(orphanKeys.map((key) => redis.set(key, "fixture")));
	const found: string[] = [];
	for await (const keys of scanRedisKeys(`catalog-check:${run}:orphan-*`))
		found.push(...keys);
	assert.equal(new Set(found).size, orphanKeys.length);
	await deleteRedisKeys(found);
	assert.ok(
		(await Promise.all(orphanKeys.map((key) => redis.exists(key)))).every(
			(value) => value === 0,
		),
	);
	assert.equal(await deleteCatalogProduct(first.id), true);
	assert.equal(await getCatalogProduct(first.slug), undefined);
	assert.equal(await redis.get(catalogKeys.sku(variant.id)), null);
	assert.equal(
		await putCatalogProduct(first),
		false,
		"Deleted products must not return through an older event",
	);
	assert.equal(await getCatalogProduct(first.slug), undefined);
	console.log(
		"✓ Redis-only index rebuild, all-primary SCAN and cross-shard deletion",
	);
} finally {
	for (const row of rows) await deleteCatalogProduct(row.id);
	await redis.close();
}
console.log("All catalog cluster checks passed.");
process.exit(0);
