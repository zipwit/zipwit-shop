import type { AdditionalFieldFormValue } from "@better-auth-ui/core";
export function valueToString(value: AdditionalFieldFormValue) {
	if (value == null) return "";
	return value instanceof Date ? value.toISOString() : String(value);
}

/** Convert a `defaultValue` into a `Date` for the calendar. */
export function toDate(value: unknown): Date | undefined {
	if (value instanceof Date) return value;
	if (typeof value === "string") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	return undefined;
}
