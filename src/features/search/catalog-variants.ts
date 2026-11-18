import type { Category } from "#/data/catalog";
import { compareSizes } from "#/data/sizes";
import type { CatalogVariant } from "./catalog-doc";
import type { CatalogFilters, CatalogScope } from "./catalog-filters";

type VariantFacet = "colors" | "sizes" | "price";
type FacetOption = { value: string; count: number };

function matchFacetValues(values: string[]) {
	const selected = new Set(values.map((value) => value.toLowerCase()));
	return (value: string) =>
		selected.size === 0 || selected.has(value.toLowerCase());
}

function matchVariant(scope: CatalogScope, filters: CatalogFilters) {
	const matchesColor = matchFacetValues(filters.colors);
	const matchesSize = matchFacetValues(filters.sizes);
	const saleOnly = filters.sale || scope.mode === "deals";
	const minPrice = filters.minPrice ?? 0;
	const maxPrice = filters.maxPrice ?? Infinity;

	return (sku: CatalogVariant, ignoredFacet?: VariantFacet) =>
		(!saleOnly || (sku.discount > 0 && sku.originalPrice !== null)) &&
		(ignoredFacet === "colors" || matchesColor(sku.color)) &&
		(ignoredFacet === "sizes" || matchesSize(sku.size)) &&
		(ignoredFacet === "price" ||
			(sku.price >= minPrice && sku.price <= maxPrice));
}

export const needsVariantMatch = (filters: CatalogFilters) =>
	filters.sale ||
	filters.colors.length > 0 ||
	filters.sizes.length > 0 ||
	filters.minPrice !== undefined ||
	filters.maxPrice !== undefined;

/** Listings prefer the lowest eligible price. Deals prefer the deepest eligible discount. */
export function selectCatalogVariant(
	scope: CatalogScope,
	filters: CatalogFilters,
) {
	const matches = matchVariant(scope, filters);
	const rank =
		scope.mode === "deals"
			? (sku: CatalogVariant) => -sku.discount
			: (sku: CatalogVariant) => sku.price;

	return (skus: CatalogVariant[]) => {
		let chosen: CatalogVariant | undefined;
		for (const sku of skus) {
			if (matches(sku) && (!chosen || rank(sku) < rank(chosen))) chosen = sku;
		}
		return chosen;
	};
}

function countOptions(counts: Map<string, FacetOption>, values: string[]) {
	const distinct = new Map(
		values.filter(Boolean).map((value) => [value.toLowerCase(), value]),
	);
	for (const [key, value] of distinct) {
		const existing = counts.get(key);
		if (existing) existing.count++;
		else counts.set(key, { value, count: 1 });
	}
}

const sizeKind = (size: string): Category =>
	Number.isNaN(Number(size)) ? "clothing" : "shoes";

function compareFacetSizes(a: FacetOption, b: FacetOption) {
	const kindA = sizeKind(a.value);
	const kindB = sizeKind(b.value);
	if (kindA !== kindB) return kindA === "shoes" ? -1 : 1;
	return compareSizes(kindA, a.value, b.value);
}

const byCount = (a: FacetOption, b: FacetOption) =>
	b.count - a.count || a.value.localeCompare(b.value);

/** Add each product once. Each facet counts eligible options with its own selection ignored. */
export function createCatalogFacetCounter(
	scope: CatalogScope,
	filters: CatalogFilters,
) {
	const brands = new Map<string, FacetOption>();
	const sizes = new Map<string, FacetOption>();
	const colors = new Map<string, FacetOption>();
	const matchesBrand = matchFacetValues(filters.brands);
	const matches = matchVariant(scope, filters);
	let min = Infinity;
	let max = -Infinity;

	return {
		addProduct(brand: string | undefined, skus: CatalogVariant[]) {
			if (brand && skus.some((sku) => matches(sku)))
				countOptions(brands, [brand]);
			if (!matchesBrand(brand ?? "")) return;
			countOptions(
				sizes,
				skus.filter((sku) => matches(sku, "sizes")).map((sku) => sku.size),
			);
			countOptions(
				colors,
				skus.filter((sku) => matches(sku, "colors")).map((sku) => sku.color),
			);
			for (const sku of skus) {
				if (matches(sku, "price")) {
					min = Math.min(min, sku.price);
					max = Math.max(max, sku.price);
				}
			}
		},
		result() {
			return {
				brands: [...brands.values()].sort(byCount),
				sizes: [...sizes.values()].sort(compareFacetSizes),
				colors: [...colors.values()].sort(byCount),
				price: min <= max ? { min, max } : null,
			};
		},
	};
}
