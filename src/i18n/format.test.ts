import { describe, expect, it, vi } from "vitest";
import { formatCount, formatStoreDateTime, formatStoreTime } from "./format";

describe("SSR-safe storefront formatting", () => {
	it("uses Georgian month names with the store timezone across a year boundary", () => {
		expect(formatStoreDateTime("2026-12-31T21:05:00Z", "ka")).toBe(
			"1 იან 2027, 01:05",
		);
		expect(formatStoreDateTime("2026-12-31T21:05:00Z", "en")).toBe(
			"1 Jan 2027, 01:05",
		);
		expect(formatStoreTime("2026-11-13T20:00:00Z")).toBe("00:00");
	});
	it("does not depend on the system clock when rendering a persisted date", () => {
		const clock = vi.spyOn(Date, "now");
		clock.mockReturnValue(0);
		const first = formatStoreDateTime("2026-11-13T19:56:00Z", "ka");
		clock.mockReturnValue(9_000_000_000_000);
		expect(formatStoreDateTime("2026-11-13T19:56:00Z", "ka")).toBe(first);
		clock.mockRestore();
	});
	it("owns grouping separators in both languages", () => {
		expect(formatCount(12345, "ka")).toBe("12\u00a0345");
		expect(formatCount(12345, "en")).toBe("12,345");
		expect(formatCount(0, "ka")).toBe("0");
	});
});
