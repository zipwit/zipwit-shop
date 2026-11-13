import type { Category, Department } from "#/data/catalog";

/** Stable sort values support individual catalog writes without reranking all products. */
const numericSort = (value: number, id: string) =>
	`${String(value).padStart(12, "0")}:${id}`;

/**
 * One indexed product. Only in-stock SKUs are summarised, so a product with
 * nothing in stock never enters the index (matching the old listings).
 */
export type CatalogDoc = {
	checkedAt?: number;
	updatedAt?: number;
	/** Expire at the earliest supplier check expiry; a subsequent catalog write or search:sync rebuilds remaining variants. */
	expiresAt?: number;
	id: string;
	storeId: string;
	slug: string;
	name: string;
	/** Omitted rather than null, so the TAG field simply isn't indexed. */
	brand?: string;
	/** Brand and name together, so "nike air" matches across both. */
	searchText: string;
	department: Department;
	category: Category;
	currency: string;
	/** Distinct colors, comma-separated, indexed as a multi-value TAG. */
	colors: string;
	/** Distinct sizes, comma-separated, indexed as a multi-value TAG. */
	sizes: string;
	/** Cheapest in-stock SKU: what listings show. */
	price: number;
	originalPrice: number | null;
	imageUrl: string | null;
	/** Deepest discount among in-stock SKUs; 0 means not on sale. */
	discount: number;
	/** Deepest-discounted SKU: what the deals views show. */
	deal: {
		price: number;
		originalPrice: number;
		imageUrl: string | null;
	} | null;
	/**
	 * Stable sort strings include the product ID as a unique tie-breaker.
	 * Individual price updates do not require reranking other catalog products.
	 */
	sort: { name: string; price: string; dealPrice: string; discount: string };
};

type SourceSku = {
	sourceExpiresAt?: Date | null;
	color: string;
	size: string;
	price: number;
	originalPrice: number | null;
	discount: number;
	imageUrl: string | null;
};

export type SourceProduct = {
	lastSeenAt?: Date;
	updatedAt?: Date;
	id: string;
	storeId: string;
	slug: string;
	name: string;
	brand: string | null;
	department: Department;
	category: Category;
	currency: string;
	/** In-stock SKUs only. */
	skus: SourceSku[];
};

/** Distinct values as one TAG string; the index splits it on ",". */
const tagList = (values: string[]) =>
	[...new Set(values.map((value) => value.replaceAll(",", " ").trim()))]
		.filter(Boolean)
		.join(",");

/** Pure on purpose: it is the whole read model, and it is unit-tested. */
export function buildCatalogDocs(products: SourceProduct[]): CatalogDoc[] {
	const stocked = products.filter((p) => p.skus.length > 0);

	return stocked
		.toSorted((a, b) => a.id.localeCompare(b.id))
		.map((p): CatalogDoc => {
			const cheapest = p.skus.reduce((a, b) => (b.price < a.price ? b : a));
			const deepest = p.skus.reduce((a, b) =>
				b.discount > a.discount ? b : a,
			);
			const deal =
				deepest.discount > 0 && deepest.originalPrice !== null
					? {
							price: deepest.price,
							originalPrice: deepest.originalPrice,
							imageUrl: deepest.imageUrl,
						}
					: null;

			return {
				checkedAt: p.lastSeenAt?.getTime(),
				updatedAt: p.updatedAt?.getTime(),
				expiresAt: p.skus.some((s) => s.sourceExpiresAt)
					? Math.floor(
							Math.min(
								...p.skus.flatMap((s) =>
									s.sourceExpiresAt ? [s.sourceExpiresAt.getTime()] : [],
								),
							) / 1000,
						)
					: undefined,
				id: p.id,
				storeId: p.storeId,
				slug: p.slug,
				name: p.name,
				brand: p.brand ?? undefined,
				searchText: [p.brand, p.name].filter(Boolean).join(" "),
				department: p.department,
				category: p.category,
				currency: p.currency,
				colors: tagList(p.skus.map((s) => s.color)),
				sizes: tagList(p.skus.map((s) => s.size)),
				price: cheapest.price,
				originalPrice: cheapest.originalPrice,
				imageUrl: cheapest.imageUrl,
				discount: deepest.discount,
				deal,
				sort: {
					name: `${p.name.toLowerCase()}:${p.id}`,
					price: numericSort(cheapest.price, p.id),
					dealPrice: numericSort(deal?.price ?? cheapest.price, p.id),
					discount: numericSort(deepest.discount, p.id),
				},
			};
		});
}
