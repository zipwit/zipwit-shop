import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	motion,
	useReducedMotion,
	useScroll,
	useTransform,
} from "motion/react";
import { useRef } from "react";
import { Container } from "#/components/layout/container";
import { LinkButton } from "#/components/link-button";
import { sceneEase } from "#/components/motion/use-scene-reveal";
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
	const scene = useRef<HTMLElement>(null);
	const reduced = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: scene,
		offset: ["start start", "end start"],
	});
	const artY = useTransform(scrollYProgress, [0, 1], [0, 64]);
	const entrance = (delay: number) => ({
		initial: { opacity: 1, y: 0 },
		animate: reduced ? { opacity: 1, y: 0 } : { opacity: [0.4, 1], y: [28, 0] },
		transition: {
			type: "tween" as const,
			duration: reduced ? 0 : 1,
			delay: reduced ? 0 : delay,
			ease: sceneEase,
		},
	});
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
		<section
			ref={scene}
			className="hero-scene relative isolate flex items-center overflow-hidden pt-10 pb-12 sm:pt-14 sm:pb-16 lg:min-h-160 lg:pt-12 lg:pb-18"
		>
			<Container>
				<div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
					<div className="relative z-10 min-w-0">
						{topDiscount ? (
							<SkewTag className="text-sm shadow-lg">
								{t("Up to {{discount}}% off today", { discount: topDiscount })}
							</SkewTag>
						) : null}

						<motion.h1
							{...entrance(0.08)}
							className="type-display mt-6 max-w-3xl text-[clamp(2.75rem,5.2vw,4.5rem)] leading-[1.12] [&>span:last-child]:text-brand"
						>
							{lines.map((line) => (
								<span key={line} className="block">
									{line.trim()}
								</span>
							))}
						</motion.h1>

						<motion.p
							{...entrance(0.18)}
							className="type-body mt-6 max-w-[43ch] text-base text-muted-foreground sm:text-lg"
						>
							{t(site.heroPitch)}
						</motion.p>

						<motion.div
							{...entrance(0.28)}
							className="mt-8 flex flex-wrap items-center gap-3"
						>
							{topDiscount ? (
								<a
									href="#deals"
									className={cn(
										buttonVariants({ size: "lg" }),
										"h-auto min-h-12 max-w-full whitespace-normal rounded-xl px-7 py-3 text-center text-sm font-semibold shadow-brand hover:shadow-brand-hover sm:min-h-13 sm:px-7",
									)}
								>
									{t("See today's biggest drops")}
									<HugeiconsIcon icon={ArrowDown01Icon} size={16} />
								</a>
							) : (
								<LinkButton
									to="/deals"
									size="lg"
									className="shadow-brand hover:shadow-brand-hover"
								>
									{t("All deals")}
								</LinkButton>
							)}
							<a
								href="#departments"
								className={cn(
									buttonVariants({ variant: "ghost", size: "lg" }),
									"h-auto min-h-12 whitespace-normal rounded-xl px-5 py-3 text-brand",
								)}
							>
								{t("Shop by department")}
							</a>
						</motion.div>
						<motion.dl
							{...entrance(0.38)}
							className="mt-10 flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-12"
						>
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
						</motion.dl>
					</div>
					<motion.div
						style={{ y: reduced ? 0 : artY }}
						aria-hidden="true"
						className="hero-art-stage pointer-events-none relative isolate mx-auto aspect-square w-full max-w-96 select-none sm:max-w-112 lg:max-w-none lg:scale-[1.08]"
					>
						<div className="hero-orbit" />
						<motion.img
							{...entrance(0.12)}
							src="/images/hero-fashion-3d.webp"
							srcSet="/images/hero-fashion-3d-small.webp 640w, /images/hero-fashion-3d.webp 1120w"
							sizes="(min-width: 1280px) 560px, (min-width: 1024px) 45vw, (min-width: 640px) 448px, calc(100vw - 40px)"
							width={1120}
							height={1120}
							alt=""
							fetchPriority="high"
							className="relative h-full w-full object-contain"
						/>
					</motion.div>
				</div>
			</Container>
		</section>
	);
}
