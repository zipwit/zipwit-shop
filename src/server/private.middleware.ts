import { createMiddleware } from "@tanstack/react-start";
import { getCookie, setResponseHeader } from "@tanstack/react-start/server";
import { LOCALE_COOKIE_NAME, resolveLocale } from "#/i18n/locale-config";
import { translate } from "#/i18n/translate";
import { PublicError } from "./public-error";

/**
 * Prevents caching private responses and logs metadata for unexpected errors.
 * Raw database and HTTP errors can contain customer data or credentials.
 */
export const privateRequest = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		setResponseHeader("Cache-Control", "private, no-store");
		try {
			return await next();
		} catch (error) {
			const known = error instanceof PublicError;
			if (!known) {
				const reference = crypto.randomUUID();
				setResponseHeader("X-Request-Id", reference);
				const code =
					error && typeof error === "object" && "code" in error
						? error.code
						: undefined;
				console.error("Private request failed", {
					reference,
					name: error instanceof Error ? error.name : typeof error,
					code:
						typeof code === "string" && /^[A-Z0-9_]{2,32}$/.test(code)
							? code
							: "UNKNOWN",
				});
			}
			throw new Error(
				translate(
					known ? error.message : "Something went wrong. Please try again.",
					known ? error.values : {},
					resolveLocale(getCookie(LOCALE_COOKIE_NAME)),
				),
			);
		}
	},
);
