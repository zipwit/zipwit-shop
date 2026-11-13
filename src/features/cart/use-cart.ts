import {
	useIsMutating,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
	applyLineChange,
	type CartSnapshot,
	EMPTY_CART,
	type LineChange,
	summarizeCart,
} from "#/features/cart/cart";
import {
	addItemFn,
	removeUnavailableItemsFn,
	setQuantityFn,
} from "#/features/cart/cart.functions";
import { cartQuery } from "#/features/cart/cart.queries";
import { useTranslation } from "#/i18n/translate";
import { CART_MUTATION_KEY, cartMutationOptions } from "./cart.mutations";
import { cartDrawer } from "./cart-drawer.store";

export const useCartUpdating = () =>
	useIsMutating({ mutationKey: CART_MUTATION_KEY }) > 0;

const selectCart = (snapshot: CartSnapshot) => ({
	...summarizeCart(snapshot.items),
	unavailableIds: snapshot.unavailableIds,
});

/** The cart's line items plus derived count, subtotal and currency. */
export const useCart = () => {
	const { data, isPending, isError, isFetching, refetch } = useQuery({
		...cartQuery,
		select: selectCart,
	});

	return {
		...(data ?? { ...EMPTY_CART, unavailableIds: [] }),
		isPending,
		isError,
		isFetching,
		refetch,
	};
};

const useCartError = () => {
	const t = useTranslation();
	return (error: Error) =>
		toast.error(
			error.message || t("Couldn't update your cart. Please try again."),
		);
};

/** Adds one unit of a SKU and opens the drawer after a successful update. */
export function useAddToCart() {
	const showCartError = useCartError();
	const queryClient = useQueryClient();
	const addItemFnCall = useServerFn(addItemFn);
	const options = cartMutationOptions(queryClient);

	const { mutate, isPending } = useMutation({
		...options,
		mutationFn: (sku: string) => addItemFnCall({ data: { sku } }),
		onError: showCartError,
		onSettled: async (_data, error) => {
			await options.onSettled();
			if (!error) cartDrawer.actions.open();
		},
	});

	return { addItem: mutate, isAdding: isPending };
}

/** Apply confirmed changes in order, so a failed write cannot undo another line. */
export function useCartLineActions() {
	const showCartError = useCartError();
	const queryClient = useQueryClient();
	const setQuantityFnCall = useServerFn(setQuantityFn);

	const { mutate } = useMutation({
		...cartMutationOptions(queryClient),
		mutationFn: (change: LineChange) => setQuantityFnCall({ data: change }),
		onSuccess: (_data, change) => {
			queryClient.setQueryData(
				cartQuery.queryKey,
				(snapshot) =>
					snapshot && {
						...snapshot,
						items: applyLineChange(snapshot.items, change),
					},
			);
		},
		onError: showCartError,
	});

	return {
		setQuantity: (sku: string, quantity: number) => mutate({ sku, quantity }),
		removeItem: (sku: string) => mutate({ sku, quantity: 0 }),
	};
}

export function useRemoveUnavailableItems() {
	const queryClient = useQueryClient();
	const remove = useServerFn(removeUnavailableItemsFn);
	const onError = useCartError();
	return useMutation({
		...cartMutationOptions(queryClient),
		mutationFn: () => remove(),
		onError,
	});
}
