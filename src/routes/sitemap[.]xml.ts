import { createFileRoute } from "@tanstack/react-router";
import { escape as escapeXml } from "es-toolkit";
import { z } from "zod";
import { categorySlugs, departmentSlugs } from "#/data/catalog";
import type { CatalogDoc } from "#/features/search/catalog-doc";
import {
	ensureCatalogReady,
	INDEX,
} from "#/features/search/catalog-index.server";
import { ft } from "#/features/search/redis-ft.server";
import { env } from "#/server/env.server";
import { createJsonCache } from "#/server/json-cache.server";

/** Per the sitemap protocol, one file lists at most 50,000 URLs. */
const MAX_SITEMAP_URLS = 50_000;

const staticPaths = [
	"/",
	"/deals",
	"/about",
	...categorySlugs.map((category) => `/categories/${category}`),
	...departmentSlugs.flatMap((department) => [
		`/${department}`,
		...categorySlugs.map((category) => `/${department}/${category}`),
	]),
];

const urlEntry = (path: string, lastModified?: Date) =>
	`  <url><loc>${escapeXml(env.SITE_URL + path)}</loc>${
		lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : ""
	}</url>`;

const sitemapProducts = createJsonCache({
	key: "catalog:sitemap:v1",
	ttlSeconds: 300,
	schema: z.array(
		z.object({ slug: z.string(), updatedAt: z.number().optional() }),
	),
	compute: async () => {
		await ensureCatalogReady();
		const { docs } = await ft.search<CatalogDoc>(INDEX, "*", {
			sort: { BY: "updatedAt", DIRECTION: "DESC" },
			offset: 0,
			limit: MAX_SITEMAP_URLS - staticPaths.length,
		});
		return docs.map(({ slug, updatedAt }) => ({ slug, updatedAt }));
	},
});

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const products = await sitemapProducts.get();

				const entries = [
					...staticPaths.map((path) => urlEntry(path)),
					...products.map((p) =>
						urlEntry(
							`/product/${encodeURIComponent(p.slug)}`,
							p.updatedAt ? new Date(p.updatedAt) : undefined,
						),
					),
				];

				const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

				return new Response(xml, {
					headers: {
						"Content-Type": "application/xml",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
