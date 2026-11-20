import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RetryNotice } from "#/components/retry-notice";
import { Button } from "#/components/ui/button";
import type { Address } from "#/features/addresses/address.functions";
import { addressesQuery } from "#/features/addresses/address.queries";
import { AddressDialog } from "#/features/addresses/components/address-dialog";
import { CartAvailabilityNotice } from "#/features/cart/components/cart-availability-notice";
import { useCart, useCartUpdating } from "#/features/cart/use-cart";
import { getShipmentRule, groupShipments } from "#/features/shipping/shipping";
import { useTranslation } from "#/i18n/translate";
import { selectDeliveryAddressId } from "../checkout";
import { CheckoutAddressPicker } from "./checkout-address";
export function CheckoutDelivery({
	userId,
	initialAddresses,
	ready,
	busy,
	onPrepare,
}: {
	userId: string;
	initialAddresses: Address[];
	ready: boolean;
	busy: string | null;
	onPrepare: (id: string) => void;
}) {
	const t = useTranslation();
	const cart = useCart();
	const cartUpdating = useCartUpdating();
	const {
		data: addresses = [],
		isError: addressError,
		isFetching: fetchingAddresses,
		refetch: refreshAddresses,
	} = useQuery({ ...addressesQuery(userId), initialData: initialAddresses });
	const [addingAddress, setAddingAddress] = useState(false);
	const [addressId, setAddressId] = useState("");
	const selectedId = selectDeliveryAddressId(addresses, addressId);
	const cartReady =
		!cart.isPending &&
		!cart.isError &&
		!cartUpdating &&
		cart.items.length > 0 &&
		cart.unavailableIds.length === 0 &&
		groupShipments(cart.items).every(({ lines }) => getShipmentRule(lines));

	return (
		<>
			{!ready && (
				<p role="status" className="rounded-lg bg-muted p-4 text-sm">
					{t("Checkout is temporarily unavailable. Please try again later.")}
				</p>
			)}
			{addressError && (
				<RetryNotice
					message={t("Couldn't load your addresses.")}
					onRetry={() => refreshAddresses()}
					retrying={fetchingAddresses}
				/>
			)}
			<CartAvailabilityNotice count={cart.unavailableIds.length} />
			<CheckoutAddressPicker
				addresses={addresses}
				selectedId={selectedId}
				disabled={Boolean(busy)}
				onSelect={setAddressId}
				onAdd={() => setAddingAddress(true)}
			/>
			<Button
				className="h-auto min-h-12 w-full whitespace-normal py-3"
				size="lg"
				disabled={!ready || !selectedId || !cartReady || Boolean(busy)}
				onClick={() => selectedId && onPrepare(selectedId)}
			>
				{busy === "prepare"
					? t("Preparing checkout…")
					: t("Review total and continue")}
			</Button>
			<AddressDialog
				open={addingAddress}
				onOpenChange={setAddingAddress}
				firstAddress={!addresses.length}
			/>
		</>
	);
}
