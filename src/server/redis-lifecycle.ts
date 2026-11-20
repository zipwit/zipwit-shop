import { definePlugin } from "nitro";

export default definePlugin(({ hooks }) => {
	hooks.hook("close", async () => {
		const { closeRedis } = await import("./redis.server");
		await closeRedis();
	});
});
