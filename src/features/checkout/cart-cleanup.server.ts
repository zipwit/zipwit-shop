import { and, eq, lte } from "drizzle-orm";
import { db } from "#/db";
import { orderCartCleanup } from "#/db/schema";
import { cart } from "#/features/cart/cart.server";

/** The next attempt time doubles as a lease while a worker contacts Redis. */
function claimCleanup(orderId?: string) {
	return db.transaction(
		(tx) => {
			const job = tx
				.select()
				.from(orderCartCleanup)
				.where(
					and(
						lte(orderCartCleanup.nextAttemptAt, new Date()),
						orderId ? eq(orderCartCleanup.orderId, orderId) : undefined,
					),
				)
				.orderBy(orderCartCleanup.nextAttemptAt)
				.limit(1)
				.get();
			if (!job) return;
			const deadline = new Date(Date.now() + 30_000);
			tx.update(orderCartCleanup)
				.set({ nextAttemptAt: deadline })
				.where(eq(orderCartCleanup.orderId, job.orderId))
				.run();
			return { ...job, deadline };
		},
		{ behavior: "immediate" },
	);
}

export async function processCartCleanup(orderId?: string) {
	const job = claimCleanup(orderId);
	if (!job) return false;
	try {
		await cart.removePurchased(
			job.cartId,
			job.orderId,
			job.lines,
			job.deadline,
		);
	} catch {
		console.error("Order cart cleanup will be retried", {
			orderId: job.orderId,
		});
		return true;
	}
	const removed = db
		.delete(orderCartCleanup)
		.where(
			and(
				eq(orderCartCleanup.orderId, job.orderId),
				eq(orderCartCleanup.nextAttemptAt, job.deadline),
			),
		)
		.run();
	if (removed.changes) {
		try {
			await cart.acknowledgePurchaseCleanup(job.cartId, job.orderId);
		} catch {
			console.error("Order cart cleanup marker could not be removed", {
				orderId: job.orderId,
			});
		}
	}
	return true;
}
