import { getFormFieldErrors } from "@better-auth-ui/core";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
} from "#/components/ui/field";
import { Switch } from "#/components/ui/switch";
import type { AdditionalFieldProps } from "./types";
export function SwitchField({
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
			<Switch
				id={name}
				name={name}
				checked={value === true}
				onBlur={onBlur}
				onCheckedChange={onChange}
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
