import type { Locale } from "./locale-config";

const colorsKa: Readonly<Record<string, string>> = {
	black: "შავი",
	white: "თეთრი",
	blue: "ლურჯი",
	navy: "მუქი ლურჯი",
	green: "მწვანე",
	red: "წითელი",
	yellow: "ყვითელი",
	pink: "ვარდისფერი",
	purple: "იისფერი",
	orange: "ნარინჯისფერი",
	brown: "ყავისფერი",
	beige: "ბეჟი",
	gray: "ნაცრისფერი",
	grey: "ნაცრისფერი",
	silver: "ვერცხლისფერი",
	gold: "ოქროსფერი",
	cream: "კრემისფერი",
	ivory: "სპილოსძვლისფერი",
	multicolor: "მრავალფერი",
	olive: "ზეთისხილისფერი",
	burgundy: "ბორდოსფერი",
	charcoal: "მუქი ნაცრისფერი",
	lavender: "ლავანდისფერი",
	teal: "მომწვანო ლურჯი",
	tan: "ღია ყავისფერი",
};

/** Localize known color labels without changing the supplier's underlying value. */
export function colorLabel(value: string | undefined, locale: Locale) {
	if (!value) return "";
	const normalized = value.trim().toLowerCase();
	const georgian = colorsKa[normalized];
	if (!georgian) return value;
	return locale === "ka"
		? georgian
		: normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
