/** One product in a listing, priced at the offer shown on its card. */
export type ProductListItem = {
	id: string;
	storeId: string;
	slug: string;
	name: string;
	brand: string | null;
	currency: string;
	price: number;
	originalPrice: number | null;
	imageUrl: string | null;
	skuId?: string;
};

/** A listing item that is on sale, shown at its deepest-discounted SKU. */
export type Deal = ProductListItem & {
	originalPrice: number;
	/** Percent off, rounded. */
	discount: number;
};

/** A search hit with the discount used for listing order. */
export type CatalogItem = ProductListItem & { discount: number };

/** Narrows a hit to a real deal (the deals scope only ever returns these). */
export const isDeal = (item: CatalogItem): item is Deal =>
	item.originalPrice !== null && item.discount > 0;
