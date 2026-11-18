import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "#/components/ui/button";
import {
	type CatalogFilters,
	DEFAULT_FILTERS,
	type UpdateCatalogFilters,
} from "#/features/search/catalog-filters";
import { colorLabel } from "#/i18n/color-label";
import { type Locale, useLocale } from "#/i18n/locale";
import { sizeLabel } from "#/i18n/size-label";
import { useTranslation } from "#/i18n/translate";
import { usePriceFormatter } from "#/lib/price";

type Chip = {
	key: string;
	label: string;
	clear: (current: CatalogFilters) => Partial<CatalogFilters>;
};

function priceLabel(
	{ minPrice, maxPrice }: CatalogFilters,
	t: ReturnType<typeof useTranslation>,
	formatPriceCompact: ReturnType<
		typeof usePriceFormatter
	>["formatPriceCompact"],
) {
	if (minPrice != null && maxPrice != null) {
		return t("{{min}} to {{max}}", {
			min: formatPriceCompact(minPrice),
			max: formatPriceCompact(maxPrice),
		});
	}
	return minPrice != null
		? t("From {{price}}", { price: formatPriceCompact(minPrice) })
		: t("Up to {{price}}", { price: formatPriceCompact(maxPrice ?? 0) });
}

function chipsFor(
	filters: CatalogFilters,
	showSale: boolean,
	t: ReturnType<typeof useTranslation>,
	formatPriceCompact: ReturnType<
		typeof usePriceFormatter
	>["formatPriceCompact"],
	locale: Locale,
): Chip[] {
	const chips: Chip[] = [];

	if (filters.q) {
		chips.push({
			key: "q",
			label: `“${filters.q}”`,
			clear: () => ({ q: undefined }),
		});
	}
	for (const brand of filters.brands) {
		chips.push({
			key: `brand:${brand}`,
			label: brand,
			clear: (current) => ({
				brands: current.brands.filter((value) => value !== brand),
			}),
		});
	}
	for (const size of filters.sizes) {
		chips.push({
			key: `size:${size}`,
			label: t("Size {{size}}", { size: sizeLabel(size, locale) }),
			clear: (current) => ({
				sizes: current.sizes.filter((value) => value !== size),
			}),
		});
	}
	for (const color of filters.colors) {
		chips.push({
			key: `color:${color}`,
			label: colorLabel(color, locale),
			clear: (current) => ({
				colors: current.colors.filter((value) => value !== color),
			}),
		});
	}
	if (filters.minPrice != null || filters.maxPrice != null) {
		chips.push({
			key: "price",
			label: priceLabel(filters, t, formatPriceCompact),
			clear: () => ({ minPrice: undefined, maxPrice: undefined }),
		});
	}
	if (showSale && filters.sale) {
		chips.push({
			key: "sale",
			label: t("On sale"),
			clear: () => ({ sale: false }),
		});
	}

	return chips;
}

type ActiveFiltersProps = {
	filters: CatalogFilters;
	/** The deals view is always on sale, so it has no sale chip. */
	showSale: boolean;
	onChange: (update: UpdateCatalogFilters) => void;
};

/** What is narrowing the results right now, each removable with one click. */
export function ActiveFilters({
	filters,
	showSale,
	onChange,
}: ActiveFiltersProps) {
	const t = useTranslation();
	const locale = useLocale();
	const { formatPriceCompact } = usePriceFormatter();
	const chips = chipsFor(filters, showSale, t, formatPriceCompact, locale);
	if (chips.length === 0) return null;

	return (
		<ul
			className="flex flex-wrap items-center gap-2"
			aria-label={t("Active filters")}
		>
			{chips.map((chip) => (
				<li key={chip.key}>
					<Button
						variant="secondary"
						size="xs"
						aria-label={t("Remove filter: {{label}}", { label: chip.label })}
						onClick={() =>
							onChange((current) => ({ ...current, ...chip.clear(current) }))
						}
					>
						{chip.label}
						<HugeiconsIcon icon={Cancel01Icon} size={12} />
					</Button>
				</li>
			))}
			<li>
				<Button
					variant="ghost"
					size="xs"
					onClick={() =>
						onChange((current) => ({ ...DEFAULT_FILTERS, sort: current.sort }))
					}
				>
					{t("Clear all")}
				</Button>
			</li>
		</ul>
	);
}
