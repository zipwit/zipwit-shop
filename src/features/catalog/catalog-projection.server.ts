import { buildCatalogDoc } from "#/features/search/catalog-doc";
import { publicStoreId } from "#/features/stores/store.server";
import { type CatalogRecord, skuAvailable } from "./catalog-record";

export function catalogSummary(record: CatalogRecord) {
	return buildCatalogDoc({
		...record,
		storeId: publicStoreId(record.warehouse),
		lastSeenAt: new Date(record.lastSeenAt),
		updatedAt: new Date(record.updatedAt),
		skus: record.skus
			.filter((sku) => skuAvailable(sku))
			.map((sku) => ({
				...sku,
				sourceExpiresAt: sku.sourceExpiresAt
					? new Date(sku.sourceExpiresAt)
					: null,
			})),
	});
}
