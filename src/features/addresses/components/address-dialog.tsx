import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTranslation } from "#/i18n/translate";
import type { Address } from "../address.functions";
import { AddressForm } from "./address-form";

type AddressDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The address being edited; leave out to add a new one. */
	address?: Address;
	/** Adding the account's first address, which is primary automatically. */
	firstAddress?: boolean;
};

/**
 * The add/edit form in a centered dialog. The dialog unmounts its content when it
 * closes, so every opening starts from a fresh form.
 */
export function AddressDialog({
	open,
	onOpenChange,
	address,
	firstAddress = false,
}: AddressDialogProps) {
	const t = useTranslation();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="address-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl p-0 sm:max-w-2xl">
				<DialogHeader className="border-b border-border/70 px-6 pt-7 pb-5 sm:px-8">
					<DialogTitle className="pr-8 text-2xl tracking-tight">
						{address ? t("Edit address") : t("Add address")}
					</DialogTitle>
					<DialogPrimitive.Description className="max-w-md text-sm text-muted-foreground">
						{t("Enter the recipient and delivery address details.")}
					</DialogPrimitive.Description>
				</DialogHeader>

				<AddressForm
					address={address}
					firstAddress={firstAddress}
					onDone={() => onOpenChange(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}
