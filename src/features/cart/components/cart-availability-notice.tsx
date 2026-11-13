import { Button } from "#/components/ui/button";
import { useTranslation } from "#/i18n/translate";
import { useCartUpdating, useRemoveUnavailableItems } from "../use-cart";

/** Shared recovery in the drawer and checkout, including carts with no valid lines. */
export function CartAvailabilityNotice({ count }: { count: number }) {
	const t = useTranslation();
	const remove = useRemoveUnavailableItems();
	const updating = useCartUpdating();
	if (!count) return null;
	return (
		<div
			role="status"
			className="space-y-3 rounded-md border border-brand/20 bg-brand/5 p-4"
		>
			<p className="text-sm leading-relaxed">
				{t("{{count}} cart items are unavailable. Remove them to continue.", {
					count,
				})}
			</p>
			<Button
				variant="outline"
				className="h-auto min-h-11 max-w-full whitespace-normal"
				disabled={updating}
				onClick={() => remove.mutate()}
			>
				{remove.isPending
					? t("Updating your cart…")
					: t("Remove unavailable items")}
			</Button>
		</div>
	);
}
