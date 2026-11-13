import { enUS, ka } from "date-fns/locale";
import { createContext, useContext } from "react";

import { DEFAULT_LOCALE, type Locale } from "./locale-config";

export { DEFAULT_LOCALE, type Locale, languageTags } from "./locale-config";
export const dateLocales = { ka, en: enUS };
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
export const LocaleProvider = LocaleContext.Provider;
export const useLocale = () => useContext(LocaleContext);
