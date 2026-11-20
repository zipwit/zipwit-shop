/** Apply newline-delimited worker snapshots through the storefront catalog writer. */
import { createInterface } from "node:readline";
import { catalogInputSchema } from "#/features/catalog/catalog-record";
import {
	putCatalogProduct,
	withdrawCatalogObservation,
} from "#/features/catalog/catalog-store.server";
import { getRedis } from "#/server/redis.server";

/** Track the shared connection so a failed first write also releases its sockets. */
let connection: Awaited<ReturnType<typeof getRedis>> | undefined;
let applied = 0;
let stale = 0;

try {
	for await (const line of createInterface({ input: process.stdin })) {
		if (!line.trim()) continue;
		const record = catalogInputSchema.parse(JSON.parse(line));
		connection ??= await getRedis();
		const written = record.skus.length
			? await putCatalogProduct(record)
			: await withdrawCatalogObservation(record.id, record.updatedAt);
		if (written) applied++;
		else stale++;
	}
	console.error(`Catalog snapshots applied: ${applied}, superseded: ${stale}`);
	if (stale) process.exitCode = 1;
} finally {
	await connection?.close();
}
