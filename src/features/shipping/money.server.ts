import Decimal from "decimal.js";

/** Rounds a monetary amount expressed in minor units using decimal half-up rounding. */
export const roundMinorUnits = (amount: Decimal) =>
	amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

/** Converts one unit's price to USD cents before cart quantities are applied. */
export function unitPriceUsd(
	price: number,
	currency: string,
	gelPerUsd: number | null,
) {
	if (currency === "USD") return price;
	if (currency !== "GEL" || !gelPerUsd) return null;
	return roundMinorUnits(new Decimal(price).div(gelPerUsd));
}
