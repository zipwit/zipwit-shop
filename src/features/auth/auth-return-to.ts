import { getSafeRedirectTo } from "@better-auth-ui/core";
import { createContext, useContext } from "react";

export const AuthReturnTo = createContext("/");
export const useAuthReturnTo = () => useContext(AuthReturnTo);

/** Normalizes a return path against the same origin on the server and in the browser. */
export function safeAuthReturnTo(value: unknown) {
	if (
		typeof value !== "string" ||
		value.length > 2048 ||
		!value.startsWith("/")
	)
		return "/";
	const destination = getSafeRedirectTo(value, "https://storefront.invalid");
	return destination.startsWith("//") ? "/" : destination;
}
