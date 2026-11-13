export const locales = ["ka", "en"] as const;
export type Locale = (typeof locales)[number];
export const DEFAULT_LOCALE: Locale = "ka";
export const LOCALE_COOKIE_NAME = "zipwit-locale";
export const languageTags = { ka: "ka-GE", en: "en-US" } as const;

export const resolveLocale = (value: string | undefined): Locale =>
	value === "en" ? "en" : DEFAULT_LOCALE;
