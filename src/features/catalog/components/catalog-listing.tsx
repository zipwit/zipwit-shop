import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { InfiniteScrollFooter } from "#/components/infinite-scroll-footer";
import { RetryNotice } from "#/components/retry-notice";
import {
	catalogFacetsQuery,
	catalogQuery,
} from "#/features/search/catalog.queries";
import {
	type CatalogFilters,
	type CatalogScope,
	clearCatalogFilters,
	hasActiveFilters,
	type UpdateCatalogFilters,
} from "#/features/search/catalog-filters";
import { useTranslation } from "#/i18n/translate";
import { CatalogResults } from "./catalog-results";
import { FilterBar } from "./filter-bar";

type CatalogListingProps = {
	scope: CatalogScope;
	filters: CatalogFilters;
	onFiltersChange: (update: UpdateCatalogFilters) => void;
	/** Shown when the scope has no products at all (not when filters hide them). */
	empty?: ReactNode;
};

/**
 * One listing for departments, categories and deals. The URL holds the
 * filters, the server does the filtering, and this only renders the result.
 */
export function CatalogListing({
	scope,
	filters,
	onFiltersChange,
	empty,
}: CatalogListingProps) {
	const t = useTranslation();
	const {
		data,
		isPending,
		isError,
		isFetching,
		isPlaceholderData,
		refetch,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
	} = useInfiniteQuery(catalogQuery(scope, filters));
	const facets = useQuery(catalogFacetsQuery(scope, filters));

	const items = data?.pages.flatMap((page) => page.items) ?? [];
	const total = isPlaceholderData ? undefined : data?.pages[0]?.total;
	const filtered = hasActiveFilters(filters);

	return (
		<>
			<FilterBar
				scope={scope}
				filters={filters}
				facets={facets.data}
				facetsPending={facets.isPending || facets.isPlaceholderData}
				onRetryFacets={facets.isError ? () => facets.refetch() : undefined}
				total={total}
				resultsPending={isPending || isPlaceholderData}
				onChange={onFiltersChange}
			/>

			{isError && !isFetchNextPageError && (
				<RetryNotice
					className="mt-8"
					message={t("Couldn't load results.")}
					retrying={isFetching}
					onRetry={() => refetch()}
				/>
			)}
			<CatalogResults
				items={items}
				mode={scope.mode}
				showEmpty={Boolean(data) && !isPlaceholderData && !isError}
				filtered={filtered}
				empty={empty}
				onClear={() => onFiltersChange(clearCatalogFilters)}
			/>

			<InfiniteScrollFooter
				hasNextPage={!isPlaceholderData && hasNextPage}
				isFetchingNextPage={isFetchingNextPage}
				isError={isFetchNextPageError}
				fetchNextPage={fetchNextPage}
			/>
		</>
	);
}
