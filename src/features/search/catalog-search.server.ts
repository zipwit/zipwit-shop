import type { CatalogItem } from "#/data/catalog.types";
import { pageOffset } from "#/lib/pagination";
import {
	catalogCandidateBatches,
	readCatalogPage,
	readCatalogVariants,
} from "./catalog-candidates.server";
import type { CatalogDoc } from "./catalog-doc";
import {
	type CatalogFilters,
	type CatalogScope,
	type CatalogSort,
	DEFAULT_FILTERS,
	effectiveSort,
} from "./catalog-filters";
import { ensureCatalogReady } from "./catalog-index.server";
import { buildQuery } from "./catalog-query";
import {
	createCatalogFacetCounter,
	needsVariantMatch,
	selectCatalogVariant,
} from "./catalog-variants";

function toItem(
	doc: CatalogDoc,
	shown: Pick<CatalogItem, "price" | "originalPrice" | "imageUrl" | "skuId">,
	discount: number,
): CatalogItem {
	return {
		id: doc.id,
		storeId: doc.storeId,
		slug: doc.slug,
		name: doc.name,
		brand: doc.brand ?? null,
		currency: doc.currency,
		price: shown.price,
		originalPrice: shown.originalPrice,
		imageUrl: shown.imageUrl,
		discount,
		...(shown.skuId && { skuId: shown.skuId }),
	};
}

async function findVariantMatches(
	scope: CatalogScope,
	filters: CatalogFilters,
	sort: CatalogSort,
) {
	const selectVariant = selectCatalogVariant(scope, filters);
	const query = buildQuery(scope, {
		...filters,
		minPrice: undefined,
		maxPrice: undefined,
	});
	const matches = new Map<string, CatalogItem>();
	for await (const batch of catalogCandidateBatches(
		query,
		scope,
		sort === "relevance" ? sort : "name",
	)) {
		const results = await Promise.all(
			batch.map(async (doc) => {
				const sku = selectVariant(await readCatalogVariants(doc));
				return sku ? toItem(doc, sku, sku.discount) : undefined;
			}),
		);
		for (const item of results) {
			if (item && !matches.has(item.id)) matches.set(item.id, item);
		}
	}
	const items = [...matches.values()];
	if (sort === "name" || sort === "relevance") return items;
	const direction = sort === "price-asc" ? 1 : -1;
	return items.sort((a, b) => {
		const difference =
			sort === "discount" ? a.discount - b.discount : a.price - b.price;
		return (difference || a.id.localeCompare(b.id)) * direction;
	});
}

const MATCH_CACHE_MS = 15_000;
const MATCH_CACHE_ENTRIES = 8;
const MATCH_CACHE_MAX_ITEMS = 4096;
const recentMatches = new Map<
	string,
	{ expiresAt: number; items: Promise<CatalogItem[]> }
>();

/** Share a filtered scan across adjacent pages and simultaneous requests. */
function loadVariantMatches(
	scope: CatalogScope,
	filters: CatalogFilters,
	sort: CatalogSort,
) {
	const key = JSON.stringify([scope, filters]);
	const cached = recentMatches.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.items;

	recentMatches.delete(key);
	const items = findVariantMatches(scope, filters, sort);
	const entry = { expiresAt: Date.now() + MATCH_CACHE_MS, items };
	recentMatches.set(key, entry);
	if (recentMatches.size > MATCH_CACHE_ENTRIES) {
		const oldest = recentMatches.keys().next().value;
		if (oldest !== undefined) recentMatches.delete(oldest);
	}
	const discard = () => {
		if (recentMatches.get(key) === entry) recentMatches.delete(key);
	};
	void items.then((matches) => {
		if (matches.length > MATCH_CACHE_MAX_ITEMS) discard();
	}, discard);
	return items;
}

/** Returns one offer per product. Active variant filters must match the same SKU. */
export async function searchCatalog(
	scope: CatalogScope,
	filters: CatalogFilters,
	page: number,
	pageSize: number,
) {
	await ensureCatalogReady();
	const offset = pageOffset(page, pageSize);
	const sort = effectiveSort(filters, scope);
	if (!needsVariantMatch(filters)) {
		const { total, docs } = await readCatalogPage(
			buildQuery(scope, filters),
			scope,
			sort,
			offset,
			pageSize,
		);
		const selectVariant = selectCatalogVariant(scope, filters);
		return {
			items: docs.map((doc) => {
				const summary = (scope.mode === "deals" ? doc.deal : null) ?? doc;
				// During rollout, recover the SKU from older variant projections.
				const offer =
					!summary.skuId && doc.variants
						? (selectVariant(doc.variants) ?? summary)
						: summary;
				return toItem(doc, offer, doc.discount);
			}),
			total,
			hasMore: offset + docs.length < total,
		};
	}

	const items = await loadVariantMatches(scope, filters, sort);
	return {
		items: items.slice(offset, offset + pageSize),
		total: items.length,
		hasMore: offset + pageSize < items.length,
	};
}

/** Counts each product once per eligible option, ignoring each facet's own selection. */
export async function catalogFacets(
	scope: CatalogScope,
	filters: CatalogFilters,
) {
	await ensureCatalogReady();
	const facets = createCatalogFacetCounter(scope, filters);
	const seen = new Set<string>();
	const query = buildQuery(scope, {
		...DEFAULT_FILTERS,
		q: filters.q,
		sale: filters.sale,
	});
	for await (const batch of catalogCandidateBatches(query, scope, "name")) {
		const products = await Promise.all(
			batch.map(async (doc) => ({ doc, skus: await readCatalogVariants(doc) })),
		);
		for (const { doc, skus } of products) {
			if (seen.has(doc.id)) continue;
			seen.add(doc.id);
			facets.addProduct(doc.brand, skus);
		}
	}
	return facets.result();
}
