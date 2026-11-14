import { getCookie } from "@tanstack/react-start/server";
import {
	DEFAULT_LOCALE,
	LOCALE_COOKIE_NAME,
	resolveLocale,
} from "#/i18n/locale-config";

export function requestLocale() {
	try {
		return resolveLocale(getCookie(LOCALE_COOKIE_NAME));
	} catch {
		return DEFAULT_LOCALE;
	}
}
