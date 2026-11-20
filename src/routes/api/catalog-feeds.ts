import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { workerFeeds } from "#/features/admin/catalog-feeds.server";
import { env } from "#/server/env.server";

const digest = (value: string) => createHash("sha256").update(value).digest();

export const Route = createFileRoute("/api/catalog-feeds")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const headers = { "Cache-Control": "private, no-store" };
				const token = env.ZIPWIT_CONFIG_TOKEN;
				const authorization = request.headers.get("Authorization");
				if (
					!token ||
					!authorization ||
					!timingSafeEqual(digest(authorization), digest(`Bearer ${token}`))
				) {
					return new Response(null, {
						status: 401,
						headers: { ...headers, "WWW-Authenticate": "Bearer" },
					});
				}
				return Response.json(await workerFeeds(), { headers });
			},
		},
	},
});
