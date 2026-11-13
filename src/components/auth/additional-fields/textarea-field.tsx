import { Textarea } from "#/components/ui/textarea";
import { FieldFrame } from "./field-frame";
import type { AdditionalFieldProps } from "./types";
import { valueToString } from "./values";
export function TextareaField({
	name,
	field,
	value,
	onBlur,
	onChange,
	isInvalid,
	errors,
	isPending,
}: AdditionalFieldProps) {
	return (
		<FieldFrame name={name} field={field} isInvalid={isInvalid} errors={errors}>
			<Textarea
				id={name}
				name={name}
				value={valueToString(value)}
				onBlur={onBlur}
				onChange={(event) => onChange(event.target.value || null)}
				placeholder={field.placeholder}
				required={field.required}
				readOnly={field.readOnly}
				disabled={isPending}
				aria-invalid={isInvalid}
			/>
		</FieldFrame>
	);
}
