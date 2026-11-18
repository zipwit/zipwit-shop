import { useEffect, useRef } from "react";
import { Container } from "#/components/layout/container";
import { LinkButton } from "#/components/link-button";
import { useCart } from "#/features/cart/use-cart";
import { useTranslation } from "#/i18n/translate";
import type { checkoutPageFn } from "../checkout.functions";
import { useCheckout } from "../use-checkout";
import { DeliveryAddress } from "./checkout-address";
import { CheckoutDelivery } from "./checkout-delivery";
import { CheckoutPayment } from "./checkout-payment";
import { CheckoutProgress } from "./checkout-progress";
import { CheckoutProof } from "./checkout-proof";
import { CheckoutReceipt } from "./checkout-receipt";
import { CartSummary, OrderSummary } from "./order-summary";

type PageData = Omit<Awaited<ReturnType<typeof checkoutPageFn>>, "checkout"> & {
	checkoutId?: string;
};
const stepTitles = [
	"Choose your U.S. delivery address",
	"Transfer the exact amount",
	"Upload your payment screenshot",
];

export function CheckoutPage({
	data,
	requestedId,
}: {
	data: PageData;
	requestedId?: string;
}) {
	const t = useTranslation();
	if (!data.userId)
		return (
			<Container className="max-w-xl space-y-5 py-16 text-center">
				<p className="type-eyebrow text-muted-foreground">
					{t("One step closer to your next find")}
				</p>
				<h1 className="type-title text-3xl">{t("Checkout")}</h1>
				<p className="text-muted-foreground">
					{t("Sign in to save your delivery address and place an order.")}
				</p>
				<LinkButton
					to="/auth/$path"
					params={{ path: "sign-in" }}
					search={{
						redirectTo: requestedId
							? `/checkout?checkout=${requestedId}`
							: "/checkout",
					}}
				>
					{t("Sign in")}
				</LinkButton>
			</Container>
		);
	return (
		<CheckoutFlow
			key={`${data.userId}:${data.checkoutId ?? "new"}`}
			data={data}
			userId={data.userId}
		/>
	);
}

function CheckoutFlow({ data, userId }: { data: PageData; userId: string }) {
	const t = useTranslation();
	const cart = useCart();
	const flow = useCheckout(userId, data.checkoutId);
	const { checkout, step, busy, error } = flow;
	const heading = useRef<HTMLHeadingElement>(null);
	const previousStep = useRef(1);
	const submittedAt = checkout?.submittedAt;
	useEffect(() => {
		if (step !== previousStep.current || submittedAt) heading.current?.focus();
		previousStep.current = step;
	}, [step, submittedAt]);

	if (checkout?.submittedAt)
		return (
			<CheckoutReceipt
				checkout={{ ...checkout, submittedAt: checkout.submittedAt }}
				heading={heading}
			/>
		);
	if (data.checkoutId && !checkout) {
		return (
			<Container className="py-12">
				<h1 className="type-title text-3xl">{t("Checkout")}</h1>
				<p role={error ? "alert" : "status"}>{error ?? t("Loading…")}</p>
			</Container>
		);
	}

	return (
		<Container className="max-w-6xl py-8 md:py-12">
			<div className="mb-8 max-w-2xl space-y-3">
				<p className="type-eyebrow text-muted-foreground">
					{t("U.S. delivery · Bank transfer")}
				</p>
				<h1 className="type-title text-3xl md:text-4xl">{t("Checkout")}</h1>
				<p className="text-sm leading-relaxed text-muted-foreground">
					{t("We deliver only to your U.S. address.")}
				</p>
			</div>
			<CheckoutProgress step={step} />
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
				<section
					aria-labelledby="checkout-step-title"
					className="min-w-0 space-y-5 rounded-lg border bg-card p-5 shadow-sm sm:p-7"
				>
					<h2
						id="checkout-step-title"
						ref={heading}
						tabIndex={-1}
						className="type-title scroll-mt-24 text-xl outline-none"
					>
						{t(stepTitles[step - 1] ?? "Checkout")}
					</h2>
					{error && (
						<p
							role="alert"
							className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
						>
							{error}
						</p>
					)}
					{step === 1 && (
						<CheckoutDelivery
							userId={userId}
							initialAddresses={data.addresses}
							ready={data.ready}
							busy={busy}
							onPrepare={flow.prepare}
						/>
					)}
					{step === 2 && checkout && (
						<CheckoutPayment
							checkout={checkout}
							onContinue={() => flow.setStep(3)}
						/>
					)}
					{step === 3 && checkout && (
						<CheckoutProof
							uploaded={checkout.proofUploaded}
							busy={busy}
							uploadFailed={flow.uploadFailed}
							onUpload={flow.upload}
							onSubmit={flow.submit}
							onBack={() => flow.setStep(2)}
						/>
					)}
				</section>
				<aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
					{checkout ? (
						<OrderSummary quote={checkout.quote} />
					) : (
						<CartSummary cart={cart} />
					)}
					{checkout && (
						<div className="rounded-lg bg-muted/50 p-5">
							<h2 className="mb-3 text-sm font-semibold">
								{t("Delivery address")}
							</h2>
							<DeliveryAddress address={checkout.address} />
						</div>
					)}
				</aside>
			</div>
		</Container>
	);
}
