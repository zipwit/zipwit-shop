import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "#/components/ui/combobox";
import { useMessages } from "#/i18n/messages";
import { FieldFrame } from "./field-frame";
import type { AdditionalFieldProps } from "./types";
import { valueToString } from "./values";
export function ComboboxField({
	name,
	field,
	value,
	onBlur,
	onChange,
	isInvalid,
	errors,
	isPending,
}: AdditionalFieldProps) {
	const messages = useMessages();
	const selectedOption = field.options?.find(
		(option) => option.value === valueToString(value),
	);

	return (
		<FieldFrame name={name} field={field} isInvalid={isInvalid} errors={errors}>
			<Combobox
				items={field.options ?? []}
				name={name}
				value={selectedOption ?? null}
				onValueChange={(option) => onChange(option?.value ?? null)}
				required={field.required}
				disabled={isPending || field.readOnly}
			>
				<ComboboxInput
					placeholder={field.placeholder}
					id={name}
					onBlur={onBlur}
					aria-invalid={isInvalid}
				/>

				<ComboboxContent>
					<ComboboxEmpty>{messages.form.noItems}</ComboboxEmpty>

					<ComboboxList>
						{(option) => (
							<ComboboxItem key={option.value} value={option}>
								{option.label}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</FieldFrame>
	);
}
