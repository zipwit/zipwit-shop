import { describe, expect, it } from "vitest";
import { sizeLabel } from "#/i18n/size-label";

describe("size labels", () => {
	it.each(["one-size", "one size", "OneSize", "OS", "O/S"])(
		"localizes the universal %s size without changing its value",
		(value) => {
			expect(sizeLabel(value, "ka")).toBe("უნივერსალური ზომა");
			expect(sizeLabel(value, "en")).toBe("One size");
		},
	);
	it("keeps normal size labels readable", () => {
		expect(sizeLabel("xl", "ka")).toBe("XL");
		expect(sizeLabel("42", "en")).toBe("42");
	});
});
