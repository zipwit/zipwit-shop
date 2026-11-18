import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openDatabase } from "#/db/connection";
import { user } from "#/db/schema";
import { testDatabase } from "../support/sqlite";

it("shares committed accounts with the worker and rolls back a failed write", () => {
	const dir = mkdtempSync(join(tmpdir(), "zipwit-test-"));
	const path = join(dir, "shop.sqlite");
	const app = testDatabase(path);
	const worker = openDatabase(path);
	try {
		expect(worker.prepare("PRAGMA journal_mode").get()).toEqual({
			journal_mode: "wal",
		});
		expect(worker.prepare("PRAGMA foreign_keys").get()).toEqual({
			foreign_keys: 1,
		});
		const buyer = { id: "buyer", name: "Buyer", email: "buyer@example.com" };
		expect(() =>
			app.transaction(
				(tx) => {
					tx.insert(user).values(buyer).run();
					expect(worker.prepare("SELECT id FROM user").all()).toEqual([]);
					tx.insert(user).values(buyer).run();
				},
				{ behavior: "immediate" },
			),
		).toThrow();
		expect(app.select().from(user).all()).toEqual([]);
		app.insert(user).values(buyer).run();
		expect(worker.prepare("SELECT id FROM user").get()).toEqual({
			id: "buyer",
		});
	} finally {
		worker.close();
		app.$client.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
