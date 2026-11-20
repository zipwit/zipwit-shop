import { z } from "zod";
import { categorySchema, departmentSchema } from "#/data/catalog";

/** Wire format consumed by deal_scout.settings.Feed. */
export const catalogFeedSchema = z
	.strictObject({
		warehouse: z
			.string()
			.trim()
			.toLowerCase()
			.max(253)
			.regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
		department: departmentSchema,
		category: categorySchema,
		urls: z
			.array(z.url({ protocol: /^https$/, normalize: true }).max(4096))
			.min(1)
			.max(1000),
		product_link_selector: z
			.string()
			.trim()
			.min(1)
			.max(1000)
			.nullable()
			.default(null),
		max_pages: z.int().min(1).max(1000).default(50),
		rules: z.strictObject({
			min_discount_percent: z.int().min(1).max(100),
			max_age_minutes: z.int().min(1).max(1440),
		}),
	})
	.superRefine((feed, ctx) => {
		for (const raw of feed.urls) {
			const url = URL.parse(raw);
			if (
				!url ||
				url.origin !== `https://${feed.warehouse}` ||
				url.username ||
				url.password
			) {
				ctx.addIssue({
					code: "custom",
					path: ["urls"],
					message: "Use HTTPS URLs on the warehouse domain.",
				});
				break;
			}
		}
		if (feed.urls.length > feed.max_pages)
			ctx.addIssue({
				code: "custom",
				path: ["max_pages"],
				message: "The page limit must cover all starting URLs.",
			});
	});
export type CatalogFeed = z.infer<typeof catalogFeedSchema>;

export const feedVersionSchema = z.object({
	id: z.uuid(),
	revision: z.int().nonnegative(),
});
export const saveFeedSchema = feedVersionSchema.extend({
	enabled: z.boolean(),
	config: catalogFeedSchema,
});
export type SavedFeed = z.infer<typeof saveFeedSchema>;
