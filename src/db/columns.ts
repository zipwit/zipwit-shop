import { timestamp as pgTimestamp } from "drizzle-orm/pg-core";

export const timestamp = (name: string) =>
	pgTimestamp(name, { withTimezone: true, precision: 3 });

export const timestamps = {
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

export const dueAt = () => timestamp("next_attempt_at").defaultNow().notNull();
