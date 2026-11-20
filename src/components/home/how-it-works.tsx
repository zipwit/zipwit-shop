import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Section } from "#/components/layout/container";
import { LinkButton } from "#/components/link-button";
import { StepNumber } from "#/components/step-number";
import { useTranslation } from "#/i18n/translate";

const steps = [
	{
		title: "Choose your size and colour",
		body: "A discount can vary between sizes of the same shoe. Open a deal to see the exact option behind the price.",
	},
	{
		title: "Check delivery by store",
		body: "Your cart groups items by store. Each group has its own shipping charge and may qualify for free shipping.",
	},
	{
		title: "Confirm the total",
		body: "Sign in, choose a US delivery address and review shipping and service fees. Checkout gives you a payment reference for your bank transfer.",
	},
];

export function HowItWorks() {
	const t = useTranslation();
	return (
		<Section id="how-it-works" className="shopping-guide scroll-mt-24">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<h2 className="type-title text-[clamp(2rem,4vw,3.5rem)]">
					{t("How it works")}
				</h2>
				<LinkButton
					to="/about"
					variant="link"
					className="min-h-11 whitespace-normal px-0 text-left"
				>
					{t("How we choose deals")}
					<HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden="true" />
				</LinkButton>
			</div>
			<ol className="mt-8 grid gap-7 md:mt-12 md:grid-cols-3 md:gap-10">
				{steps.map((step, index) => (
					<li
						key={step.title}
						className="min-w-0 border-t border-brand/25 pt-5"
					>
						<StepNumber index={index} />
						<h3 className="type-title mt-4 text-xl sm:text-2xl">
							{t(step.title)}
						</h3>
						<p className="type-body mt-3 max-w-md text-muted-foreground">
							{t(step.body)}
						</p>
					</li>
				))}
			</ol>
		</Section>
	);
}
