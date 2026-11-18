import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

export const timestamp = (name: string) =>
	integer(name, { mode: "timestamp_ms" });

const now = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;

export const timestamps = {
	createdAt: timestamp("created_at").default(now).notNull(),
	updatedAt: timestamp("updated_at")
		.default(now)
		.$onUpdate(() => new Date())
		.notNull(),
};

export const dueAt = () => timestamp("next_attempt_at").default(now).notNull();
