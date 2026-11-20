import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { type CatalogItem, isDeal } from "#/data/catalog.types";
import type { CatalogScope } from "#/features/search/catalog-filters";
import { useTranslation } from "#/i18n/translate";
import { DealCard } from "./deal-card";
import { ProductCard } from "./product-card";
import { ProductGrid } from "./product-grid";

export function CatalogResults({
	items,
	mode,
	showEmpty,
	filtered,
	empty,
	onClear,
}: {
	items: CatalogItem[];
	mode: CatalogScope["mode"];
	showEmpty: boolean;
	filtered: boolean;
	empty?: ReactNode;
	onClear: () => void;
}) {
	const t = useTranslation();
	if (items.length) {
		if (mode === "deals") {
			return (
				<ProductGrid
					products={items.filter(isDeal)}
					renderCard={(deal, loading) => (
						<DealCard deal={deal} loading={loading} />
					)}
				/>
			);
		}
		return (
			<ProductGrid
				products={items}
				renderCard={(product, loading) => (
					<ProductCard product={product} loading={loading} />
				)}
			/>
		);
	}
	if (!showEmpty) return null;
	if (!filtered && empty != null) return empty;
	return (
		<Empty className="my-8 border">
			<EmptyHeader>
				<EmptyTitle>
					{filtered
						? t("Nothing matches these filters.")
						: t("No products yet.")}
				</EmptyTitle>
				<EmptyDescription>
					{filtered
						? t("Try a shorter search or remove a filter.")
						: t("Check back after the next price refresh.")}
				</EmptyDescription>
			</EmptyHeader>
			{filtered && (
				<EmptyContent>
					<Button variant="outline" onClick={onClear}>
						{t("Clear filters")}
					</Button>
				</EmptyContent>
			)}
		</Empty>
	);
}
