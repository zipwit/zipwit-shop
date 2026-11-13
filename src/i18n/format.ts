import { site } from "#/data/site";
import { DEFAULT_LOCALE, type Locale } from "./locale-config";

const months = {
	ka: [
		"იან",
		"თებ",
		"მარ",
		"აპრ",
		"მაი",
		"ივნ",
		"ივლ",
		"აგვ",
		"სექ",
		"ოქტ",
		"ნოე",
		"დეკ",
	],
	en: [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	],
};
const dateFormat = new Intl.DateTimeFormat("en-US", {
	timeZone: site.timezone,
	calendar: "gregory",
	numberingSystem: "latn",
	year: "numeric",
	month: "numeric",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});
function dateParts(iso: string) {
	const parts = dateFormat.formatToParts(new Date(iso));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? "";
	return {
		day: part("day"),
		month: Number(part("month")),
		year: part("year"),
		time: `${part("hour")}:${part("minute")}`,
	};
}

/** Own the translated layout; browser ICU support must not change SSR text. */
export function formatStoreDate(
	iso: string,
	locale: Locale = DEFAULT_LOCALE,
	includeYear = false,
) {
	const { day, month, year } = dateParts(iso);
	return `${day} ${months[locale][month - 1]}${includeYear ? ` ${year}` : ""}`;
}
export const formatStoreTime = (iso: string) => dateParts(iso).time;
export const formatStoreDateTime = (
	iso: string,
	locale: Locale = DEFAULT_LOCALE,
) => `${formatStoreDate(iso, locale, true)}, ${formatStoreTime(iso)}`;

const countFormat = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 0,
	numberingSystem: "latn",
});
export function formatCount(value: number, locale: Locale = DEFAULT_LOCALE) {
	return countFormat
		.format(value)
		.replaceAll(",", locale === "ka" ? "\u00a0" : ",");
}
