import {
	ArrowDown01Icon,
	ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTitle,
	PopoverTrigger,
} from "#/components/ui/popover";
import { categories, categorySlugs } from "#/data/catalog";
import { categoryPresentation } from "#/features/catalog/category-presentation";
import { useTranslation } from "#/i18n/translate";

export function CategoryMenu() {
	const t = useTranslation();
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger className="site-nav-link category-menu-trigger gap-2">
				{t("Categories")}
				<HugeiconsIcon icon={ArrowDown01Icon} size={14} aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={14}
				className="category-menu-panel"
			>
				<PopoverTitle className="px-3 pt-2 type-eyebrow text-muted-foreground">
					{t("Shop by category")}
				</PopoverTitle>
				<nav aria-label={t("Categories")}>
					<ul className="space-y-1">
						{categorySlugs.map((category) => {
							const { icon, description } = categoryPresentation[category];
							return (
								<li key={category}>
									<Link
										to="/categories/$category"
										params={{ category }}
										onClick={() => setOpen(false)}
										activeOptions={{ includeSearch: false }}
										className="category-link category-menu-link"
									>
										<span className="category-menu-icon">
											<HugeiconsIcon icon={icon} size={26} aria-hidden="true" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block font-semibold">
												{t(categories[category].label)}
											</span>
											<span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
												{t(description)}
											</span>
										</span>
										<HugeiconsIcon
											icon={ArrowUpRight01Icon}
											size={18}
											className="shrink-0 text-brand"
											aria-hidden="true"
										/>
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>
				<p className="border-t px-3 pt-3 pb-1 text-xs text-muted-foreground">
					{t("For men, women and kids.")}
				</p>
			</PopoverContent>
		</Popover>
	);
}
