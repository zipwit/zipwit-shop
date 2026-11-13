import { describe, expect, it } from "vitest";
import { colorLabel } from "./color-label";

describe("color labels", () => {
	it.each(["black", "white", "navy", "red", "grey", "green"])(
		"translates the canonical %s color in Georgian",
		(value) => {
			expect(colorLabel(value, "ka")).toMatch(/[ა-ჰ]/);
		},
	);
	it("normalizes known labels while preserving unfamiliar supplier color names", () => {
		expect(colorLabel("BLACK", "ka")).toBe("შავი");
		expect(colorLabel("black", "en")).toBe("Black");
		expect(colorLabel("grey", "ka")).toBe(colorLabel("gray", "ka"));
		for (const locale of ["ka", "en"] as const) {
			expect(colorLabel("Supplier 04 / Mix", locale)).toBe("Supplier 04 / Mix");
		}
		expect(colorLabel(undefined, "ka")).toBe("");
	});
});
