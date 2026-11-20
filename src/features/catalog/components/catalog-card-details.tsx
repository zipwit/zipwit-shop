import { Link } from "@tanstack/react-router";
import type { ProductListItem } from "#/data/catalog.types";
import { StoreLabel } from "#/features/stores/store-label";
import { useTranslation } from "#/i18n/translate";
import { isOnSale, usePriceFormatter } from "#/lib/price";
import { cn } from "#/lib/utils";

/** Listing and deal cards share their accessible link and pricing details. */
export function CatalogCardDetails({ product }: { product: ProductListItem }) {
	const t = useTranslation();
	const { formatPriceCompact } = usePriceFormatter();
	const { slug, name, brand, price, originalPrice, currency, storeId } =
		product;
	const onSale = isOnSale(price, originalPrice);
	return (
		<>
			{brand && (
				<p className="type-eyebrow wrap-anywhere text-muted-foreground">
					{brand}
				</p>
			)}

			<h3 className="type-card-title line-clamp-2 min-h-[2.8em] text-sm sm:text-base">
				<Link
					to="/product/$slug"
					params={{ slug }}
					search={product.skuId ? { sku: product.skuId } : undefined}
					className="after:absolute after:inset-0 after:rounded-[1.125rem] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand"
				>
					{name}
				</Link>
			</h3>
			<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-auto pt-2">
				{!product.skuId && (
					<span className="text-xs text-muted-foreground">{t("From")}</span>
				)}
				<span
					className={cn(
						"type-num text-lg font-bold sm:text-xl",
						onSale ? "text-price" : "text-foreground",
					)}
				>
					{formatPriceCompact(price, currency)}
				</span>
				{onSale && (
					<span className="text-sm text-price-original line-through">
						{formatPriceCompact(originalPrice, currency)}
					</span>
				)}
			</p>
			<p className="catalog-card-store">
				<StoreLabel storeId={storeId} />
			</p>
		</>
	);
}
