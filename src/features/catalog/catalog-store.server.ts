import { ensureCatalogReady } from "#/features/search/catalog-index.server";
import { getRedis } from "#/server/redis.server";
import { catalogSummary } from "./catalog-projection.server";
import { getCatalogProductById } from "./catalog-read.server";
import {
	type CatalogRecord,
	catalogInputSchema,
	catalogKeys,
	catalogRecordSchema,
} from "./catalog-record";
import {
	claimPointer,
	deleteProduct,
	releasePointer,
	withdrawObservedProduct,
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
	const summary = catalogSummary(record);
	const claimed: string[] = [];
	// A rejected update may already have claimed the live product's slug and SKUs.
	// Compare the claim before repairing it so a later revision keeps its pointers.
	async function repairClaims() {
		const current = await getCatalogProductById(record.id);
		const liveKeys = new Set(current ? pointerKeys(current) : []);
		for (const key of claimed) {
			await redis.eval(releasePointer, {
				keys: [key],
				arguments:
					current && liveKeys.has(key) ? [value, pointerFor(current)] : [value],
			});
		}
		return current;
	}
	let written: unknown;
	try {
		for (const key of pointers) {
			claimed.push(key);
			const result = await redis.eval(claimPointer, {
				keys: [key],
				arguments: [value],
			});
			if (result === 0) {
				await repairClaims();
				return false;
			}
		}
		written = await redis.eval(writeProduct, {
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
	} catch (error) {
		await repairClaims();
		throw error;
	}
	if (written === 0) {
		const current = await repairClaims();
		return JSON.stringify(current) === JSON.stringify(record);
	}
	if (typeof written === "string") {
		const replaced = catalogRecordSchema.parse(JSON.parse(written));
		const oldKeys = pointerKeys(replaced);
		for (const key of oldKeys.filter((key) => !pointers.includes(key))) {
			await redis.eval(releasePointer, {
				keys: [key],
				arguments: [pointerFor(replaced)],
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

/** Withdraw an ineligible supplier observation, including its search and lookup entries. */
export async function withdrawCatalogObservation(
	id: string,
	checkedAt: string,
) {
	const redis = await getRedis();
	const previous = await redis.eval(withdrawObservedProduct, {
		keys: [
			catalogKeys.record(id),
			catalogKeys.search(id),
			catalogKeys.revision(id),
		],
		arguments: [new Date(checkedAt).toISOString()],
	});
	if (typeof previous === "string") {
		const record = catalogRecordSchema.parse(JSON.parse(previous));
		for (const key of pointerKeys(record)) {
			await redis.eval(releasePointer, {
				keys: [key],
				arguments: [pointerFor(record)],
			});
		}
	}
	return previous !== 0;
}
