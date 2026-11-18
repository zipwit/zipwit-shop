import { expect, it } from "vitest";
import { safeAuthReturnTo } from "#/features/auth/auth-return-to";

it("preserves a resumable checkout destination", () => {
	const destination = "/checkout?checkout=00000000-0000-4000-8000-000000000001";
	expect(safeAuthReturnTo(destination)).toBe(destination);
});

it.each([
	undefined,
	"//outside.test",
	"/.//outside.test",
	"/\\outside.test",
	"https://outside.test",
	"javascript:alert(1)",
])("falls back to the storefront for %s", (destination) =>
	expect(safeAuthReturnTo(destination)).toBe("/"),
);
