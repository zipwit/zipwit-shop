import { Toggle } from "#/components/ui/toggle";
import type { CatalogFacets } from "#/features/search/catalog.functions";
import type { CatalogFilters } from "#/features/search/catalog-filters";
import { colorLabel } from "#/i18n/color-label";
import { useLocale } from "#/i18n/locale";
import { sizeLabel } from "#/i18n/size-label";
import { useTranslation } from "#/i18n/translate";
import { FacetFilter } from "./facet-filter";
import { PriceFilter } from "./price-filter";

export function CatalogFilterControls({
	filters,
	facets,
	showSale,
	onChange,
}: {
	filters: CatalogFilters;
	facets: CatalogFacets;
	showSale: boolean;
	onChange: (patch: Partial<CatalogFilters>) => void;
}) {
	const t = useTranslation();
	const locale = useLocale();
	return (
		<>
			<FacetFilter
				label={t("Brand")}
				options={facets.brands}
				selected={filters.brands}
				onChange={(brands) => onChange({ brands })}
			/>
			<FacetFilter
				label={t("Size")}
				layout="chips"
				getOptionLabel={(value) => sizeLabel(value, locale)}
				options={facets.sizes}
				selected={filters.sizes}
				onChange={(sizes) => onChange({ sizes })}
			/>
			<FacetFilter
				label={t("Color")}
				layout="chips"
				getOptionLabel={(value) => colorLabel(value, locale)}
				options={facets.colors}
				selected={filters.colors}
				onChange={(colors) => onChange({ colors })}
			/>
			<PriceFilter
				range={facets.price}
				minPrice={filters.minPrice}
				maxPrice={filters.maxPrice}
				onChange={onChange}
			/>
			{showSale && (
				<Toggle
					variant="outline"
					size="sm"
					className="h-10 px-4"
					pressed={filters.sale}
					onPressedChange={(sale) => onChange({ sale })}
				>
					{t("On sale")}
				</Toggle>
			)}
		</>
	);
}
