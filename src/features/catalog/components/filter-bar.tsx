import { useId, useState } from "react";
import { Button } from "#/components/ui/button";
import type { CatalogFacets } from "#/features/search/catalog.functions";
import type {
	CatalogFilters,
	CatalogScope,
} from "#/features/search/catalog-filters";
import { formatCount } from "#/i18n/format";
import { useLocale } from "#/i18n/locale";
import { useTranslation } from "#/i18n/translate";
import { ActiveFilters } from "./active-filters";
import { CatalogFilterControls } from "./catalog-filter-controls";
import { CatalogSort } from "./catalog-sort";
import { SearchBox } from "./search-box";

type FilterBarProps = {
	scope: CatalogScope;
	filters: CatalogFilters;
	facets: CatalogFacets;
	total: number;
	onChange: (filters: CatalogFilters) => void;
};

/** Pure composition: every control reads `filters` and reports a change; the URL owns the state. */
export function FilterBar({
	scope,
	filters,
	facets,
	total,
	onChange,
}: FilterBarProps) {
	const t = useTranslation();
	const locale = useLocale();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const filtersId = useId();
	const set = (patch: Partial<CatalogFilters>) =>
		onChange({ ...filters, ...patch });

	const isListing = scope.mode === "listing";

	return (
		<div className="mt-7 flex flex-col gap-4 border-y py-5">
			<div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 md:grid-cols-[minmax(12rem,22rem)_1fr_auto]">
				<SearchBox
					className="col-span-2 min-w-0 w-full md:col-span-1"
					value={filters.q ?? ""}
					onCommit={(q) => set({ q: q.trim() || undefined })}
				/>
				<p
					className="type-caption col-span-2 whitespace-nowrap text-muted-foreground md:col-span-1 md:col-start-2 md:row-start-1"
					aria-live="polite"
				>
					<span className="type-num text-foreground">
						{formatCount(total, locale)}
					</span>{" "}
					{t(total === 1 ? "result" : "results")}
				</p>
				<Button
					variant="outline"
					className="h-11 px-4 md:hidden"
					aria-expanded={filtersOpen}
					aria-controls={filtersId}
					onClick={() => setFiltersOpen((open) => !open)}
				>
					{filtersOpen ? t("Hide filters") : t("Filters")}
				</Button>
				<div className="min-w-0 md:col-start-3 md:row-start-1">
					<CatalogSort filters={filters} scope={scope} onChange={onChange} />
				</div>
			</div>

			<div
				id={filtersId}
				className={`${filtersOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 md:flex`}
			>
				<CatalogFilterControls
					filters={filters}
					facets={facets}
					showSale={isListing}
					onChange={set}
				/>
			</div>

			<ActiveFilters
				filters={filters}
				showSale={isListing}
				onChange={onChange}
			/>
		</div>
	);
}
