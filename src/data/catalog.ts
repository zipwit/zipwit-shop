import { z } from "zod";

/**
 * Single source of truth for the storefront taxonomy and Redis catalog validation.
 * Navigation and routes derive their choices from these values. Keep translations,
 * seed fixtures, and department artwork aligned when extending the taxonomy.
 */
export const departmentSlugs = ["men", "women", "kids"] as const;
export type Department = (typeof departmentSlugs)[number];

export const categorySlugs = ["shoes", "clothing", "accessories"] as const;
export type Category = (typeof categorySlugs)[number];

export const departments = {
	men: { label: "Men" },
	women: { label: "Women" },
	kids: { label: "Kids" },
} satisfies Record<Department, { label: string }>;

export const categories = {
	shoes: { label: "Shoes" },
	clothing: { label: "Clothing" },
	accessories: { label: "Accessories" },
} satisfies Record<Category, { label: string }>;

export const departmentSchema = z.enum(departmentSlugs);
export const categorySchema = z.enum(categorySlugs);
