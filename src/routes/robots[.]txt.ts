import { createFileRoute } from "@tanstack/react-router";
import { env } from "#/server/env.server";

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () =>
				new Response(
					`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${env.SITE_URL}/sitemap.xml\n`,
					{
						headers: {
							"Content-Type": "text/plain",
							"Cache-Control": "public, max-age=3600",
						},
					},
				),
		},
	},
});
