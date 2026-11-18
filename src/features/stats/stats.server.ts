import {
	ensureCatalogReady,
	INDEX,
} from "#/features/search/catalog-index.server";
import { ft } from "#/features/search/redis-ft.server";
import { createJsonCache } from "#/server/json-cache.server";
import { type Stats, statsSchema } from "./stats.schema";

async function computeStats(): Promise<Stats> {
	await ensureCatalogReady();
	const [{ total }, rows] = await Promise.all([
		ft.search(INDEX, "@discount:[1 +inf]", { offset: 0, limit: 0 }),
		ft.aggregate(INDEX, "*", {
			LOAD: ["@store", "@checkedAt"],
			STEPS: [
				{
					type: "GROUPBY",
					properties: [],
					REDUCE: [
						{ type: "COUNT_DISTINCT", property: "@store", AS: "warehouses" },
						{ type: "MAX", property: "@checkedAt", AS: "checkedAt" },
					],
				},
			],
		}),
	]);
	const row = rows[0];
	const checkedAt = Number(row?.checkedAt);
	return statsSchema.parse({
		deals: total,
		warehouses: Number(row?.warehouses ?? 0),
		checkedAt:
			Number.isFinite(checkedAt) && checkedAt > 0
				? new Date(checkedAt).toISOString()
				: null,
	});
}

const statsCache = createJsonCache({
	key: "catalog:stats:v2",
	ttlSeconds: 30,
	schema: statsSchema,
	compute: computeStats,
});
/** Returns display counts cached for up to 30 seconds. Checkout reads stock directly. */
export const getStats = statsCache.get;

/** Importers can publish fresh counts immediately after a catalog update. */
export const refreshStats = statsCache.refresh;
