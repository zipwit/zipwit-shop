import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll } from "vitest";
import { databaseUrl, openDatabase } from "#/db/connection";
import { relations } from "#/db/schema";

/** Each suite owns a database, including its migration journal and independent connections. */
export async function testDatabase() {
	const url = new URL(
		process.env.TEST_DATABASE_URL ??
			(process.env.PGHOST === "postgres"
				? databaseUrl()
				: "postgresql://zipwit:zipwit_dev@127.0.0.1:5432/zipwit"),
	);
	const admin = openDatabase(url.href);
	const name = `zipwit_test_${randomUUID().replaceAll("-", "")}`;
	await admin.query(`CREATE DATABASE "${name}"`);
	url.pathname = `/${name}`;
	const client = openDatabase(url.href);
	afterAll(async () => {
		await client.end();
		try {
			await admin.query(`DROP DATABASE "${name}"`);
		} finally {
			await admin.end();
		}
	});
	const db = drizzle({ client, relations });
	await migrate(db, { migrationsFolder: "./drizzle" });
	return db;
}
