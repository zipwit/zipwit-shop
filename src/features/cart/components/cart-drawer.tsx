import { LinkButton } from "#/components/link-button";
import { Button } from "#/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "#/components/ui/sheet";
import {
	cartDrawer,
	useCartDrawerOpen,
} from "#/features/cart/cart-drawer.store";
import { useCart, useCartUpdating } from "#/features/cart/use-cart";
import { useTranslation } from "#/i18n/translate";
import { usePriceFormatter } from "#/lib/price";
import { CartAvailabilityNotice } from "./cart-availability-notice";
import { CartShipments } from "./cart-shipments";

export function CartDrawer() {
	const t = useTranslation();
	const open = useCartDrawerOpen();
	const updating = useCartUpdating();
	const cart = useCart();

	return (
		<Sheet open={open} onOpenChange={cartDrawer.actions.set}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
			>
				<SheetHeader className="px-6 py-7">
					<SheetTitle className="text-xl font-semibold tracking-tight">
						{t("Your cart")}
					</SheetTitle>
					<p role="status" className="min-h-5 text-xs text-muted-foreground">
						{updating ? t("Updating your cart…") : ""}
					</p>
				</SheetHeader>

				<CartDrawerContents cart={cart} />
			</SheetContent>
		</Sheet>
	);
}

function CartDrawerContents({ cart }: { cart: ReturnType<typeof useCart> }) {
	const t = useTranslation();
	if (cart.isPending) {
		return (
			<p role="status" className="p-4 text-muted-foreground">
				{t("Loading your cart…")}
			</p>
		);
	}
	if (cart.isError) {
		return (
			<div className="flex flex-col items-start gap-3 p-4">
				<p role="alert">{t("Couldn't load your cart.")}</p>
				<Button
					variant="outline"
					disabled={cart.isFetching}
					onClick={() => cart.refetch()}
				>
					{cart.isFetching ? t("Trying again…") : t("Try again")}
				</Button>
			</div>
		);
	}
	return (
		<>
			{cart.unavailableIds.length > 0 && (
				<div className="px-5 pb-5 sm:px-6">
					<CartAvailabilityNotice count={cart.unavailableIds.length} />
				</div>
			)}
			{cart.items.length === 0 ? (
				<EmptyCart />
			) : (
				<>
					<CartShipments
						items={cart.items}
						onBrowse={cartDrawer.actions.close}
					/>
					<CartCheckoutFooter
						subtotal={cart.subtotal}
						currency={cart.currency}
					/>
				</>
			)}
		</>
	);
}

function CartCheckoutFooter({
	subtotal,
	currency,
}: {
	subtotal: number;
	currency: string;
}) {
	const t = useTranslation();
	const { formatPrice } = usePriceFormatter();
	return (
		<SheetFooter className="gap-4 border-t p-6">
			<div
				aria-live="polite"
				aria-atomic="true"
				className="flex flex-wrap items-center justify-between gap-2 font-semibold text-lg"
			>
				<span>{t("Subtotal")}</span>
				<span className="text-price">{formatPrice(subtotal, currency)}</span>
			</div>
			<p className="text-muted-foreground text-xs">
				{t(
					"Shipping is calculated separately for each warehouse. Review the final shipping and service fee at checkout.",
				)}
			</p>
			<LinkButton
				to="/checkout"
				size="lg"
				className="h-12 w-full rounded-lg"
				onClick={cartDrawer.actions.close}
			>
				{t("Checkout")}
			</LinkButton>
		</SheetFooter>
	);
}

function EmptyCart() {
	const t = useTranslation();
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
			<p className="font-medium">{t("Your cart is empty")}</p>
			<p className="text-muted-foreground text-sm">
				{t("Add some deals and they will show up here.")}
			</p>
			<Button variant="outline" onClick={cartDrawer.actions.close}>
				{t("Continue shopping")}
			</Button>
		</div>
	);
}
