import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/db";
import { checkoutSession } from "#/db/schema";
import { getRedis } from "#/server/redis.server";

export const Route = createFileRoute("/api/ready")({
	server: {
		handlers: {
			GET: async () => {
				const headers = { "Cache-Control": "no-store" };
				try {
					await db
						.select({ supplierPages: checkoutSession.supplierPages })
						.from(checkoutSession)
						.limit(0);
					await (await getRedis()).get("ready:probe");
					return Response.json({ status: "ready" }, { headers });
				} catch {
					return Response.json(
						{ status: "unavailable" },
						{ status: 503, headers },
					);
				}
			},
		},
	},
});
