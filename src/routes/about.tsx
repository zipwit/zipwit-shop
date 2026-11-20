import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import { SelectionProcess } from "#/components/about/selection-process";
import { Section } from "#/components/layout/container";
import { PageHeader } from "#/components/layout/page-header";
import { LinkButton } from "#/components/link-button";
import { site } from "#/data/site";
import { translate, useTranslation } from "#/i18n/translate";

const description =
	"We select US stores, filter their listings, and bring worthwhile finds together so you can spend less time searching.";

const orderGuide = [
	{
		title: "Sizes and prices",
		body: "Choose a size and colour on the product page before adding the item to your cart. Different sizes of the same model can have different prices.",
	},
	{
		title: "Delivery in the US",
		body: "We deliver to US addresses, including forwarding addresses. Your cart shows a shipping estimate for each store. If a store offers free shipping above a certain amount, only items from that store count towards it.",
	},
	{
		title: "Paying for your order",
		body: "Sign in and select your delivery address to see the final total, including shipping and the service fee. Transfer the amount in dollars or lari, enter the payment reference and upload a screenshot of the transfer.",
	},
] as const;

export const Route = createFileRoute("/about")({
	head: ({ match }) => ({
		meta: [
			{
				title: `${translate("About us", {}, match.context.locale)} | ${site.name}`,
			},
			{
				name: "description",
				content: translate(description, {}, match.context.locale),
			},
		],
	}),
	component: AboutPage,
});

function AboutPage() {
	const t = useTranslation();

	return (
		<>
			<Section spacing="none" className="pt-10 md:pt-14">
				<PageHeader title={t("About us")} description={t(description)} />
			</Section>
			<SelectionProcess />
			<Section
				spacing="compact"
				className="border-t border-foreground/15 bg-card"
			>
				<div className="space-y-7">
					<h2 className="type-title text-3xl">{t("Before you order")}</h2>
					<div className="grid gap-7 md:grid-cols-3 md:gap-10">
						{orderGuide.map(({ title, body }) => (
							<div key={title}>
								<h3 className="type-title text-xl">{t(title)}</h3>
								<p className="type-body mt-3 text-muted-foreground">
									{t(body)}
								</p>
							</div>
						))}
					</div>
					<LinkButton
						to="/deals"
						size="lg"
						className="min-h-12 rounded-none px-6"
					>
						{t("Explore deals")}
						<HugeiconsIcon
							icon={ArrowUpRight01Icon}
							size={16}
							aria-hidden="true"
						/>
					</LinkButton>
				</div>
			</Section>
		</>
	);
}
