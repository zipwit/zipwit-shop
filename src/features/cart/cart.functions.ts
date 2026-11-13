import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { privateRequest } from "#/server/private.middleware";
import { MAX_QUANTITY } from "./cart";
import { cart } from "./cart.server";

const skuInput = z.object({ sku: z.uuid() });
const quantityInput = skuInput.extend({
	quantity: z.int().min(0).max(MAX_QUANTITY),
});

export const getCartFn = createServerFn({ method: "GET" })
	.middleware([privateRequest])
	.handler(() => cart.getSnapshot());

export const addItemFn = createServerFn({ method: "POST" })
	.middleware([privateRequest])
	.validator(skuInput)
	.handler(({ data }) => cart.add(data.sku));

export const setQuantityFn = createServerFn({ method: "POST" })
	.middleware([privateRequest])
	.validator(quantityInput)
	.handler(({ data }) => cart.setQuantity(data.sku, data.quantity));

export const removeUnavailableItemsFn = createServerFn({ method: "POST" })
	.middleware([privateRequest])
	.handler(() => cart.removeUnavailable());
