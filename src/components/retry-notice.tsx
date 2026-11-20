import { Button } from "#/components/ui/button";
import { useTranslation } from "#/i18n/translate";
import { cn } from "#/lib/utils";

/** Pairs a load error with its retry action and disables repeated retries while a request is pending. */
export function RetryNotice({
	message,
	onRetry,
	retrying,
	className,
}: {
	message: string;
	onRetry: () => void;
	retrying: boolean;
	className?: string;
}) {
	const t = useTranslation();
	return (
		<div className={cn("flex flex-wrap items-center gap-3", className)}>
			<p role="alert" className="text-sm">
				{message}
			</p>
			<Button
				type="button"
				variant="outline"
				disabled={retrying}
				onClick={onRetry}
			>
				{retrying ? t("Trying again…") : t("Try again")}
			</Button>
		</div>
	);
}
