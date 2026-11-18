import {
	infiniteQueryOptions,
	keepPreviousData,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query";
import { isDeal } from "#/data/catalog.types";
import { nextPageParam } from "#/lib/pagination";
import { catalogFacetsFn, searchCatalogFn } from "./catalog.functions";
import {
	type CatalogFilters,
	type CatalogScope,
	DEFAULT_FILTERS,
	HOME_DEALS_COUNT,
} from "./catalog-filters";

export const catalogQuery = (scope: CatalogScope, filters: CatalogFilters) =>
	infiniteQueryOptions({
		queryKey: ["catalog", scope, filters],
		queryFn: ({ pageParam, signal }) =>
			searchCatalogFn({ data: { scope, filters, page: pageParam }, signal }),
		initialPageParam: 1,
		getNextPageParam: nextPageParam,
		staleTime: 60_000,
		placeholderData: keepPreviousData,
		retry: false,
	});

export const catalogFacetsQuery = (
	scope: CatalogScope,
	{ sort: _sort, ...filters }: CatalogFilters,
) =>
	queryOptions({
		queryKey: ["catalog-facets", scope, filters],
		queryFn: ({ signal }) =>
			catalogFacetsFn({ data: { scope, filters }, signal }),
		staleTime: 60_000,
		placeholderData: keepPreviousData,
		retry: false,
	});

/** The home page's drops row: the biggest discounts, no filters. */
export const homeDealsQuery = queryOptions({
	queryKey: ["catalog", "home-deals"],
	queryFn: ({ signal }) =>
		searchCatalogFn({
			signal,
			data: {
				scope: { mode: "deals" },
				filters: DEFAULT_FILTERS,
				page: 1,
				pageSize: HOME_DEALS_COUNT,
			},
		}),
	select: (result) => result.items.filter(isDeal),
	staleTime: 60_000,
});

/** Starts loading results and facets. Server rendering waits for the first results page. */
export const loadCatalog = (
	queryClient: QueryClient,
	scope: CatalogScope,
	filters: CatalogFilters,
) => {
	const results = queryClient
		.infiniteQuery(catalogQuery(scope, filters))
		.catch(() => undefined);
	void queryClient
		.query(catalogFacetsQuery(scope, filters))
		.catch(() => undefined);
	if (import.meta.env.SSR) return results.then(() => undefined);
};
