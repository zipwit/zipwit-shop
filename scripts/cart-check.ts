import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCartStore } from "../src/features/cart/cart-store.server";
import { getRedis } from "../src/server/redis.server";

// Uses one isolated, expiring key. Never reads or resets visitor carts.
const redis = await getRedis();
const key = `cart-check:${randomUUID()}`;
const available = [{ id: "live", currency: "USD" }];
try {
	await redis.hSet(key, { live: "2", stale: "1", invalid: "NaN" });
	await redis.expire(key, 60);
	const store = createCartStore(redis, async () => available);
	await store.removeUnavailable(key);
	assert.deepEqual(await redis.hGetAll(key), { live: "2" });

	await redis.hSet(key, "stale", "1");
	const captured = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	const concurrent = createCartStore(redis, async () => {
		captured.resolve();
		await release.promise;
		return available;
	});
	const removal = concurrent.removeUnavailable(key);
	await captured.promise;
	await redis.hSet(key, "stale", "3");
	release.resolve();
	await removal;
	assert.equal(await redis.hGet(key, "stale"), "3");

	const outage = createCartStore(redis, async () => {
		throw new Error("catalog offline");
	});
	await assert.rejects(outage.removeUnavailable(key), /catalog offline/);
	assert.equal(await redis.hGet(key, "stale"), "3");

	const recovered = createCartStore(redis, async () => [
		...available,
		{ id: "stale", currency: "USD" },
	]);
	await recovered.removeUnavailable(key);
	assert.equal(await redis.hGet(key, "stale"), "3");
	console.log(
		"Cart recovery passed: stale removal, valid-item preservation, concurrent edits, outages, and restored stock.",
	);
} finally {
	await redis.del(key);
	await redis.close();
}
