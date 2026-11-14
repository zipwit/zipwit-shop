import { ensureCatalogReady } from "#/features/search/catalog-index.server";
import { getRedis } from "#/server/redis.server";
import { catalogSummary } from "./catalog-projection.server";
import { getCatalogProductById } from "./catalog-read.server";
import {
	type CatalogRecord,
	catalogInputSchema,
	catalogKeys,
} from "./catalog-record";
import {
	claimPointer,
	deleteProduct,
	releasePointer,
	writeProduct,
} from "./catalog-scripts.server";

const pointerFor = (record: CatalogRecord) =>
	JSON.stringify({ id: record.id, revision: record.updatedAt });
const pointerKeys = (record: CatalogRecord) => [
	catalogKeys.slug(record.slug),
	...record.skus.map((sku) => catalogKeys.sku(sku.id)),
];

/**
 * Trusted server-side catalog writer; no upload/review workflow or public write endpoint.
 * Each product and its Search summary commit atomically in one slot. Older events
 * cannot overwrite a newer revision; SKU and slug pointers are validated on reads.
 */
export async function putCatalogProduct(input: CatalogRecord) {
	const record = catalogInputSchema.parse(input);
	record.updatedAt = new Date(record.updatedAt).toISOString();
	await ensureCatalogReady();
	const redis = await getRedis();
	const previous = await getCatalogProductById(record.id);
	if (previous && previous.updatedAt >= record.updatedAt) {
		return (
			previous.updatedAt === record.updatedAt &&
			JSON.stringify(previous) === JSON.stringify(record)
		);
	}
	const pointers = pointerKeys(record);
	const value = pointerFor(record);
	const claimed: string[] = [];
	try {
		for (const key of pointers) {
			await redis.eval(claimPointer, { keys: [key], arguments: [value] });
			claimed.push(key);
		}
	} catch (error) {
		for (const key of claimed)
			await redis.eval(releasePointer, { keys: [key], arguments: [value] });
		throw error;
	}
	const summary = catalogSummary(record);
	const written = await redis.eval(writeProduct, {
		keys: [
			catalogKeys.record(record.id),
			catalogKeys.search(record.id),
			catalogKeys.revision(record.id),
		],
		arguments: [
			record.updatedAt,
			JSON.stringify(record),
			summary ? JSON.stringify(summary) : "",
			summary?.expiresAt ? String(summary.expiresAt) : "",
		],
	});
	if (written !== 1) {
		const current = await getCatalogProductById(record.id);
		if (current && JSON.stringify(current) === JSON.stringify(record))
			return true;
		for (const key of pointers) {
			await redis.eval(releasePointer, { keys: [key], arguments: [value] });
		}
		return false;
	}
	if (previous) {
		const oldKeys = pointerKeys(previous);
		for (const key of oldKeys.filter((key) => !pointers.includes(key))) {
			await redis.eval(releasePointer, {
				keys: [key],
				arguments: [pointerFor(previous)],
			});
		}
	}
	return true;
}

/** Delete only the revision we read; a concurrent newer update must survive. */
export async function deleteCatalogProduct(id: string) {
	const redis = await getRedis();
	const record = await getCatalogProductById(id);
	if (!record) return false;
	const deleted = await redis.eval(deleteProduct, {
		keys: [
			catalogKeys.record(id),
			catalogKeys.search(id),
			catalogKeys.revision(id),
		],
		arguments: [
			record.updatedAt,
			new Date(
				Math.max(Date.now(), Date.parse(record.updatedAt) + 1),
			).toISOString(),
		],
	});
	if (deleted !== 1) return false;
	for (const key of pointerKeys(record)) {
		await redis.eval(releasePointer, {
			keys: [key],
			arguments: [pointerFor(record)],
		});
	}
	return true;
}
