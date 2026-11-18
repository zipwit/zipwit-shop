import { queryOptions, skipToken } from "@tanstack/react-query";
import { getCheckoutFn } from "./checkout.functions";

export const checkoutQuery = (userId: string, id: string | undefined) =>
	queryOptions({
		queryKey: ["checkout", userId, id],
		queryFn: id
			? ({ signal }) => getCheckoutFn({ data: { id, userId }, signal })
			: skipToken,
		staleTime: 15_000,
		retry: false,
	});
