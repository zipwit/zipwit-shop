import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS } from "#/features/search/catalog-filters";
import { translate } from "#/i18n/translate";
import { FilterBar } from "./filter-bar";

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
});
