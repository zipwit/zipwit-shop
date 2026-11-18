import { defineRelationsPart } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamp, timestamps } from "./columns";

export const user = sqliteTable("user", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	...timestamps,
});

export const account = sqliteTable(
	"account",
	{
		id: text("id").notNull().primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		...timestamps,
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const authRelations = defineRelationsPart({ user, account }, (r) => ({
	user: {
		accounts: r.many.account({
			from: r.user.id,
			to: r.account.userId,
		}),
	},
	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id,
		}),
	},
}));
