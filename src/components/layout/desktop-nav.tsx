import { Link } from "@tanstack/react-router";
import { departmentSlugs, departments } from "#/data/catalog";
import { useTranslation } from "#/i18n/translate";
import { CategoryMenu } from "./category-menu";

export function DesktopNav() {
	const t = useTranslation();
	return (
		<nav aria-label={t("Shop")} className="hidden xl:block">
			<ul className="flex items-center gap-1">
				<li>
					<Link
						to="/deals"
						className="site-nav-link"
						activeOptions={{ includeSearch: false }}
					>
						{t("Deals")}
					</Link>
				</li>
				<li>
					<CategoryMenu />
				</li>
				{departmentSlugs.map((slug) => (
					<li key={slug}>
						<Link
							to="/$department/{-$category}"
							params={{ department: slug, category: undefined }}
							className="site-nav-link"
							activeOptions={{ includeSearch: false }}
						>
							{t(departments[slug].label)}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
