import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addresses } from "#/features/addresses/address.server";
import {
	authenticated,
	optionalSession,
} from "#/features/auth/session.middleware";
import { ensure } from "#/server/public-error";
import {
	getCheckout,
	prepareCheckout,
	submitCheckout,
	uploadProof,
} from "./checkout.server";
import { checkoutPricing } from "./checkout-config.server";

const idInput = z.object({ id: z.uuid() });
export const checkoutPageFn = createServerFn({ method: "GET" })
	.middleware([optionalSession])
	.validator(z.object({ id: z.uuid().optional() }))
	.handler(async ({ data, context }) => {
		const { userId } = context;
		if (!userId)
			return { userId: null, ready: false, addresses: [], checkout: null };
		const [ready, savedAddresses, checkout] = await Promise.all([
			data.id ? true : checkoutPricing().then(Boolean),
			data.id ? [] : addresses.list(userId),
			data.id ? getCheckout(userId, data.id) : null,
		]);
		return { userId, ready, addresses: savedAddresses, checkout };
	});

export const getCheckoutFn = createServerFn({ method: "GET" })
	.middleware([authenticated])
	.validator(idInput.extend({ userId: z.string().min(1) }))
	.handler(({ data, context }) => {
		ensure(data.userId === context.userId, "Please sign in to continue.");
		return getCheckout(context.userId, data.id);
	});

export const prepareCheckoutFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator(idInput.extend({ addressId: z.uuid() }))
	.handler(({ data, context }) =>
		prepareCheckout(context.userId, data.id, data.addressId),
	);

export const uploadProofFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator((data: FormData) => {
		if (!(data instanceof FormData)) throw new Error("Invalid upload");
		const id = z.uuid().parse(data.get("id"));
		const file = data.get("file");
		if (!(file instanceof File)) throw new Error("Invalid upload");
		return { id, file };
	})
	.handler(({ data, context }) =>
		uploadProof(context.userId, data.id, data.file),
	);

export const submitCheckoutFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator(idInput)
	.handler(({ data, context }) => submitCheckout(context.userId, data.id));
