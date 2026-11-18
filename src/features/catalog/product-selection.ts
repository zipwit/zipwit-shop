import { minBy, uniq } from "es-toolkit";

export type SelectableSku = {
	id: string;
	color: string;
	size: string;
	imageUrl: string | null;
	price: number;
	originalPrice: number | null;
	inStock: boolean;
};

type SkuChoice = { color?: string; sku?: string };

/**
 * Derives the product view from the SKU list and URL selection.
 * Without a valid selected SKU, the view shows the cheapest available SKU in
 * the chosen color, falling back to its first SKU when none are in stock.
 */
export function resolveSkuSelection<T extends SelectableSku>(
	skus: readonly T[],
	choice: SkuChoice,
) {
	const colors = uniq(skus.map((sku) => sku.color));
	const requested = skus.find((sku) => sku.id === choice.sku && sku.inStock);
	const color = colors.includes(choice.color ?? "")
		? choice.color
		: (requested?.color ?? skus.find((sku) => sku.inStock)?.color ?? colors[0]);

	const colorSkus = skus.filter((sku) => sku.color === color);
	const selectedSku = requested?.color === color ? requested : undefined;

	const displaySku =
		selectedSku ??
		minBy(
			colorSkus.filter((sku) => sku.inStock),
			(sku) => sku.price,
		) ??
		colorSkus[0];

	return {
		colors,
		color,
		colorSkus,
		selectedSku,
		displaySku,
		imageUrl:
			selectedSku?.imageUrl ??
			colorSkus.find((sku) => sku.imageUrl)?.imageUrl ??
			null,
	};
}

export type SkuSelection<T extends SelectableSku> = ReturnType<
	typeof resolveSkuSelection<T>
>;
