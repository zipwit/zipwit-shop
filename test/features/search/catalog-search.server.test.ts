import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCatalogDocs } from "#/features/search/catalog-doc";
import { DEFAULT_FILTERS } from "#/features/search/catalog-filters";
import {
	catalogFacets,
	searchCatalog,
} from "#/features/search/catalog-search.server";

const ft = vi.hoisted(() => ({ search: vi.fn(), searchByRelevance: vi.fn() }));
vi.mock("#/features/search/redis-ft.server", () => ({ ft }));
vi.mock("#/features/search/catalog-index.server", () => ({
	INDEX: "test",
	ensureCatalogReady: vi.fn(),
}));

const docs = buildCatalogDocs([
	{
		id: "product",
		storeId: "a".repeat(64),
		slug: "product",
		name: "Product",
		brand: null,
		department: "men",
		category: "shoes",
		currency: "GEL",
		skus: [
			{
				id: "00000000-0000-4000-8000-000000000001",
				color: "black",
				size: "40",
				price: 5000,
				originalPrice: null,
				discount: 0,
				imageUrl: null,
			},
			{
				id: "00000000-0000-4000-8000-000000000002",
				color: "white",
				size: "41",
				price: 8000,
				originalPrice: 16000,
				discount: 50,
				imageUrl: "https://example.test/white.png",
			},
		],
	},
]);

beforeEach(() => {
	vi.clearAllMocks();
	ft.search.mockResolvedValue({ total: 1, docs });
});

describe("catalog prices", () => {
	it.each([
		["listing", 5000, "sortPrice"],
		["deals", 8000, "sortDealPrice"],
	] as const)(
		"keeps %s cards, sorting, and price bounds consistent",
		async (mode, price, sortField) => {
			const scope = { mode };
			const result = await searchCatalog(
				scope,
				{ ...DEFAULT_FILTERS, sort: "price-asc" },
				1,
				48,
			);
			const skuId =
				mode === "listing"
					? "00000000-0000-4000-8000-000000000001"
					: "00000000-0000-4000-8000-000000000002";
			expect(result.items[0]).toMatchObject({ price, skuId });
			expect(ft.search).toHaveBeenLastCalledWith(
				"test",
				expect.any(String),
				expect.objectContaining({ sort: { BY: sortField, DIRECTION: "ASC" } }),
			);

			const facets = await catalogFacets(scope, DEFAULT_FILTERS);
			expect(facets.price).toEqual({ min: price, max: 8000 });
		},
	);

	it.each([true, false])(
		"reads older deal projections with variants present = %s",
		async (hasVariants) => {
			ft.search.mockResolvedValue({
				total: 1,
				docs: docs.map(({ deal, variants, ...summary }) => ({
					...summary,
					skuId: undefined,
					deal: { ...deal, skuId: undefined },
					variants: hasVariants ? variants : undefined,
				})),
			});
			const result = await searchCatalog(
				{ mode: "deals" },
				DEFAULT_FILTERS,
				1,
				48,
			);
			expect(result.items[0]).toMatchObject({ price: 8000, discount: 50 });
			expect(result.items[0]?.skuId).toBe(
				hasVariants ? "00000000-0000-4000-8000-000000000002" : undefined,
			);
		},
	);
});

it("retains the anonymous store restriction in results and every facet query", async () => {
	const storeId = "a".repeat(64);
	const scope = { mode: "listing" as const, storeId };
	const result = await searchCatalog(scope, DEFAULT_FILTERS, 1, 48);
	expect(result.items[0]?.storeId).toBe(storeId);
	expect(result.items[0]).not.toHaveProperty("warehouse");
	await catalogFacets(scope, {
		...DEFAULT_FILTERS,
		brands: ["Nike"],
		minPrice: 5000,
	});
	for (const call of ft.search.mock.calls) {
		expect(call[1]).toContain(`@store:{${storeId}}`);
	}
});

it("requires one variant to match and uses its price and image", async () => {
	const scope = { mode: "listing" as const };
	const filters = { ...DEFAULT_FILTERS, colors: ["white"], minPrice: 7000 };
	const impossible = await searchCatalog(
		scope,
		{ ...filters, sizes: ["40"] },
		1,
		48,
	);
	expect(impossible).toEqual({ items: [], total: 0, hasMore: false });
	const match = await searchCatalog(
		scope,
		{ ...filters, sizes: ["41"] },
		1,
		48,
	);
	expect(match.items).toEqual([
		expect.objectContaining({
			price: 8000,
			discount: 50,
			skuId: "00000000-0000-4000-8000-000000000002",
			imageUrl: "https://example.test/white.png",
		}),
	]);
});

it("counts variants that satisfy the other facets and only sale variants on Deals", async () => {
	const filters = { ...DEFAULT_FILTERS, sizes: ["40"], colors: ["white"] };
	const facets = await catalogFacets({ mode: "listing" }, filters);
	expect(facets.colors).toEqual([{ value: "black", count: 1 }]);
	expect(facets.sizes).toEqual([{ value: "41", count: 1 }]);
	expect(facets.price).toBeNull();
	expect(await catalogFacets({ mode: "deals" }, DEFAULT_FILTERS)).toMatchObject(
		{
			colors: [{ value: "white", count: 1 }],
			sizes: [{ value: "41", count: 1 }],
		},
	);
});

it("reuses a complete ranked variant scan across adjacent pages", async () => {
	const batch = docs.flatMap((doc) =>
		Array.from({ length: 256 }, (_, index) => ({ ...doc, id: String(index) })),
	);
	ft.searchByRelevance
		.mockResolvedValueOnce({ docs: batch, rows: batch.length })
		.mockResolvedValueOnce({ docs, rows: docs.length });

	const scope = { mode: "listing" as const };
	const filters = { ...DEFAULT_FILTERS, q: "product", colors: ["white"] };
	const first = await searchCatalog(scope, filters, 1, 256);
	const second = await searchCatalog(scope, filters, 2, 256);

	expect(first).toMatchObject({ total: 257, hasMore: true });
	expect(second).toMatchObject({ total: 257, hasMore: false });
	expect(second.items.map(({ id }) => id)).toEqual(["product"]);
	expect(ft.searchByRelevance).toHaveBeenCalledTimes(2);
	expect(ft.searchByRelevance).toHaveBeenLastCalledWith(
		"test",
		expect.any(String),
		{ offset: 256, limit: 256 },
	);
});
