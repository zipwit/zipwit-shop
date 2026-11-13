import { useAuth, useCopyToClipboard } from "@better-auth-ui/react";
import { toast } from "sonner";
import { Check, Copy } from "#/components/icons";
import { InputGroupButton } from "#/components/ui/input-group";
export function CopyButton({
	getValue,
	isDisabled,
}: {
	getValue: () => string | undefined;
	isDisabled?: boolean;
}) {
	const { localization } = useAuth();
	const { copied, copy } = useCopyToClipboard({
		onError: (error) => {
			console.error("[Better Auth UI] Copy failed", error);
			toast.error(localization.errors.copyFailed);
		},
	});

	async function handleCopy() {
		const value = getValue();
		if (!value) return;

		await copy(value);
	}

	return (
		<InputGroupButton
			aria-label={
				copied
					? localization.settings.copiedToClipboard
					: localization.settings.copyToClipboard
			}
			title={
				copied
					? localization.settings.copiedToClipboard
					: localization.settings.copyToClipboard
			}
			onClick={handleCopy}
			disabled={isDisabled}
		>
			{copied ? <Check /> : <Copy />}
		</InputGroupButton>
	);
}
