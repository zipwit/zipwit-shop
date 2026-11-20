import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/db/connection";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials:
		process.env.DATABASE_URL || process.env.PGHOST
			? { url: databaseUrl() }
			: undefined,
});
