import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { FieldFrame } from "./field-frame";
import type { AdditionalFieldProps } from "./types";
import { valueToString } from "./values";
export function SelectField({
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
			<Select
				name={name}
				value={valueToString(value) || undefined}
				onValueChange={(nextValue) => onChange(nextValue)}
				required={field.required}
				disabled={isPending || field.readOnly}
			>
				<SelectTrigger
					id={name}
					className="w-full"
					onBlur={onBlur}
					aria-invalid={isInvalid}
				>
					<SelectValue placeholder={field.placeholder} />
				</SelectTrigger>

				<SelectContent>
					{field.options?.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FieldFrame>
	);
}
