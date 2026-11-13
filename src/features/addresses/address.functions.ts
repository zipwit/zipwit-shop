import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticated } from "#/features/auth/session.middleware";
import { addressSchema } from "./address.schema";
import { addresses } from "./address.server";

const idInput = z.object({ id: z.uuid() });

export const listAddressesFn = createServerFn({ method: "GET" })
	.middleware([authenticated])
	.handler(({ context }) => addresses.list(context.userId));

export const createAddressFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator(addressSchema)
	.handler(({ data, context }) => addresses.create(context.userId, data));

export const updateAddressFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator(idInput.extend({ address: addressSchema }))
	.handler(({ data, context }) =>
		addresses.update(context.userId, data.id, data.address),
	);

export const setPrimaryAddressFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator(idInput)
	.handler(({ data, context }) =>
		addresses.setPrimary(context.userId, data.id),
	);

export const deleteAddressFn = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.validator(idInput)
	.handler(({ data, context }) => addresses.remove(context.userId, data.id));

/** One saved address, as the account settings list it. */
export type Address = Awaited<ReturnType<typeof listAddressesFn>>[number];
