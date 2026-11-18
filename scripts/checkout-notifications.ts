import { writeFile } from "node:fs/promises";
import { processCartCleanup } from "../src/features/checkout/cart-cleanup.server";
import {
	cleanExpiredDrafts,
	deliverOrderNotification,
} from "../src/features/checkout/telegram.server";

const HEARTBEAT_FILE = "/tmp/worker-heartbeat";
const beat = () =>
	writeFile(HEARTBEAT_FILE, String(Date.now())).catch(() => undefined);

let stopping = false;
process.on("SIGTERM", () => {
	stopping = true;
});
process.on("SIGINT", () => {
	stopping = true;
});
let lastCleanup = 0;
while (!stopping) {
	await beat();
	try {
		if (Date.now() - lastCleanup > 24 * 60 * 60 * 1000) {
			await cleanExpiredDrafts();
			lastCleanup = Date.now();
		}
		const cartProcessed = await processCartCleanup();
		const notificationProcessed = await deliverOrderNotification();
		if (cartProcessed || notificationProcessed) continue;
	} catch (error) {
		console.error("Order notification worker failed; retrying", {
			name: error instanceof Error ? error.name : typeof error,
		});
	}
	await new Promise((resolve) => setTimeout(resolve, 5_000));
}
process.exit(0);
