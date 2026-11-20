import { expect, it, vi } from "vitest";
import { openDatabase } from "#/db/connection";
import { user } from "#/db/schema";
import { testDatabase } from "../support/postgres";

const db = await testDatabase();
it("isolates uncommitted writes, rolls back failures and shares committed accounts", async () => {
	const buyer = { id: "buyer", name: "Buyer", email: "buyer@example.com" };
	await expect(
		db.transaction(async (tx) => {
			await tx.insert(user).values(buyer);
			expect(await db.select().from(user)).toEqual([]);
			await tx.insert(user).values(buyer);
		}),
	).rejects.toThrow();
	expect(await db.select().from(user)).toEqual([]);
	await db.insert(user).values(buyer);
	expect(await db.select({ id: user.id }).from(user)).toEqual([
		{ id: "buyer" },
	]);
});

it("reconnects after PostgreSQL closes an idle connection", async () => {
	const pool = openDatabase(db.$client.options.connectionString);
	const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
	try {
		const {
			rows: [first],
		} = await pool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
		expect(first).toBeDefined();
		await db.$client.query("SELECT pg_terminate_backend($1)", [first?.pid]);
		await vi.waitFor(() =>
			expect(warning).toHaveBeenCalledWith(
				"Idle PostgreSQL connection closed",
				expect.any(String),
			),
		);
		const {
			rows: [next],
		} = await pool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
		expect(next?.pid).toBeDefined();
		expect(next?.pid).not.toBe(first?.pid);
	} finally {
		warning.mockRestore();
		await pool.end();
	}
});
