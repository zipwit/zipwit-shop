import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { CatalogResults } from "#/features/catalog/components/catalog-results";
import { LocaleProvider } from "#/i18n/locale";

function emptyResults(filtered: boolean, showEmpty: boolean) {
	return renderToStaticMarkup(
		<LocaleProvider value="en">
			<CatalogResults
				items={[]}
				mode="listing"
				filtered={filtered}
				showEmpty={showEmpty}
				empty={<p>Empty store</p>}
				onClear={vi.fn()}
			/>
		</LocaleProvider>,
	);
}

it("waits for settled results before offering to clear filters", () => {
	expect(emptyResults(true, false)).toBe("");
	expect(emptyResults(true, true)).toContain("Clear filters");
});

it("reserves the store's custom empty message for an unfiltered listing", () => {
	expect(emptyResults(false, true)).toContain("Empty store");
	expect(emptyResults(true, true)).not.toContain("Empty store");
});
