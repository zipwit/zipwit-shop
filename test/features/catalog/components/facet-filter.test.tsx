import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { FacetFilter } from "#/features/catalog/components/facet-filter";

vi.mock("#/features/catalog/components/filter-popover", () => ({
	FilterPopover: ({ children }: { children: ReactNode }) => children,
}));

it.each(["list", "chips"] as const)(
	"reconciles URL selections with available %s choices",
	(layout) => {
		const html = renderToStaticMarkup(
			<FacetFilter
				label="Color"
				layout={layout}
				options={[{ value: "Navy", count: 3 }]}
				selected={["NAVY", "Olive"]}
				onChange={vi.fn()}
			/>,
		);
		expect(html).toContain(">Navy<");
		expect(html).not.toContain(">NAVY<");
		expect(html).toContain(">Olive<");
		const selected =
			layout === "list" ? /aria-checked="true"/g : /aria-pressed="true"/g;
		expect(html.match(selected)).toHaveLength(2);
	},
);
