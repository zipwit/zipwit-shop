import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { db } from "#/db";
import { getRedis } from "#/server/redis.server";

export const Route = createFileRoute("/api/ready")({
	server: {
		handlers: {
			GET: async () => {
				const headers = { "Cache-Control": "no-store" };
				try {
					db.get(sql`select 1`);
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
