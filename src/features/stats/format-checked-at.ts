import { site } from "#/data/site";
import { formatStoreDate, formatStoreTime } from "#/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "#/i18n/locale";
import { translate } from "#/i18n/translate";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	timeZone: site.timezone,
});

/** `"08:00"`, in the store's own time zone, from an ISO timestamp. */
export const formatCheckedAt = formatStoreTime;

/** Absolute dates by default keep SSR stable across midnight; relative dates require a shared clock. */
export function priceCheckNote(
	checkedAt: string | null,
	now: Date | undefined = undefined,
	locale: Locale = DEFAULT_LOCALE,
) {
	if (!checkedAt) {
		return translate(
			"Price-check history will appear with the first update.",
			{},
			locale,
		);
	}
	const at = new Date(checkedAt);
	const time = formatCheckedAt(checkedAt);
	if (now && dayKeyFormat.format(at) === dayKeyFormat.format(now)) {
		return translate(
			"Prices last checked today at {{time}}.",
			{ time },
			locale,
		);
	}
	const date = formatStoreDate(checkedAt, locale);
	return translate(
		"Prices last checked on {{date}} at {{time}}.",
		{ date, time },
		locale,
	);
}
