import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { Section } from "#/components/layout/container";
import { SectionHeader } from "#/components/layout/section-header";
import {
	categories,
	categorySlugs,
	type Department,
	departmentSlugs,
	departments,
} from "#/data/catalog";
import { useTranslation } from "#/i18n/translate";
import { CategoryDiscovery } from "./category-discovery";

const artwork = {
	men: "/images/department-men-3d.webp",
	women: "/images/department-women-3d.webp",
	kids: "/images/department-kids-3d.webp",
} satisfies Record<Department, string>;

/** Big typographic tiles: the whole tile opens the department, the chips jump to a category. */
export function DepartmentTiles() {
	const t = useTranslation();

	return (
		<Section id="departments" className="scroll-mt-28" spacing="compact">
			<CategoryDiscovery />
			<SectionHeader
				title={t("Shop by department")}
				description={t("Shoes, clothing and accessories for the whole family.")}
			/>

			<ul className="mt-8 grid gap-5 md:mt-10 md:grid-cols-3 md:gap-6">
				{departmentSlugs.map((slug) => (
					<li
						key={slug}
						className="department-tile group relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-6 lg:p-8"
					>
						<div className="pointer-events-none mx-auto mb-5 aspect-square w-full max-w-72 select-none">
							<img
								src={artwork[slug]}
								width={800}
								height={800}
								alt=""
								loading="lazy"
								decoding="async"
								className="h-full w-full object-contain"
							/>
						</div>

						<h3 className="type-title text-2xl lg:text-3xl">
							<Link
								to="/$department/{-$category}"
								params={{ department: slug, category: undefined }}
								className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-brand"
							>
								{t(departments[slug].label)}
							</Link>
						</h3>

						<div className="mt-5 flex items-end justify-between gap-4">
							<ul className="flex flex-wrap gap-2">
								{categorySlugs.map((category) => (
									<li key={category}>
										<Link
											to="/$department/{-$category}"
											params={{ department: slug, category }}
											className="relative z-10 block rounded-full border border-brand/10 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/25 hover:bg-brand/5 hover:text-brand"
										>
											{t(categories[category].label)}
										</Link>
									</li>
								))}
							</ul>
							<HugeiconsIcon
								icon={ArrowUpRight01Icon}
								aria-hidden="true"
								size={28}
								className="shrink-0 text-brand transition-transform duration-300 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1"
							/>
						</div>
					</li>
				))}
			</ul>
		</Section>
	);
}
