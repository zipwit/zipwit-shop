import { useHydrated } from "@tanstack/react-router";

/** Reads the email saved by the preceding auth view. Returns an empty string when storage is unavailable. */
export function useStoredEmail(key: string) {
	const hydrated = useHydrated();
	if (!hydrated) return "";
	try {
		return sessionStorage.getItem(key) ?? "";
	} catch {
		return "";
	}
}
