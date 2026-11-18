import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { useId, useMemo } from "react";
import { useAppForm } from "#/components/form/app-form";
import { useSceneReveal } from "#/components/motion/use-scene-reveal";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "#/components/ui/field";
import { Switch } from "#/components/ui/switch";
import { useLocale } from "#/i18n/locale";
import { useTranslation } from "#/i18n/translate";
import type { Address } from "../address.functions";
import { createAddressSchema } from "../address.schema";
import { useSaveAddress } from "../use-addresses";

const textFields = [
	{ name: "fullName", label: "Name", autoComplete: "name", required: true },
	{
		name: "phone",
		label: "Tel",
		autoComplete: "tel",
		type: "tel",
		required: true,
	},
	{
		name: "line1",
		label: "Address 1",
		autoComplete: "address-line1",
		required: true,
	},
	{
		name: "line2",
		label: "Address 2",
		autoComplete: "address-line2",
		description: "Apartment, suite, or forwarding account number (optional).",
	},
	{
		name: "city",
		label: "City",
		autoComplete: "address-level2",
		required: true,
	},
	{
		name: "state",
		label: "State",
		autoComplete: "address-level1",
		required: true,
	},
	{
		name: "postalCode",
		label: "ZIP",
		autoComplete: "postal-code",
		required: true,
	},
	{
		name: "country",
		label: "Country",
		autoComplete: "country-name",
		required: true,
	},
] as const;

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

function primaryHint(
	address: Address | undefined,
	firstAddress: boolean,
	t: ReturnType<typeof useTranslation>,
) {
	if (address?.isPrimary) {
		return t(
			"This is your primary address. Make another address primary to change it.",
		);
	}
	if (firstAddress) return t("Your first address is primary automatically.");
	return t("Make this your default delivery address.");
}

type AddressFormProps = {
	address?: Address;
	firstAddress: boolean;
	onDone: () => void;
};

function AddressForm({ address, firstAddress, onDone }: AddressFormProps) {
	const locale = useLocale();
	const reveal = useSceneReveal();
	const addressSchema = useMemo(() => createAddressSchema(locale), [locale]);
	const t = useTranslation();
	const save = useSaveAddress();
	const primaryId = useId();
	const lockedPrimary = Boolean(address?.isPrimary) || firstAddress;

	const form = useAppForm({
		defaultValues: {
			fullName: address?.fullName ?? "",
			phone: address?.phone ?? "",
			line1: address?.line1 ?? "",
			line2: address?.line2 ?? "",
			city: address?.city ?? "",
			state: address?.state ?? "",
			country: address?.country ?? "United States",
			postalCode: address?.postalCode ?? "",
			isPrimary: lockedPrimary,
		},
		validators: { onChange: addressSchema },
		onSubmit: async ({ value }) => {
			await save.mutateAsync({ id: address?.id, address: value });
			onDone();
		},
	});

	return (
		<form.AppForm>
			<form.FormRoot className="flex min-h-0 flex-1 flex-col">
				<motion.div {...reveal} className="px-6 sm:px-8">
					<FieldGroup className="gap-5 pb-6">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{textFields.map(({ name, ...props }) => (
								<div
									key={name}
									className={
										name === "line1" || name === "line2"
											? "sm:col-span-2"
											: undefined
									}
								>
									<form.AppField name={name}>
										{(field) => (
											<field.FormTextField
												{...props}
												className="h-12 bg-background/60"
												label={t(props.label)}
												description={
													"description" in props
														? t(props.description)
														: undefined
												}
												disabled={save.isPending}
											/>
										)}
									</form.AppField>
								</div>
							))}
						</div>

						<form.AppField name="isPrimary">
							{(field) => (
								<Field
									orientation="horizontal"
									className="rounded-md border border-border/70 bg-background/60 p-4"
								>
									<FieldContent>
										<FieldLabel htmlFor={primaryId}>
											{t("Use as primary address")}
										</FieldLabel>
										<FieldDescription>
											{primaryHint(address, firstAddress, t)}
										</FieldDescription>
									</FieldContent>
									<Switch
										id={primaryId}
										name={field.name}
										onBlur={field.handleBlur}
										checked={field.state.value}
										disabled={lockedPrimary || save.isPending}
										onCheckedChange={field.handleChange}
									/>
								</Field>
							)}
						</form.AppField>

						<form.FormServerError />
					</FieldGroup>
				</motion.div>

				<div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t bg-popover px-6 py-4 sm:px-8">
					<Button
						type="button"
						variant="outline"
						className="h-11 px-5"
						disabled={save.isPending}
						onClick={onDone}
					>
						{t("Cancel")}
					</Button>
					<form.FormSubmitButton
						className="h-11 px-6"
						isPending={save.isPending}
					>
						{address ? t("Save changes") : t("Save address")}
					</form.FormSubmitButton>
				</div>
			</form.FormRoot>
		</form.AppForm>
	);
}
