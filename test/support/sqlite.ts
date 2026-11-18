import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { openDatabase } from "#/db/connection";
import { relations } from "#/db/schema";

export function testDatabase(path = ":memory:") {
	const db = drizzle({ client: openDatabase(path), relations });
	migrate(db, { migrationsFolder: "./drizzle" });
	return db;
}
