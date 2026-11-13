import type { Ref } from "react";
import { CircleCheckIcon } from "#/components/icons";
import { Container } from "#/components/layout/container";
import { LinkButton } from "#/components/link-button";
import { formatStoreDateTime } from "#/i18n/format";
import { useLocale } from "#/i18n/locale";
import { useTranslation } from "#/i18n/translate";
import type { CheckoutView } from "../checkout";
import { OrderSummary } from "./order-summary";
export function CheckoutReceipt({
	checkout,
	heading,
}: {
	checkout: CheckoutView & { submittedAt: string };
	heading: Ref<HTMLHeadingElement>;
}) {
	const t = useTranslation();
	const locale = useLocale();
	return (
		<Container className="max-w-3xl space-y-7 py-12 md:py-16">
			<div className="space-y-4 rounded-2xl border border-price/20 bg-price-savings p-6 sm:p-8">
				<CircleCheckIcon className="size-10 text-price" aria-hidden="true" />
				<p className="type-eyebrow text-price">{t("Order received")}</p>
				<h1
					ref={heading}
					tabIndex={-1}
					className="type-title text-3xl outline-none"
				>
					{t("Payment awaiting verification")}
				</h1>
				<p className="text-sm leading-relaxed">
					{t(
						"We received your order and payment screenshot. We will verify the bank transfer before processing your order.",
					)}
				</p>
				<p className="text-sm">
					{t("Order ID")}:{" "}
					<span className="break-all font-mono select-all">{checkout.id}</span>
				</p>
				<p className="text-sm text-muted-foreground">
					{formatStoreDateTime(checkout.submittedAt, locale)}
				</p>
			</div>
			<OrderSummary quote={checkout.quote} />
			<LinkButton to="/">{t("Continue shopping")}</LinkButton>
		</Container>
	);
}
