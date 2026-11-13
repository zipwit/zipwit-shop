import { Badge } from "#/components/ui/badge";
import type { ProductListItem } from "#/data/catalog.types";
import { useTranslation } from "#/i18n/translate";
import { isOnSale } from "#/lib/price";
import { CatalogCard } from "./catalog-card";

export function ProductCard({
	product,
	loading,
}: {
	product: ProductListItem;
	loading?: "lazy" | "eager";
}) {
	const t = useTranslation();
	return (
		<CatalogCard
			product={product}
			loading={loading}
			badge={
				isOnSale(product.price, product.originalPrice) ? (
					<Badge className="bg-brand/90 text-brand-foreground text-xs font-bold">
						{t("Sale")}
					</Badge>
				) : undefined
			}
		/>
	);
}
