import { useRef } from "react";
import { Input } from "#/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "#/components/ui/input-group";
import { CopyButton } from "./copy-button";
import { FieldFrame } from "./field-frame";
import type { AdditionalFieldProps } from "./types";
import { valueToString } from "./values";
export function InputField({
	name,
	field,
	value,
	onBlur,
	onChange,
	isInvalid,
	errors,
	isPending,
}: AdditionalFieldProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const hasPrefix = field.prefix != null;
	const hasSuffix = field.suffix != null || field.copyable;

	const isNumeric = field.type === "number";
	const maxFractionDigits = field.formatOptions?.maximumFractionDigits;
	const nativeInputType = isNumeric ? "number" : undefined;
	const nativeInputMode = isNumeric
		? maxFractionDigits
			? "decimal"
			: "numeric"
		: undefined;
	const nativeStep = maxFractionDigits
		? 1 / 10 ** maxFractionDigits
		: undefined;

	const InputControl = hasPrefix || hasSuffix ? InputGroupInput : Input;
	const control = (
		<InputControl
			ref={inputRef}
			id={name}
			name={name}
			type={nativeInputType}
			inputMode={nativeInputMode}
			step={nativeStep}
			value={valueToString(value)}
			onBlur={onBlur}
			onChange={(event) => onChange(event.target.value || null)}
			placeholder={field.placeholder}
			required={field.required}
			readOnly={field.readOnly}
			disabled={isPending}
			aria-invalid={isInvalid}
		/>
	);
	return (
		<FieldFrame name={name} field={field} isInvalid={isInvalid} errors={errors}>
			{hasPrefix || hasSuffix ? (
				<InputGroup>
					{hasPrefix && (
						<InputGroupAddon align="inline-start">
							{field.prefix}
						</InputGroupAddon>
					)}
					{control}
					{field.copyable ? (
						<InputGroupAddon align="inline-end">
							<CopyButton
								getValue={() => inputRef.current?.value}
								isDisabled={isPending}
							/>
						</InputGroupAddon>
					) : (
						field.suffix != null && (
							<InputGroupAddon align="inline-end">
								{field.suffix}
							</InputGroupAddon>
						)
					)}
				</InputGroup>
			) : (
				control
			)}
		</FieldFrame>
	);
}
