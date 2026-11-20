import { createMiddleware, createServerFn } from "@tanstack/react-start";
import {
	authenticated,
	optionalSession,
} from "#/features/auth/session.middleware";
import { env } from "#/server/env.server";
import { ensure } from "#/server/public-error";
import { feedVersionSchema, saveFeedSchema } from "./catalog-feed";
import { deleteFeed, listFeeds, saveFeed } from "./catalog-feeds.server";

const isOperator = (userId: string) =>
	env.CATALOG_ADMIN_USER_IDS.includes(userId);

export const catalogOperatorFn = createServerFn({ method: "GET" })
	.middleware([optionalSession])
	.handler(({ context }) =>
		Boolean(context.userId && isOperator(context.userId)),
	);

const operator = createMiddleware({ type: "function" })
	.middleware([authenticated])
	.server(({ context, next }) => {
		ensure(isOperator(context.userId), "Catalog operator access is required.");
		return next();
	});

export const adminPageFn = createServerFn({ method: "GET" })
	.middleware([optionalSession])
	.handler(async ({ context }) => {
		if (!context.userId) return { access: "guest" as const };
		if (!isOperator(context.userId)) return { access: "denied" as const };
		return { access: "operator" as const, feeds: await listFeeds() };
	});

export const saveFeedFn = createServerFn({ method: "POST" })
	.middleware([operator])
	.validator(saveFeedSchema)
	.handler(({ data }) => saveFeed(data));
export const deleteFeedFn = createServerFn({ method: "POST" })
	.middleware([operator])
	.validator(feedVersionSchema)
	.handler(({ data }) => deleteFeed(data.id, data.revision));
