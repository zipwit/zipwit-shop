import { getRedis } from "#/server/redis.server";
import {
	catalogKeys,
	catalogRecordSchema,
	skuAvailable,
} from "./catalog-record";
export async function getCatalogProductById(id: string) {
	const value = await (await getRedis()).json.get(catalogKeys.record(id));
	return value === null ? undefined : catalogRecordSchema.parse(value);
}

type Pointer = { id: string; revision: string };
const parsePointer = (value: string | null): Pointer | undefined =>
	value ? JSON.parse(value) : undefined;

/** Redis is the live catalog. A missing product never triggers a SQL query. */
export async function getCatalogProduct(slug: string) {
	const pointer = parsePointer(
		await (await getRedis()).get(catalogKeys.slug(slug)),
	);
	if (!pointer) return undefined;
	const product = await getCatalogProductById(pointer.id);
	return product?.slug === slug ? product : undefined;
}

/** Resolve pointers individually so a multi-SKU cart can span Cluster slots. */
export async function findCatalogSkus(ids: string[]) {
	const redis = await getRedis();
	const pointers = await Promise.all(
		ids.map(async (id) => parsePointer(await redis.get(catalogKeys.sku(id)))),
	);
	const products = new Map(
		await Promise.all(
			[
				...new Set(
					pointers.flatMap((pointer) => (pointer ? [pointer.id] : [])),
				),
			].map(async (id) => [id, await getCatalogProductById(id)] as const),
		),
	);
	return ids.flatMap((id, index) => {
		const pointer = pointers[index];
		const product = pointer ? products.get(pointer.id) : undefined;
		const sku = product?.skus.find((sku) => sku.id === id);
		if (!product || product.browseOnly || !sku || !skuAvailable(sku)) return [];
		return [
			{
				id: sku.id,
				name: `${product.name} (${sku.color}, ${sku.size})`,
				color: sku.color,
				size: sku.size,
				currency: product.currency,
				warehouse: product.warehouse,
				image: sku.imageUrl,
				price: sku.price,
				sourceExpiresAt: sku.sourceExpiresAt,
				sourceUrl: product.sourceUrl,
			},
		];
	});
}
