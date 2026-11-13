import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { privateRequest } from "#/server/private.middleware";
import { ensure } from "#/server/public-error";
import { auth } from "./auth.server";

/** Resolve identity once per function call, from the server's session cookie. */
export const optionalSession = createMiddleware({ type: "function" })
	.middleware([privateRequest])
	.server(async ({ next }) => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		return next({ context: { userId: session?.user.id ?? null } });
	});

/** Route guards are UX; this middleware protects every private RPC itself. */
export const authenticated = createMiddleware({ type: "function" })
	.middleware([optionalSession])
	.server(({ context, next }) => {
		ensure(context.userId, "Please sign in to continue.");
		return next({ context: { userId: context.userId } });
	});
