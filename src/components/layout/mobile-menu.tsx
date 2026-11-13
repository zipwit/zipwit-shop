import { MenuCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "#/components/ui/sheet";
import { departmentSlugs, departments } from "#/data/catalog";
import { CategoryLinks } from "#/features/catalog/components/category-links";
import { useTranslation } from "#/i18n/translate";
export function MobileMenu() {
	const t = useTranslation();
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				render={
					<Button
						variant="outline"
						size="icon"
						className="xl:hidden"
						aria-label={t("Open menu")}
					/>
				}
			>
				<HugeiconsIcon icon={MenuCircleIcon} size={20} />
			</SheetTrigger>
			<SheetContent side="left" className="overflow-y-auto overscroll-contain">
				<SheetHeader>
					<SheetTitle>{t("Menu")}</SheetTitle>
				</SheetHeader>
				<nav aria-label={t("Shop")} className="flex flex-col gap-2 px-5 pb-8">
					<Link
						to="/deals"
						onClick={() => setOpen(false)}
						activeOptions={{ includeSearch: false }}
						className="category-link font-semibold"
					>
						{t("All deals")}
					</Link>
					<div className="border-t py-4">
						<p className="mb-3 px-4 text-xs font-semibold text-muted-foreground">
							{t("Shop by category")}
						</p>
						<CategoryLinks onNavigate={() => setOpen(false)} />
					</div>
					{departmentSlugs.map((slug) => (
						<div key={slug} className="border-t pt-2">
							<Link
								to="/$department/{-$category}"
								params={{ department: slug, category: undefined }}
								onClick={() => setOpen(false)}
								activeOptions={{ exact: true, includeSearch: false }}
								className="category-link mb-3 font-semibold"
							>
								{t(departments[slug].label)}
							</Link>
							<CategoryLinks
								department={slug}
								includeAll={false}
								onNavigate={() => setOpen(false)}
							/>
						</div>
					))}
				</nav>
			</SheetContent>
		</Sheet>
	);
}
