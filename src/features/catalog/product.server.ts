import { sortSkus } from "#/data/sizes";
import { publicStoreId } from "#/features/stores/store.server";
import { getCatalogProduct } from "./catalog-read.server";
import { skuAvailable } from "./catalog-record";

export const findProductBySlug = async (slug: string) => {
	const found = await getCatalogProduct(slug);

	if (!found) return undefined;
	const available = found.skus.map(({ sourceExpiresAt, ...sku }) => ({
		...sku,
		inStock: skuAvailable({ ...sku, sourceExpiresAt }),
	}));
	if (found.browseOnly && !available.some((sku) => sku.inStock))
		return undefined;
	return {
		id: found.id,
		slug: found.slug,
		name: found.name,
		brand: found.brand,
		description: found.description,
		department: found.department,
		category: found.category,
		currency: found.currency,
		checkedAt: found.sourceUrl ? found.lastSeenAt : null,
		storeId: publicStoreId(found.warehouse),
		purchasable: !found.browseOnly,
		skus: sortSkus(available, found.category),
	};
};
