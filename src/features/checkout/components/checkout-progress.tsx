import { Check } from "#/components/icons";
import { useTranslation } from "#/i18n/translate";
import { cn } from "#/lib/utils";

const steps = ["Delivery address", "Bank transfer", "Payment proof"];
export function CheckoutProgress({ step }: { step: number }) {
	const t = useTranslation();
	return (
		<ol
			aria-label={t("Checkout steps")}
			className="mb-8 grid grid-cols-3 gap-3 sm:gap-6"
		>
			{steps.map((label, index) => (
				<li
					key={label}
					aria-current={step === index + 1 ? "step" : undefined}
					className={cn(
						"min-w-0 border-t-2 pt-3",
						step === index + 1
							? "border-foreground"
							: step > index + 1
								? "border-price"
								: "border-border",
					)}
				>
					<span
						className={cn(
							"mb-2 flex size-7 items-center justify-center rounded-full text-xs font-semibold",
							step === index + 1
								? "bg-foreground text-background"
								: step > index + 1
									? "bg-price-savings text-price"
									: "bg-muted text-muted-foreground",
						)}
						aria-hidden="true"
					>
						{step > index + 1 ? <Check className="size-4" /> : index + 1}
					</span>
					<span
						className={cn(
							"block wrap-anywhere text-xs leading-relaxed sm:text-sm",
							step === index + 1 ? "font-semibold" : "text-muted-foreground",
						)}
					>
						{t(label)}
					</span>
				</li>
			))}
		</ol>
	);
}
