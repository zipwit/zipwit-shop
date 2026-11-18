import type { Category, Department } from "#/data/catalog";

/** Stable sort values support individual catalog writes without reranking all products. */
const numericSort = (value: number, id: string) =>
	`${String(value).padStart(12, "0")}:${id}`;

export type CatalogVariant = {
	skuId?: string;
	color: string;
	size: string;
	price: number;
	originalPrice: number | null;
	discount: number;
	imageUrl: string | null;
};

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
	/** Older writers may still publish the product-only summary during a rollout. */
	variants?: CatalogVariant[];
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

type SourceSku = Omit<CatalogVariant, "skuId"> & {
	id: string;
	sourceExpiresAt?: Date | null;
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
const facetValue = (value: string) => value.replaceAll(",", " ").trim();
const tagList = (values: string[]) =>
	[...new Set(values.map(facetValue))].filter(Boolean).join(",");

function earliestExpiry(skus: SourceSku[]) {
	const earliest = skus.reduce(
		(current, { sourceExpiresAt }) =>
			Math.min(current, sourceExpiresAt?.getTime() ?? Infinity),
		Infinity,
	);
	return earliest === Infinity ? undefined : Math.floor(earliest / 1000);
}

function projectVariant({
	id,
	color,
	size,
	price,
	originalPrice,
	discount,
	imageUrl,
}: SourceSku): CatalogVariant {
	return {
		skuId: id,
		color: facetValue(color),
		size: facetValue(size),
		price,
		originalPrice,
		discount,
		imageUrl,
	};
}

/** Projects an in-stock product for Redis Search. */
export function buildCatalogDoc(
	product: SourceProduct,
): CatalogDoc | undefined {
	const first = product.skus[0];
	if (!first) return undefined;

	const { skus, id, brand, name } = product;
	const cheapest = skus.reduce((a, b) => (b.price < a.price ? b : a), first);
	const deepest = skus.reduce(
		(a, b) => (b.discount > a.discount ? b : a),
		first,
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
		checkedAt: product.lastSeenAt?.getTime(),
		updatedAt: product.updatedAt?.getTime(),
		expiresAt: earliestExpiry(skus),
		id,
		storeId: product.storeId,
		slug: product.slug,
		name,
		brand: brand ?? undefined,
		searchText: [brand, name].filter(Boolean).join(" "),
		department: product.department,
		category: product.category,
		currency: product.currency,
		colors: tagList(skus.map((sku) => sku.color)),
		sizes: tagList(skus.map((sku) => sku.size)),
		variants: skus.map(projectVariant),
		price: cheapest.price,
		originalPrice: cheapest.originalPrice,
		imageUrl: cheapest.imageUrl,
		discount: deepest.discount,
		deal,
		sort: {
			name: `${name.toLowerCase()}:${id}`,
			price: numericSort(cheapest.price, id),
			dealPrice: numericSort(deal?.price ?? cheapest.price, id),
			discount: numericSort(deepest.discount, id),
		},
	};
}

export function buildCatalogDocs(products: SourceProduct[]) {
	return products
		.toSorted((a, b) => a.id.localeCompare(b.id))
		.flatMap((product) => {
			const doc = buildCatalogDoc(product);
			return doc ? [doc] : [];
		});
}
