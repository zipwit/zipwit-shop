import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { catalogFeed } from "#/db/schema";
import { ensure } from "#/server/public-error";
import type { SavedFeed } from "./catalog-feed";

const changed =
	"This feed changed. Reload the latest version before editing it again.";

export function listFeeds() {
	return db.select().from(catalogFeed).orderBy(catalogFeed.id);
}

export async function workerFeeds() {
	return (
		await db
			.select({ config: catalogFeed.config })
			.from(catalogFeed)
			.where(eq(catalogFeed.enabled, true))
			.orderBy(catalogFeed.id)
	).map((row) => row.config);
}

export async function saveFeed({ revision, id, config, enabled }: SavedFeed) {
	const next = { config, enabled, revision: revision + 1 };
	const [saved] = await (revision === 0
		? db
				.insert(catalogFeed)
				.values({ id, ...next })
				.onConflictDoNothing()
				.returning()
		: db
				.update(catalogFeed)
				.set(next)
				.where(and(eq(catalogFeed.id, id), eq(catalogFeed.revision, revision)))
				.returning());
	if (saved) return saved;
	// A retry after a lost response may already have committed this edit.
	const [current] = await db
		.select()
		.from(catalogFeed)
		.where(eq(catalogFeed.id, id))
		.limit(1);
	ensure(
		current &&
			current.revision === next.revision &&
			current.enabled === enabled &&
			isDeepStrictEqual(current.config, config),
		changed,
	);
	return current;
}

export function deleteFeed(id: string, revision: number) {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(catalogFeed)
			.where(eq(catalogFeed.id, id))
			.for("update");
		if (!current) return;
		ensure(current.revision === revision, changed);
		await tx.delete(catalogFeed).where(eq(catalogFeed.id, id));
	});
}
