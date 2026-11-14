import { z } from "zod";
import { categorySchema, departmentSchema } from "#/data/catalog";

/** Private catalog data stored in Redis; public responses explicitly select safe fields. */
export const catalogRecordSchema = z.object({
	id: z.uuid(),
	slug: z
		.string()
		.min(1)
		.max(200)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	name: z.string(),
	brand: z.string().nullable(),
	description: z.string().nullable(),
	department: departmentSchema,
	category: categorySchema,
	currency: z.string(),
	warehouse: z.string(),
	browseOnly: z.boolean(),
	lastSeenAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	skus: z.array(
		z.object({
			id: z.uuid(),
			color: z.string(),
			size: z.string(),
			imageUrl: z.string().nullable(),
			price: z.int().positive(),
			originalPrice: z.int().positive().nullable(),
			discount: z.int().min(0).max(100),
			inStock: z.boolean(),
			sourceExpiresAt: z.iso.datetime().nullable(),
		}),
	),
});

export type CatalogRecord = z.infer<typeof catalogRecordSchema>;
export type CatalogSku = CatalogRecord["skus"][number];

const imageAllowed = (url: string) =>
	url.startsWith("https://") ||
	(process.env.NODE_ENV !== "production" && url.startsWith("data:image/"));

export const catalogInputSchema = catalogRecordSchema.refine(
	(record) =>
		record.skus.every(
			(sku) => sku.imageUrl === null || imageAllowed(sku.imageUrl),
		),
	"Image URLs must use https.",
);

export const skuAvailable = (sku: CatalogSku, now = Date.now()) =>
	sku.inStock &&
	(!sku.sourceExpiresAt || Date.parse(sku.sourceExpiresAt) > now);

/** Related detail and Search documents share a slot; different products remain sharded. */
export const catalogKeys = {
	record: (id: string) => `catalog:product:{${id}}`,
	revision: (id: string) => `catalog:revision:{${id}}`,
	search: (id: string) => `product:{${id}}`,
	slug: (slug: string) => `catalog:slug:${slug}`,
	sku: (id: string) => `catalog:sku:${id}`,
};
