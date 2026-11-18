import { Link } from "@tanstack/react-router";
import { Container } from "#/components/layout/container";
import { Badge } from "#/components/ui/badge";
import { AddToCartButton } from "#/features/cart/components/add-to-cart-button";
import type { ProductDetail } from "#/features/catalog/product.functions";
import type { SkuSelection } from "#/features/catalog/product-selection";
import { StoreLabel } from "#/features/stores/store-label";
import { colorLabel } from "#/i18n/color-label";
import { useLocale } from "#/i18n/locale";
import { useTranslation } from "#/i18n/translate";
import { isOnSale } from "#/lib/price";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { ProductVariantPicker } from "./product-variant-picker";

type ProductSku = ProductDetail["skus"][number];

type ProductDetailsProps = {
	product: ProductDetail;
	selection: SkuSelection<ProductSku>;
	onColorChange: (color: string) => void;
	onSkuChange: (skuId: string | undefined) => void;
};

/** Presentational product page; selection state lives in the URL (see the route). */
export function ProductDetails({
	product,
	selection,
	onColorChange,
	onSkuChange,
}: ProductDetailsProps) {
	const t = useTranslation();
	const locale = useLocale();
	const { color, selectedSku, displaySku, imageUrl } = selection;

	return (
		<Container className="grid items-start gap-8 py-8 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:py-12 lg:gap-20 lg:py-16">
			<ProductImage
				src={imageUrl}
				alt={[product.name, colorLabel(color, locale)]
					.filter(Boolean)
					.join(", ")}
				fetchPriority="high"
				className="aspect-4/5 rounded-xl md:sticky md:top-32"
			/>

			<div className="flex min-w-0 max-w-xl flex-col gap-7 md:py-4 lg:gap-8">
				<ProductHeading
					product={product}
					selectedSku={selectedSku}
					displaySku={displaySku}
				/>

				{displaySku ? (
					<>
						<ProductVariantPicker
							selection={selection}
							onColorChange={onColorChange}
							onSkuChange={onSkuChange}
						/>
						<ProductPurchase
							purchasable={product.purchasable}
							selectedSku={selectedSku}
						/>
					</>
				) : (
					<p className="text-muted-foreground">
						{t("This product is currently unavailable.")}
					</p>
				)}

				{product.description && (
					<p className="type-body max-w-prose border-t pt-8 text-sm text-muted-foreground">
						{product.description}
					</p>
				)}
			</div>
		</Container>
	);
}

function ProductHeading({
	product,
	selectedSku,
	displaySku,
}: {
	product: ProductDetail;
	selectedSku: ProductSku | undefined;
	displaySku: ProductSku | undefined;
}) {
	const t = useTranslation();
	return (
		<div>
			{product.brand && (
				<p className="type-eyebrow mb-3 text-muted-foreground">
					{product.brand}
				</p>
			)}
			<h1 className="type-title text-3xl lg:text-4xl">{product.name}</h1>
			<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				<p className="text-muted-foreground">
					<StoreLabel storeId={product.storeId} />
				</p>
				<Link
					to="/stores/$storeId"
					params={{ storeId: product.storeId }}
					className="text-link underline underline-offset-4"
				>
					<span>{t("Shop more from this store")}</span>
				</Link>
			</div>
			{displaySku && (
				<p className="mt-5 flex flex-wrap items-center gap-3">
					<span className="type-num text-2xl">
						{!selectedSku && (
							<span className="font-normal text-base text-muted-foreground">
								{t("From ")}
							</span>
						)}
						<Price
							price={displaySku.price}
							originalPrice={displaySku.originalPrice}
							currency={product.currency}
						/>
					</span>
					{isOnSale(displaySku.price, displaySku.originalPrice) && (
						<Badge>{t("Sale")}</Badge>
					)}
				</p>
			)}
		</div>
	);
}

function ProductPurchase({
	purchasable,
	selectedSku,
}: {
	purchasable: boolean;
	selectedSku: ProductSku | undefined;
}) {
	const t = useTranslation();
	return (
		<div>
			{purchasable ? (
				<AddToCartButton sku={selectedSku?.id} />
			) : (
				<p className="rounded-lg bg-muted p-3 text-sm">
					{t("This product is available to browse. Ordering is not open yet.")}
				</p>
			)}
			<div className="type-caption mt-3 space-y-1 text-muted-foreground">
				<p className="text-foreground">
					{!purchasable
						? t("Availability reflects the latest supplier check.")
						: selectedSku
							? t("In stock and ready to order.")
							: t("Select a size to check availability.")}
				</p>
				<p>
					{t("Shipping varies by warehouse and is calculated at checkout.")}
				</p>
			</div>
		</div>
	);
}
