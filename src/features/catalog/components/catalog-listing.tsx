import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { InfiniteScrollFooter } from "#/components/infinite-scroll-footer";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { isDeal } from "#/data/catalog.types";
import {
	catalogFacetsQuery,
	catalogQuery,
} from "#/features/search/catalog.queries";
import {
	type CatalogFilters,
	type CatalogScope,
	DEFAULT_FILTERS,
	hasActiveFilters,
	type UpdateCatalogFilters,
} from "#/features/search/catalog-filters";
import { useTranslation } from "#/i18n/translate";
import { DealCard, dealImageLoading } from "./deal-card";
import { FilterBar } from "./filter-bar";
import { ProductGrid } from "./product-grid";

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
				<div className="mt-8 flex flex-wrap items-center gap-3">
					<p role="alert">{t("Couldn't load results.")}</p>
					<Button
						variant="outline"
						disabled={isFetching}
						onClick={() => refetch()}
					>
						{t("Try again")}
					</Button>
				</div>
			)}
			{items.length === 0 ? (
				!data || isPlaceholderData ? null : filtered ? (
					<Empty className="my-8 border">
						<EmptyHeader>
							<EmptyTitle>{t("Nothing matches these filters.")}</EmptyTitle>
							<EmptyDescription>
								{t("Try a shorter search or remove a filter.")}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button
								variant="outline"
								onClick={() =>
									onFiltersChange((current) => ({
										...DEFAULT_FILTERS,
										sort: current.sort,
									}))
								}
							>
								{t("Clear filters")}
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					(empty ?? (
						<Empty className="my-8 border">
							<EmptyHeader>
								<EmptyTitle>{t("No products yet.")}</EmptyTitle>
								<EmptyDescription>
									{t("Check back after the next price refresh.")}
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					))
				)
			) : scope.mode === "deals" ? (
				<ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
					{items.filter(isDeal).map((deal, index) => (
						<li key={deal.id}>
							<DealCard deal={deal} loading={dealImageLoading(index)} />
						</li>
					))}
				</ul>
			) : (
				<ProductGrid products={items} />
			)}

			<InfiniteScrollFooter
				hasNextPage={!isPlaceholderData && hasNextPage}
				isFetchingNextPage={isFetchingNextPage}
				isError={isFetchNextPageError}
				fetchNextPage={fetchNextPage}
			/>
		</>
	);
}
