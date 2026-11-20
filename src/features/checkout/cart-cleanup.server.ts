import { and, eq, lte } from "drizzle-orm";
import { db } from "#/db";
import { orderCartCleanup } from "#/db/schema";
import { cart } from "#/features/cart/cart.server";

/** The next attempt time doubles as a lease while a worker contacts Redis. */
function claimCleanup(orderId?: string) {
	return db.transaction(async (tx) => {
		const [job] = await tx
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
			.for("update", { skipLocked: true });
		if (!job) return;
		const deadline = new Date(Date.now() + 30_000);
		await tx
			.update(orderCartCleanup)
			.set({ nextAttemptAt: deadline })
			.where(eq(orderCartCleanup.orderId, job.orderId));
		return { ...job, deadline };
	});
}

export async function processCartCleanup(orderId?: string) {
	const job = await claimCleanup(orderId);
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
	const removed = await db
		.delete(orderCartCleanup)
		.where(
			and(
				eq(orderCartCleanup.orderId, job.orderId),
				eq(orderCartCleanup.nextAttemptAt, job.deadline),
			),
		);
	if (removed.rowCount) {
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
