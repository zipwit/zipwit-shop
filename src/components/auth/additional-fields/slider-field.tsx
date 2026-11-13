import { getFormFieldErrors } from "@better-auth-ui/core";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Slider } from "#/components/ui/slider";
import { languageTags, useLocale } from "#/i18n/locale";
import type { AdditionalFieldProps } from "./types";
export function SliderField({
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
	const min = field.min ?? 0;
	const max = field.max ?? 100;
	const step =
		field.step ?? (maxFractionDigits ? 1 / 10 ** maxFractionDigits : 1);
	const numericValue = typeof value === "number" ? value : min;
	const fieldErrors = getFormFieldErrors(errors ?? []);

	const locale = useLocale();
	const formatter = new Intl.NumberFormat(
		languageTags[locale],
		field.formatOptions,
	);

	return (
		<Field data-invalid={isInvalid}>
			<div className="flex items-center justify-between gap-2">
				<FieldLabel htmlFor={name}>{field.label}</FieldLabel>
				<span className="text-sm text-muted-foreground tabular-nums">
					{formatter.format(numericValue)}
				</span>
			</div>

			<Slider
				id={name}
				name={name}
				value={[numericValue]}
				onBlur={onBlur}
				onValueChange={(nextValue) =>
					onChange((Array.isArray(nextValue) ? nextValue[0] : nextValue) ?? min)
				}
				min={min}
				max={max}
				step={step}
				disabled={isPending || field.readOnly}
				aria-invalid={isInvalid}
			/>

			<FieldError errors={fieldErrors} />
		</Field>
	);
}
