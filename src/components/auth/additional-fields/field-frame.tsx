import { getFormFieldErrors } from "@better-auth-ui/core";
import type { ReactNode } from "react";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import type { AdditionalFieldProps } from "./types";

export function FieldFrame({
	name,
	field,
	isInvalid,
	errors,
	children,
}: Pick<AdditionalFieldProps, "name" | "field" | "isInvalid" | "errors"> & {
	children: ReactNode;
}) {
	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={name}>{field.label}</FieldLabel>
			{children}
			<FieldError errors={getFormFieldErrors(errors ?? [])} />
		</Field>
	);
}
