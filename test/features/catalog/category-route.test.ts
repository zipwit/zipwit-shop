import { QueryClient } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCatalog } from "#/features/search/catalog.queries";
import { DEFAULT_FILTERS } from "#/features/search/catalog-filters";
import type { Locale } from "#/i18n/locale-config";
import type { Route as RootRoute } from "#/routes/__root";
import { Route } from "#/routes/categories.$category";

vi.mock("#/features/search/catalog.queries", () => ({
	loadCatalog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("#/features/catalog/components/catalog-listing", () => ({
	CatalogListing: () => null,
}));

function routerFor(path: string, locale: Locale = "ka") {
	const loader: NonNullable<typeof RootRoute.options.loader> = async () => ({
		socialProviders: [],
	});
	const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
		beforeLoad: async () => ({ locale }),
		loader,
	});
	const category = createRoute({
		getParentRoute: () => root,
		path: "/categories/$category",
		beforeLoad: Route.options.beforeLoad,
		validateSearch: Route.options.validateSearch,
		search: Route.options.search,
		loaderDeps: Route.options.loaderDeps,
		loader: Route.options.loader,
	});
	return createRouter({
		routeTree: root.addChildren([category]),
		context: { queryClient: new QueryClient() },
		history: createMemoryHistory({ initialEntries: [path] }),
	});
}

beforeEach(() => vi.clearAllMocks());

describe("category route", () => {
	it.each([
		["shoes", "ფეხსაცმელი"],
		["clothing", "ტანსაცმელი"],
		["accessories", "აქსესუარები"],
	])("browses %s across all departments", async (category, title) => {
		const router = routerFor(`/categories/${category}`);
		await router.load();
		expect(router.state.matches.at(-1)?.status).toBe("success");
		expect(router.state.matches.at(-1)?.context).toMatchObject({ title });
		expect(loadCatalog).toHaveBeenCalledWith(
			expect.any(QueryClient),
			{ category, mode: "listing" },
			DEFAULT_FILTERS,
		);
	});
	it("rejects unknown categories before querying", async () => {
		const router = routerFor("/categories/unknown");
		await router.load();
		expect(router.state.matches.at(-1)?.status).toBe("notFound");
		expect(loadCatalog).not.toHaveBeenCalled();
	});
	it("validates filters and localizes English category titles", async () => {
		const router = routerFor(
			"/categories/accessories?colors=%5B%22black%22%5D&sort=price-asc",
			"en",
		);
		await router.load();
		expect(router.state.matches.at(-1)?.context).toMatchObject({
			title: "Accessories",
		});
		expect(loadCatalog).toHaveBeenCalledWith(
			expect.any(QueryClient),
			{ category: "accessories", mode: "listing" },
			{ ...DEFAULT_FILTERS, colors: ["black"], sort: "price-asc" },
		);
	});
});
