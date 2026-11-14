import { createServerFn } from "@tanstack/react-start";
import {
	getCookie,
	setCookie,
	setResponseHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { LOCALE_COOKIE_NAME, locales, resolveLocale } from "./locale-config";

const localeSchema = z.enum(locales);

export const getLocaleFn = createServerFn({ method: "GET" }).handler(() => {
	setResponseHeader("Cache-Control", "private, no-store");
	return resolveLocale(getCookie(LOCALE_COOKIE_NAME));
});

export const setLocaleFn = createServerFn({ method: "POST" })
	.validator(localeSchema)
	.handler(({ data }) => {
		setCookie(LOCALE_COOKIE_NAME, data, {
			path: "/",
			maxAge: 60 * 60 * 24 * 365,
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		});
		return data;
	});
