import { expect, it, vi } from "vitest";
import { catalogFeedSchema } from "#/features/admin/catalog-feed";
import exampleFeeds from "../../../deal-scout/feeds.example.json";

vi.mock("#/db", async () => ({
	db: await (await import("../../support/postgres")).testDatabase(),
}));

const { listFeeds, saveFeed, deleteFeed, workerFeeds } = await import(
	"#/features/admin/catalog-feeds.server"
);

const config = catalogFeedSchema.parse(exampleFeeds[0]);
it("accepts the worker fixture and rejects feeds the worker cannot crawl as configured", () => {
	expect(config).toEqual(exampleFeeds[0]);
	for (const urls of [
		["https://another.example/p"],
		["http://outlet.example"],
		["https://user@outlet.example/p"],
		[],
		[...config.urls, ...config.urls],
	]) {
		expect(
			catalogFeedSchema.safeParse({ ...config, urls, max_pages: 1 }).success,
		).toBe(false);
	}
});

it("starts with the verified ShopWSS product feed and two paused collections", async () => {
	const initial = await listFeeds();
	expect(initial.map((feed) => feed.config.warehouse).sort()).toEqual([
		"www.joesnewbalanceoutlet.com",
		"www.shoepalace.com",
		"www.shopwss.com",
	]);
	for (const feed of initial) {
		expect(catalogFeedSchema.parse(feed.config)).toEqual(feed.config);
		expect(feed.enabled).toBe(feed.config.warehouse === "www.shopwss.com");
	}
	expect(await workerFeeds()).toEqual([
		expect.objectContaining({
			warehouse: "www.shopwss.com",
			product_link_selector: null,
			urls: [expect.stringContaining("/products/")],
		}),
	]);
});

it("saves, pauses and deletes feeds without exposing admin metadata or losing concurrent edits", async () => {
	const draft = { id: crypto.randomUUID(), revision: 0, enabled: true, config };
	const initial = await listFeeds();
	const active = await workerFeeds();
	const saved = await saveFeed(draft);
	expect(await saveFeed(draft)).toEqual(saved);
	expect(await workerFeeds()).toContainEqual(config);
	const paused = await saveFeed({ ...saved, enabled: false });
	expect(await workerFeeds()).toEqual(active);
	expect(await listFeeds()).toContainEqual(paused);
	await expect(
		saveFeed({ ...saved, config: { ...config, max_pages: 5 } }),
	).rejects.toThrow("This feed changed");
	await expect(deleteFeed(saved.id, saved.revision)).rejects.toThrow(
		"This feed changed",
	);
	await deleteFeed(paused.id, paused.revision);
	await deleteFeed(paused.id, paused.revision);
	expect(await listFeeds()).toEqual(initial);
});
