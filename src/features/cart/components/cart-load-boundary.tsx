import type { ReactNode } from "react";
import { RetryNotice } from "#/components/retry-notice";
import type { useCart } from "#/features/cart/use-cart";
import { useTranslation } from "#/i18n/translate";

/** Shares cart loading and retry behavior across the drawer and checkout summary. */
export function CartLoadBoundary({
	cart,
	className,
	children,
}: {
	cart: Pick<
		ReturnType<typeof useCart>,
		"isPending" | "isError" | "isFetching" | "refetch"
	>;
	className?: string;
	children: ReactNode;
}) {
	const t = useTranslation();
	if (cart.isPending)
		return (
			<p role="status" className={className}>
				{t("Loading your cart…")}
			</p>
		);
	if (cart.isError)
		return (
			<RetryNotice
				className={className}
				message={t("Couldn't load your cart.")}
				retrying={cart.isFetching}
				onRetry={() => cart.refetch()}
			/>
		);
	return children;
}
