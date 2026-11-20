import type { ReactNode } from "react";
import type { ProductListItem } from "#/data/catalog.types";
import { catalogImageLoading } from "./product-image";

/** Shares grid spacing and image priority between product and deal cards. */
export function ProductGrid<T extends ProductListItem>({
	products,
	renderCard,
}: {
	products: T[];
	renderCard: (product: T, loading: "eager" | "lazy") => ReactNode;
}) {
	return (
		<ul className="grid grid-cols-2 gap-x-4 gap-y-10 py-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
			{products.map((product, index) => (
				<li key={product.id} className="min-w-0">
					{renderCard(product, catalogImageLoading(index))}
				</li>
			))}
		</ul>
	);
}
