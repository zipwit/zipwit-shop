import { defaultAuthLocale, viewPaths } from "@better-auth-ui/core";
import { describe, expect, it } from "vitest";
import { authViewTitle } from "#/features/auth/auth-view-title";
import { georgianAuthLocale } from "#/i18n/auth-ka";

describe("auth page titles", () => {
	it.each(["ka", "en"] as const)(
		"uses the matching form title for %s",
		(locale) => {
			const { auth } = (
				locale === "ka" ? georgianAuthLocale : defaultAuthLocale
			).localization;
			expect(authViewTitle(viewPaths.auth.signUp, locale)).toBe(auth.signUp);
			expect(authViewTitle(viewPaths.auth.signIn, locale)).toBe(auth.signIn);
			expect(authViewTitle(viewPaths.auth.resetPassword, locale)).toBe(
				auth.resetPassword,
			);
			expect(authViewTitle(viewPaths.auth.verifyEmail, locale)).toBe(
				auth.verifyEmail,
			);
			expect(authViewTitle(viewPaths.auth.signUp, locale)).not.toBe(
				auth.signIn,
			);
		},
	);
});
