import { Pool } from "pg";

export function databaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const {
		PGHOST,
		PGPORT = "5432",
		PGUSER,
		PGPASSWORD,
		PGDATABASE,
	} = process.env;
	if (!PGHOST || !PGUSER || !PGDATABASE)
		throw new Error(
			"Configure DATABASE_URL or the PostgreSQL connection variables",
		);
	const url = new URL("postgresql://localhost");
	url.hostname = PGHOST;
	url.port = PGPORT;
	url.username = PGUSER;
	url.password = PGPASSWORD ?? "";
	url.pathname = `/${encodeURIComponent(PGDATABASE)}`;
	return url.toString();
}

export function openDatabase(connectionString = process.env.DATABASE_URL) {
	const pool = new Pool({
		connectionString,
		connectionTimeoutMillis: 5000,
		allowExitOnIdle: true,
	});
	// pg removes lost idle clients and opens replacements on the next query.
	pool.on("error", (error) => {
		console.warn("Idle PostgreSQL connection closed", error.message);
	});
	return pool;
}
