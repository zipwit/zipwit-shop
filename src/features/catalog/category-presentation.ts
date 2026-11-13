import {
	Shirt01Icon,
	ShoesIcon,
	ShoppingBag02Icon,
} from "@hugeicons/core-free-icons";
import type { Category } from "#/data/catalog";

/** Shared merchandising copy and icons for category discovery surfaces. */
export const categoryPresentation = {
	shoes: { icon: ShoesIcon, description: "Find your everyday pair" },
	clothing: { icon: Shirt01Icon, description: "Build your everyday wardrobe" },
	accessories: {
		icon: ShoppingBag02Icon,
		description: "Bags, hats, jewellery and more",
	},
} satisfies Record<Category, { icon: typeof ShoesIcon; description: string }>;
