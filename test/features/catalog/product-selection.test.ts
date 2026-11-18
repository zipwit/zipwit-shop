import { describe, expect, it } from "vitest";
import {
	resolveSkuSelection,
	type SelectableSku,
} from "#/features/catalog/product-selection";

const sku = (overrides: Partial<SelectableSku>): SelectableSku => ({
	id: "id",
	color: "black",
	size: "40",
	imageUrl: null,
	price: 100,
	originalPrice: null,
	inStock: true,
	...overrides,
});

const skus = [
	sku({ id: "b40", color: "black", size: "40", price: 120 }),
	sku({ id: "b41", color: "black", size: "41", price: 100 }),
	sku({ id: "b42", color: "black", size: "42", inStock: false }),
	sku({ id: "w40", color: "white", size: "40", imageUrl: "/white.webp" }),
];

describe("resolveSkuSelection", () => {
	it("defaults to the first color with stock and its cheapest SKU", () => {
		const selection = resolveSkuSelection(skus, {});
		expect(selection.color).toBe("black");
		expect(selection.selectedSku).toBeUndefined();
		expect(selection.displaySku?.id).toBe("b41");
	});

	it("honours a valid color and size", () => {
		const selection = resolveSkuSelection(skus, { color: "white", sku: "w40" });
		expect(selection.color).toBe("white");
		expect(selection.selectedSku?.id).toBe("w40");
		expect(selection.imageUrl).toBe("/white.webp");
	});

	it("opens the color, size and image named by a listing SKU", () => {
		const matching = sku({
			id: "w41",
			color: "white",
			size: "41",
			imageUrl: "/white-41.webp",
		});
		const selection = resolveSkuSelection([...skus, matching], {
			sku: matching.id,
		});
		expect(selection.color).toBe("white");
		expect(selection.selectedSku).toBe(matching);
		expect(selection.imageUrl).toBe("/white-41.webp");
	});

	it("falls back when the URL names an unknown color", () => {
		expect(resolveSkuSelection(skus, { color: "pink" }).color).toBe("black");
	});

	it("ignores sold-out and cross-color SKUs", () => {
		expect(
			resolveSkuSelection(skus, { sku: "b42" }).selectedSku,
		).toBeUndefined();
		expect(
			resolveSkuSelection(skus, { color: "white", sku: "b40" }).selectedSku,
		).toBeUndefined();
	});

	it("handles a product with no SKUs", () => {
		const selection = resolveSkuSelection([], {});
		expect(selection.displaySku).toBeUndefined();
		expect(selection.colors).toEqual([]);
	});
});
