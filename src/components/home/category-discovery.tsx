import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { categories, categorySlugs } from "#/data/catalog";
import { categoryPresentation } from "#/features/catalog/category-presentation";
import { useTranslation } from "#/i18n/translate";

export function CategoryDiscovery() {
	const t = useTranslation();
	return (
		<nav aria-label={t("Shop by category")} className="mb-12 md:mb-16">
			<p className="type-eyebrow mb-5 text-muted-foreground">
				{t("Shop by category")}
			</p>
			<ul className="grid gap-3 md:grid-cols-3 md:gap-5">
				{categorySlugs.map((category, index) => (
					<li key={category}>
						<Link
							to="/categories/$category"
							params={{ category }}
							className="discovery-link group"
						>
							<span
								aria-hidden="true"
								className="type-num text-sm text-brand/55"
							>
								0{index + 1}
							</span>
							<div className="min-w-0 flex-1">
								<h3 className="type-title text-xl">
									{t(categories[category].label)}
								</h3>
								<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
									{t(categoryPresentation[category].description)}
								</p>
							</div>
							<HugeiconsIcon
								icon={ArrowUpRight01Icon}
								size={22}
								className="shrink-0 text-brand"
								aria-hidden="true"
							/>
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
