import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { ProductListItem } from "#/data/catalog.types";
import { cn } from "#/lib/utils";
import { CatalogCardDetails } from "./catalog-card-details";
import { ProductImage } from "./product-image";

/** One keyboard stop per product, with a shared media frame and content rhythm. */
export function CatalogCard({
	product,
	loading,
	badge,
	className,
}: {
	product: ProductListItem;
	loading?: "lazy" | "eager";
	badge?: ReactNode;
	className?: string;
}) {
	return (
		<motion.article
			whileHover={{ y: -4 }}
			whileTap={{ scale: 0.99 }}
			className={cn(
				"product-tile group relative flex h-full min-w-0 flex-col gap-4 p-2.5 pb-4 sm:p-3 sm:pb-5",
				className,
			)}
		>
			<div className="catalog-card-media relative overflow-hidden">
				<ProductImage
					src={product.imageUrl}
					alt=""
					loading={loading}
					className="aspect-4/5 w-full"
				/>
				{badge && <div className="absolute top-3 left-3">{badge}</div>}
			</div>
			<div className="flex flex-1 flex-col gap-2 px-1.5 sm:px-2">
				<CatalogCardDetails product={product} />
			</div>
		</motion.article>
	);
}
