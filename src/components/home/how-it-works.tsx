import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { Section } from "#/components/layout/container";
import { Eyebrow } from "#/components/layout/eyebrow";
import { LinkButton } from "#/components/link-button";
import { useSceneReveal } from "#/components/motion/use-scene-reveal";
import { useTranslation } from "#/i18n/translate";

const steps = [
	{
		title: "Find your fit",
		body: "Start with a department, then narrow your search by brand, size, colour or budget.",
	},
	{
		title: "Compare the details",
		body: "Check the listed price, available sizes and latest price-check time before adding an item to your cart.",
	},
	{
		title: "Review your order",
		body: "Review shipping, service fees and your final total at checkout before placing your order.",
	},
];

export function HowItWorks() {
	const t = useTranslation();
	const reveal = useSceneReveal();
	return (
		<Section id="how-it-works" className="shopping-guide">
			<div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
				<div className="lg:sticky lg:top-32">
					<Eyebrow className="mb-5">{t("How it works")}</Eyebrow>
					<h2 className="type-title max-w-lg text-[clamp(2.25rem,4vw,3.5rem)]">
						{t("A good find, in three steps.")}
					</h2>
					<LinkButton
						to="/about"
						variant="link"
						className="mt-6 h-auto min-h-11 max-w-full justify-start whitespace-normal px-0 py-3 text-left"
					>
						{t("How we choose our stores")}
						<HugeiconsIcon
							icon={ArrowRight01Icon}
							size={16}
							aria-hidden="true"
						/>
					</LinkButton>
				</div>
				<ol>
					{steps.map((step, index) => (
						<motion.li
							{...reveal}
							key={step.title}
							className="process-step grid grid-cols-[3rem_1fr] gap-5 border-b border-border/70 py-8 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[4rem_1fr]"
						>
							<span
								aria-hidden="true"
								className="type-num text-3xl text-brand/30 sm:text-4xl"
							>
								{String(index + 1).padStart(2, "0")}
							</span>
							<div>
								<h3 className="type-title text-xl sm:text-2xl">
									{t(step.title)}
								</h3>
								<p className="type-body mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
									{t(step.body)}
								</p>
							</div>
						</motion.li>
					))}
				</ol>
			</div>
		</Section>
	);
}
