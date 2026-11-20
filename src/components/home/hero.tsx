import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Container } from "#/components/layout/container";
import { LinkButton } from "#/components/link-button";
import { buttonVariants } from "#/components/ui/button";
import { site } from "#/data/site";
import { SkewTag } from "#/features/catalog/components/skew-tag";
import type { Stats } from "#/features/stats/stats.schema";
import { formatCount } from "#/i18n/format";
import { useLocale } from "#/i18n/locale";
import { useTranslation } from "#/i18n/translate";
import { cn } from "#/lib/utils";

type HeroProps = {
	stats: Stats;
	/** Biggest discount among today's deals, if there are any. */
	topDiscount?: number;
};

export function Hero({ stats, topDiscount }: HeroProps) {
	const t = useTranslation();
	const locale = useLocale();
	const lines = t(site.tagline).match(/[^.]+(?:\.|$)/g) ?? [t(site.tagline)];

	const items = [
		{
			label: t("Deals live now"),
			value: formatCount(stats.deals, locale),
		},
		{
			label: t("Warehouses checked"),
			value: formatCount(stats.warehouses, locale),
		},
	];

	return (
		<section className="hero-scene relative isolate overflow-hidden py-6 sm:py-12 lg:py-16">
			<Container>
				<div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-12 xl:gap-16">
					<div className="relative z-10 min-w-0">
						{topDiscount ? (
							<SkewTag className="mb-5 text-sm">
								{t("Up to {{discount}}% off today", { discount: topDiscount })}
							</SkewTag>
						) : null}

						<h1 className="hero-headline font-display text-[clamp(2.125rem,4.5vw,4.25rem)] leading-[1.03] font-[790] tracking-[-0.065em] [&>span:last-child]:text-brand">
							{lines.map((line) => (
								<span key={line} className="block">
									{line.trim()}
								</span>
							))}
						</h1>

						<p className="type-body mt-6 max-w-[43ch] text-base text-muted-foreground sm:text-lg">
							{t(site.heroPitch)}
						</p>

						<div className="mt-8 flex flex-wrap items-center gap-3">
							{topDiscount ? (
								<a
									href="#deals"
									className={cn(
										buttonVariants({ size: "lg" }),
										"h-auto min-h-12 max-w-full whitespace-normal rounded-none px-6 py-3 text-center font-semibold",
									)}
								>
									{t("See today's biggest drops")}
									<HugeiconsIcon icon={ArrowDown01Icon} size={16} />
								</a>
							) : (
								<LinkButton
									to="/deals"
									size="lg"
									className="min-h-12 rounded-none px-6"
								>
									{t("All deals")}
								</LinkButton>
							)}
							<a
								href="#departments"
								className={cn(
									buttonVariants({ variant: "ghost", size: "lg" }),
									"h-auto min-h-12 whitespace-normal rounded-none border border-brand/30 px-5 py-3 text-brand",
								)}
							>
								{t("Shop by department")}
							</a>
						</div>
						<dl className="mt-8 flex w-fit max-w-full flex-wrap gap-x-8 gap-y-3 border-t border-foreground/20 pt-4 sm:gap-x-12">
							{items.map((item) => (
								<div key={item.label} className="flex flex-col-reverse gap-1">
									<dt className="text-xs text-muted-foreground">
										{item.label}
									</dt>
									<dd className="type-num text-xl text-foreground sm:text-2xl">
										{item.value}
									</dd>
								</div>
							))}
						</dl>
					</div>
					<div
						className="hero-board order-first aspect-[1.44] lg:order-none lg:aspect-[1.16]"
						aria-hidden="true"
					>
						<svg
							className="absolute inset-0 size-full"
							viewBox="0 0 620 535"
							preserveAspectRatio="xMidYMid slice"
							fill="none"
							aria-hidden="true"
							focusable="false"
						>
							<path
								d="M0 433h620M0 458h620M0 487h620M0 522h620M310 408 23 535m287-127-150 127m150-127-49 127m49-127 49 127m-49-127 150 127m-150-127 287 127"
								stroke="#bcaaff"
								strokeOpacity=".26"
							/>
							<circle
								cx="310"
								cy="253"
								r="174"
								stroke="#ab91ff"
								strokeOpacity=".75"
							/>
							<circle
								cx="310"
								cy="253"
								r="195"
								stroke="#ab91ff"
								strokeOpacity=".45"
								strokeDasharray="3 7"
							/>
							<path
								d="M92 331c-39-35 31-112 156-171 125-60 258-85 296-50 39 35-31 112-156 171-125 60-258 85-296 50Z"
								stroke="#dff267"
								strokeOpacity=".7"
							/>
							<path
								d="M48 118V47h71m386 0h67v71M48 382v71h71m386 0h67v-71"
								stroke="#c8b8ff"
								strokeOpacity=".55"
							/>
							<path
								d="M52 168h35m-17-17v34m452 166h32m-16-16v32M448 84h24m-12-12v24"
								stroke="#dff267"
							/>
							<path
								d="M26 487h89l-19 19H26m501-40h67v69"
								stroke="#dff267"
								strokeOpacity=".85"
							/>
							<circle cx="133" cy="133" r="4" fill="#dff267" />
							<circle cx="517" cy="301" r="3" fill="#c8b8ff" />
						</svg>
						<img
							src="/images/hero-fashion-3d.webp"
							srcSet="/images/hero-fashion-3d-small.webp 640w, /images/hero-fashion-3d.webp 1120w"
							sizes="(min-width: 1280px) 605px, (min-width: 1024px) 47vw, calc(100vw - 40px)"
							width={1120}
							height={1120}
							alt=""
							fetchPriority="high"
							className="hero-product-art"
						/>
						<svg
							className="pointer-events-none absolute inset-0 size-full"
							aria-hidden="true"
							viewBox="0 0 620 535"
							preserveAspectRatio="xMidYMid slice"
							fill="none"
							focusable="false"
						>
							<defs>
								<linearGradient
									id="hero-orbit-sheen"
									x1="82"
									y1="381"
									x2="565"
									y2="185"
									gradientUnits="userSpaceOnUse"
								>
									<stop stopColor="#9273dd" stopOpacity=".12" />
									<stop offset=".27" stopColor="#bc9ff8" />
									<stop offset=".44" stopColor="#fcf7ff" />
									<stop offset=".52" stopColor="#a78ec9" />
									<stop offset=".81" stopColor="#e5f47c" />
									<stop offset="1" stopColor="#dff267" stopOpacity=".15" />
								</linearGradient>
							</defs>
							<path
								d="M64 346C21 436 265 389 465 270C540 225 579 184 567 168C582 191 527 242 450 285C247 403 17 439 64 346Z"
								fill="url(#hero-orbit-sheen)"
							/>
						</svg>
					</div>
				</div>
			</Container>
		</section>
	);
}
