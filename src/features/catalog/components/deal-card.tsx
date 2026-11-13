import type { Deal } from "#/data/catalog.types";
import { CatalogCard } from "./catalog-card";
import { SkewTag } from "./skew-tag";

/** Prioritize the visible row; defer images farther down the catalog. */
export const dealImageLoading = (index: number) =>
	index < 4 ? "eager" : "lazy";

export function DealCard({
	deal,
	loading,
	className,
}: {
	deal: Deal;
	loading?: "lazy" | "eager";
	className?: string;
}) {
	return (
		<CatalogCard
			product={deal}
			loading={loading}
			className={className}
			badge={
				<SkewTag className="type-num text-xs font-bold">
					−{deal.discount}%
				</SkewTag>
			}
		/>
	);
}
