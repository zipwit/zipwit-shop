import { Input } from "#/components/ui/input";
import { FieldFrame } from "./field-frame";
import type { AdditionalFieldProps } from "./types";
export function NumberField({
	name,
	field,
	value,
	onBlur,
	onChange,
	isInvalid,
	errors,
	isPending,
}: AdditionalFieldProps) {
	const maxFractionDigits = field.formatOptions?.maximumFractionDigits;

	return (
		<FieldFrame name={name} field={field} isInvalid={isInvalid} errors={errors}>
			<Input
				id={name}
				name={name}
				type="number"
				inputMode={maxFractionDigits ? "decimal" : "numeric"}
				min={field.min}
				max={field.max}
				step={
					field.step ??
					(maxFractionDigits ? 1 / 10 ** maxFractionDigits : undefined)
				}
				value={typeof value === "number" ? value : ""}
				onBlur={onBlur}
				onChange={(event) =>
					onChange(
						event.target.value === "" ? null : event.target.valueAsNumber,
					)
				}
				placeholder={field.placeholder}
				required={field.required}
				readOnly={field.readOnly}
				disabled={isPending}
				aria-invalid={isInvalid}
			/>
		</FieldFrame>
	);
}
