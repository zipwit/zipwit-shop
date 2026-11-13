import type { Locale } from "./locale-config";
import { translate } from "./translate";

export function sizeLabel(value: string, locale: Locale) {
	return /^(one[- ]?size|os|o\/s)$/i.test(value.trim())
		? translate("One size", {}, locale)
		: value.toUpperCase();
}
