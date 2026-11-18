import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "#/components/ui/slider";
import { FilterBar } from "#/features/catalog/components/filter-bar";
import { DEFAULT_FILTERS } from "#/features/search/catalog-filters";
import { translate } from "#/i18n/translate";

describe("catalog filter bar", () => {
	it("renders one sort control and one result announcement for both responsive layouts", () => {
		const html = renderToStaticMarkup(
			<FilterBar
				scope={{ mode: "deals" }}
				filters={DEFAULT_FILTERS}
				facets={{ brands: [], colors: [], sizes: [], price: null }}
				total={12}
				onChange={vi.fn()}
			/>,
		);
		expect(
			html.match(new RegExp(`aria-label="${translate("Sort by")}"`, "g")),
		).toHaveLength(1);
		expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
	});

	it("keeps search, sorting and clearing available when facet loading fails", () => {
		const html = renderToStaticMarkup(
			<FilterBar
				scope={{ mode: "listing" }}
				filters={{ ...DEFAULT_FILTERS, colors: ["black"] }}
				onRetryFacets={vi.fn()}
				onChange={vi.fn()}
			/>,
		);
		for (const label of [
			"Search products",
			"Sort by",
			"Clear all",
			"Couldn't load filters.",
		]) {
			expect(html).toContain(translate(label));
		}
	});

	it("renders individually named price thumbs and their values on the server", () => {
		const html = renderToStaticMarkup(
			<Slider
				value={[10, 50]}
				getAriaLabel={(index) =>
					index === 0 ? "Minimum price" : "Maximum price"
				}
				getAriaValueText={(_, value) => `GEL ${value}`}
			/>,
		);
		const inputs = html.match(/<input[^>]*>/g) ?? [];
		expect(inputs).toHaveLength(2);
		expect(inputs[0]).toContain('aria-label="Minimum price"');
		expect(inputs[0]).toContain('aria-valuetext="GEL 10"');
		expect(inputs[1]).toContain('aria-label="Maximum price"');
		expect(inputs[1]).toContain('aria-valuetext="GEL 50"');
	});
});
