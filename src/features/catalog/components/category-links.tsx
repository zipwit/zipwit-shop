import { Link, linkOptions } from "@tanstack/react-router";
import { categories, categorySlugs, type Department } from "#/data/catalog";
import { useTranslation } from "#/i18n/translate";
import { cn } from "#/lib/utils";

/** The same categories are available across the catalog and within a department. */
export function CategoryLinks({
	department,
	vertical = false,
	includeAll = true,
	onNavigate,
}: {
	department?: Department;
	vertical?: boolean;
	includeAll?: boolean;
	onNavigate?: () => void;
}) {
	const t = useTranslation();
	const links = categorySlugs.map((category) => ({
		category,
		options: department
			? linkOptions({
					to: "/$department/{-$category}",
					params: { department, category },
				})
			: linkOptions({ to: "/categories/$category", params: { category } }),
	}));
	return (
		<nav aria-label={t("Categories")}>
			<ul className={cn("flex gap-2", vertical ? "flex-col" : "flex-wrap")}>
				{department && includeAll && (
					<li>
						<Link
							to="/$department/{-$category}"
							params={{ department, category: undefined }}
							activeOptions={{ exact: true, includeSearch: false }}
							onClick={onNavigate}
							className="category-link"
						>
							{t("All items")}
						</Link>
					</li>
				)}
				{links.map(({ category, options }) => (
					<li key={category}>
						<Link
							{...options}
							activeOptions={{ exact: true, includeSearch: false }}
							onClick={onNavigate}
							className="category-link"
						>
							{t(categories[category].label)}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
