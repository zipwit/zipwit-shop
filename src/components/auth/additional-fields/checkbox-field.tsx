import { getFormFieldErrors } from "@better-auth-ui/core";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
} from "#/components/ui/field";
import type { AdditionalFieldProps } from "./types";
export function CheckboxField({
	name,
	field,
	value,
	onBlur,
	onChange,
	isInvalid,
	errors,
	isPending,
}: AdditionalFieldProps) {
	const fieldErrors = getFormFieldErrors(errors ?? []);
	return (
		<Field data-invalid={isInvalid} orientation="horizontal">
			<Checkbox
				id={name}
				name={name}
				checked={value === true}
				onBlur={onBlur}
				onCheckedChange={(checked) => onChange(checked === true)}
				required={field.required}
				disabled={isPending || field.readOnly}
				aria-invalid={isInvalid}
			/>

			<FieldContent>
				<FieldLabel htmlFor={name}>{field.label}</FieldLabel>
			</FieldContent>
			<FieldError errors={fieldErrors} />
		</Field>
	);
}
