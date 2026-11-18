import { and, asc, desc, eq } from "drizzle-orm";
import { db, type Transaction } from "#/db";
import { address } from "#/db/schema";
import { ensure } from "#/server/public-error";
import { type AddressInput, MAX_ADDRESSES } from "./address.schema";

/** What the browser may see: never the owner or the timestamps. */
const publicColumns = {
	id: address.id,
	fullName: address.fullName,
	phone: address.phone,
	line1: address.line1,
	line2: address.line2,
	city: address.city,
	state: address.state,
	postalCode: address.postalCode,
	country: address.country,
	isPrimary: address.isPrimary,
};

type AddressFields = Omit<AddressInput, "isPrimary">;

/** Empty optional fields are stored as null. */
const toRow = (fields: AddressFields) => ({
	...fields,
	line2: fields.line2 || null,
});

const mine = (userId: string, id: string) =>
	and(eq(address.id, id), eq(address.userId, userId));

/** Frees the primary slot first: the partial unique index allows only one primary per user. */
const demotePrimary = (tx: Transaction, userId: string) =>
	tx
		.update(address)
		.set({ isPrimary: false })
		.where(and(eq(address.userId, userId), eq(address.isPrimary, true)))
		.run();

/**
 * An account with saved addresses always has a primary. To move that designation,
 * select another address. Removing the primary promotes the oldest remaining one.
 */
export const addresses = {
	/** The primary address first, then the rest in the order they were added. */
	async list(userId: string) {
		return db
			.select(publicColumns)
			.from(address)
			.where(eq(address.userId, userId))
			.orderBy(
				desc(address.isPrimary),
				asc(address.createdAt),
				asc(address.id),
			);
	},

	async create(userId: string, { isPrimary, ...fields }: AddressInput) {
		db.transaction(
			(tx) => {
				const existing = tx
					.select({ id: address.id })
					.from(address)
					.where(eq(address.userId, userId))
					.all();
				ensure(
					existing.length < MAX_ADDRESSES,
					"You can save up to {{max}} addresses.",
					{ max: MAX_ADDRESSES },
				);

				const primary = isPrimary || existing.length === 0;
				if (primary) demotePrimary(tx, userId);

				tx.insert(address)
					.values({ ...toRow(fields), userId, isPrimary: primary })
					.run();
			},
			{ behavior: "immediate" },
		);
	},

	async update(
		userId: string,
		id: string,
		{ isPrimary, ...fields }: AddressInput,
	) {
		db.transaction(
			(tx) => {
				const current = tx
					.select({ isPrimary: address.isPrimary })
					.from(address)
					.where(mine(userId, id))
					.get();
				ensure(current, "That address no longer exists.");

				const promote = isPrimary && !current.isPrimary;
				if (promote) demotePrimary(tx, userId);

				tx.update(address)
					.set({ ...toRow(fields), ...(promote && { isPrimary: true }) })
					.where(mine(userId, id))
					.run();
			},
			{ behavior: "immediate" },
		);
	},

	async setPrimary(userId: string, id: string) {
		db.transaction(
			(tx) => {
				const target = tx
					.select({ isPrimary: address.isPrimary })
					.from(address)
					.where(mine(userId, id))
					.get();
				ensure(target, "That address no longer exists.");
				if (target.isPrimary) return;

				demotePrimary(tx, userId);
				tx.update(address)
					.set({ isPrimary: true })
					.where(mine(userId, id))
					.run();
			},
			{ behavior: "immediate" },
		);
	},

	async remove(userId: string, id: string) {
		db.transaction(
			(tx) => {
				const removed = tx
					.delete(address)
					.where(mine(userId, id))
					.returning({ isPrimary: address.isPrimary })
					.get();
				if (!removed?.isPrimary) return;

				const next = tx
					.select({ id: address.id })
					.from(address)
					.where(eq(address.userId, userId))
					.orderBy(asc(address.createdAt), asc(address.id))
					.limit(1)
					.get();
				if (next) {
					tx.update(address)
						.set({ isPrimary: true })
						.where(eq(address.id, next.id))
						.run();
				}
			},
			{ behavior: "immediate" },
		);
	},
};
