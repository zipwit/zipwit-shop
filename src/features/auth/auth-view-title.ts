import { defaultAuthLocale, viewPaths } from "@better-auth-ui/core";
import { georgianAuthLocale } from "#/i18n/auth-ka";
import type { Locale } from "#/i18n/locale-config";

/** Page metadata uses the same localized labels as the corresponding auth view. */
export function authViewTitle(path: string, locale: Locale) {
	const { auth } = (locale === "ka" ? georgianAuthLocale : defaultAuthLocale)
		.localization;
	return (
		new Map([
			[viewPaths.auth.signIn, auth.signIn],
			[viewPaths.auth.signUp, auth.signUp],
			[viewPaths.auth.signOut, auth.signOut],
			[viewPaths.auth.forgotPassword, auth.forgotPassword],
			[viewPaths.auth.resetPassword, auth.resetPassword],
			[viewPaths.auth.resetLinkSent, auth.checkYourEmailTitle],
			[viewPaths.auth.verifyEmail, auth.verifyEmail],
			[viewPaths.auth.error, auth.callbackGenericErrorTitle],
		]).get(path) ?? auth.account
	);
}
