import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	type CatalogFilters,
	type CatalogScope,
	catalogSorts,
	effectiveSort,
	sortLabels,
	type UpdateCatalogFilters,
} from "#/features/search/catalog-filters";
import { useTranslation } from "#/i18n/translate";

export function CatalogSort({
	filters,
	scope,
	onChange,
}: {
	filters: CatalogFilters;
	scope: CatalogScope;
	onChange: (update: UpdateCatalogFilters) => void;
}) {
	const t = useTranslation();
	const choices = catalogSorts
		.filter((value) => value !== "relevance" || filters.q)
		.map((value) => ({ value, label: t(sortLabels[value]) }));
	return (
		<Select
			items={choices}
			value={effectiveSort(filters, scope)}
			onValueChange={(sort) => {
				if (sort)
					onChange((current) => ({
						...current,
						sort:
							sort === effectiveSort({ ...current, sort: undefined }, scope)
								? undefined
								: sort,
					}));
			}}
		>
			<SelectTrigger
				className="h-11 w-full min-w-0 md:w-64"
				aria-label={t("Sort by")}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent
				align="end"
				alignItemWithTrigger={false}
				className="w-max min-w-(--anchor-width) max-w-(--available-width)"
			>
				{choices.map(({ value, label }) => (
					<SelectItem key={value} value={value}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
