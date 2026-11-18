import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { departmentSlugs, departments } from "#/data/catalog";
import { site } from "#/data/site";
import { socials } from "#/data/socials";
import { useTranslation } from "#/i18n/translate";
import { Container } from "./container";

function FooterHeading({ children }: { children: string }) {
	return (
		<h3 className="font-semibold text-brand text-xs uppercase tracking-[0.16em]">
			{children}
		</h3>
	);
}

export function Footer() {
	const t = useTranslation();
	const links = socials.flatMap((s) =>
		s.href ? [{ ...s, href: s.href }] : [],
	);

	return (
		<footer className="footer-scene text-foreground">
			<Container className="grid grid-cols-2 gap-x-8 gap-y-10 py-14 md:grid-cols-4 md:gap-12 md:py-18">
				<div className="col-span-full border-b border-border/70 pb-10 md:pb-14">
					<p className="type-eyebrow mb-5 text-muted-foreground">
						{t("Your next find starts here")}
					</p>
					<h2 className="type-title text-[clamp(2rem,4.5vw,4rem)]">
						<Link
							to="/"
							hash="departments"
							className="group flex items-center justify-between gap-8 hover:text-brand"
						>
							{t("Find your next favourite.")}
							<HugeiconsIcon
								icon={ArrowUpRight01Icon}
								size={40}
								className="shrink-0 text-brand transition-transform duration-300 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1"
							/>
						</Link>
					</h2>
				</div>
				<div className="col-span-2">
					<img
						src="/images/zipwit-offers.webp"
						srcSet="/images/zipwit-offers-small.webp 600w, /images/zipwit-offers.webp 962w"
						sizes="160px"
						width={962}
						height={448}
						alt={site.name}
						loading="lazy"
						className="block h-auto w-40 max-w-full rounded-xl object-contain"
					/>
					<p className="mt-5 max-w-sm text-sm leading-7 text-foreground/60">
						{t(site.pitch)}
					</p>

					{links.length > 0 && (
						<ul className="mt-6 flex flex-wrap items-center gap-3">
							{links.map((s) => (
								<li key={s.label}>
									<a
										href={s.href}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={s.label}
										title={s.label}
										className="flex size-11 items-center justify-center rounded-md border border-brand/15 bg-card/70 text-brand transition-colors hover:border-brand hover:bg-brand hover:text-brand-foreground"
									>
										<HugeiconsIcon icon={s.icon} size={20} aria-hidden="true" />
									</a>
								</li>
							))}
						</ul>
					)}
				</div>

				<div>
					<FooterHeading>{t("Shop")}</FooterHeading>
					<ul className="mt-5 space-y-3 text-sm">
						<li>
							<Link to="/deals" className="text-foreground/70 hover:text-brand">
								{t("All deals")}
							</Link>
						</li>
						{departmentSlugs.map((slug) => (
							<li key={slug}>
								<Link
									to="/$department/{-$category}"
									params={{ department: slug, category: undefined }}
									className="text-foreground/70 transition-colors hover:text-brand"
								>
									{t(departments[slug].label)}
								</Link>
							</li>
						))}
					</ul>
				</div>

				<div>
					<FooterHeading>{t("Discover")}</FooterHeading>
					<ul className="mt-5 space-y-3 text-sm text-foreground/70">
						<li>
							<Link to="/about" className="transition-colors hover:text-brand">
								{t("About us")}
							</Link>
						</li>
					</ul>
				</div>
			</Container>

			<div className="border-border/60 border-t">
				<Container className="flex flex-col gap-3 py-6 text-foreground/50 text-xs leading-relaxed md:flex-row md:justify-between md:gap-10">
					<p className="md:text-left">
						© {new Date().getFullYear()} {site.name}.{" "}
						{t("All rights reserved.")}
					</p>
					<p className="md:text-right">
						{t(
							"Prices and availability can change. Brand names belong to their owners, and {{brand}} is not affiliated with them.",
							{ brand: site.name },
						)}
					</p>
				</Container>
			</div>
		</footer>
	);
}
