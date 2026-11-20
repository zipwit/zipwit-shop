import { uniqBy } from "es-toolkit";
import { z } from "zod";
import { categorySchema, departmentSchema } from "#/data/catalog";
import { storeIdSchema } from "#/features/stores/store";

/** Products per page of a listing. */
export const CATALOG_PAGE_SIZE = 48;

/** Products in the home page's drops row. */
export const HOME_DEALS_COUNT = 12;

export const catalogSorts = [
	"relevance",
	"name",
	"price-asc",
	"price-desc",
	"discount",
] as const;
export type CatalogSort = (typeof catalogSorts)[number];

export const sortLabels = {
	relevance: "Best match",
	name: "Product name",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	discount: "Biggest discount",
} satisfies Record<CatalogSort, string>;

export const facetKey = (value: string) => value.toLowerCase();

const facetList = (max: number) =>
	z
		.array(z.string().min(1).max(60))
		.max(max)
		.transform((values) => uniqBy(values, facetKey))
		.default([])
		.catch([]);

const money = z.int().min(0).max(100_000_000);

/**
 * Everything a shopper can narrow a listing by. It is also the URL's search
 * schema: malformed values fall back to "no filter" instead of erroring, so a
 * hand-edited link can never produce a broken page. Prices are minor units.
 */
export const catalogFiltersSchema = z.object({
	q: z.string().trim().max(80).optional().catch(undefined),
	brands: facetList(20),
	sizes: facetList(30),
	colors: facetList(20),
	minPrice: money.optional().catch(undefined),
	maxPrice: money.optional().catch(undefined),
	sale: z.boolean().default(false).catch(false),
	sort: z.enum(catalogSorts).optional().catch(undefined),
});
export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;
export type UpdateCatalogFilters = (previous: CatalogFilters) => CatalogFilters;

export const DEFAULT_FILTERS: CatalogFilters = catalogFiltersSchema.parse({});

/** Clears search and facets while preserving the shopper's sort order. */
export const clearCatalogFilters: UpdateCatalogFilters = ({ sort }) => ({
	...DEFAULT_FILTERS,
	sort,
});

/** Where a listing lives: a department or category, or the deals view. */
export const scopeSchema = z.object({
	storeId: storeIdSchema.optional(),
	department: departmentSchema.optional(),
	category: categorySchema.optional(),
	/** "deals" shows each product at its deepest-discounted SKU. */
	mode: z.enum(["listing", "deals"]).default("listing"),
});
export type CatalogScope = z.infer<typeof scopeSchema>;

/** The sort in force: the shopper's pick, else relevance for a search, else the page's natural order. */
export const effectiveSort = (
	filters: CatalogFilters,
	scope: CatalogScope,
): CatalogSort => {
	if (filters.sort && (filters.sort !== "relevance" || filters.q)) {
		return filters.sort;
	}
	if (filters.q) return "relevance";
	return scope.mode === "deals" ? "discount" : "name";
};

export const hasActiveFilters = (f: CatalogFilters) =>
	Boolean(f.q) ||
	f.brands.length > 0 ||
	f.sizes.length > 0 ||
	f.colors.length > 0 ||
	f.minPrice != null ||
	f.maxPrice != null ||
	f.sale;
