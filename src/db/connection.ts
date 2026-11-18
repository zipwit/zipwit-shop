import { DatabaseSync } from "node:sqlite";

export const databasePath = process.env.SQLITE_PATH || "zipwit.sqlite";

export function openDatabase(path = databasePath) {
	const client = new DatabaseSync(path, {
		timeout: 5000,
		enableForeignKeyConstraints: true,
	});
	client.exec("PRAGMA journal_mode = WAL");
	return client;
}
