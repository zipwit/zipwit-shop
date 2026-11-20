import { getFormFieldErrors } from "@better-auth-ui/core";
import { type ComponentProps, type ReactNode, useId } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { useFieldContext, useFormContext } from "./form-context";
import { clearFieldServerError, isFieldInvalid } from "./form-errors";
import { PasswordInput } from "./password-input";

export function FormFieldError() {
	const field = useFieldContext<unknown>();
	const isInvalid = isFieldInvalid(field.state.meta);

	if (!isInvalid) return null;

	const errors = getFormFieldErrors(field.state.meta.errors);

	return errors.length > 0 ? <FieldError errors={errors} /> : null;
}

type FormTextFieldProps = Omit<
	ComponentProps<typeof Input>,
	"name" | "onBlur" | "onChange" | "value"
> & {
	description?: ReactNode;
	error?: ReactNode;
	label: ReactNode;
	isLoading?: boolean;
	onValueChange?: (value: string) => void;
};

export function FormTextField({
	isLoading = false,
	description,
	error,
	children,
	id,
	label,
	type,
	onValueChange,
	...props
}: FormTextFieldProps) {
	const field = useFieldContext<string>();
	const form = useFormContext();
	const isInvalid = Boolean(error) || isFieldInvalid(field.state.meta);
	const generatedId = useId();
	const inputId = id ?? `${generatedId}-${field.name}`;
	const descriptionId = `${inputId}-description`;
	const errorId = `${inputId}-error`;
	const Control = type === "password" ? PasswordInput : Input;

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={inputId}>{label}</FieldLabel>
			{isLoading ? (
				<Skeleton className="h-9 w-full" />
			) : (
				<Control
					{...props}
					type={type}
					aria-describedby={
						[
							props["aria-describedby"],
							description && descriptionId,
							isInvalid && errorId,
						]
							.filter(Boolean)
							.join(" ") || undefined
					}
					aria-busy={field.state.meta.isValidating || undefined}
					aria-invalid={isInvalid}
					id={inputId}
					name={field.name}
					onBlur={field.handleBlur}
					onChange={(event) => {
						clearFieldServerError(form, field.name);
						field.handleChange(event.target.value);
						onValueChange?.(event.target.value);
					}}
					value={field.state.value}
				/>
			)}
			{description && (
				<FieldDescription id={descriptionId}>{description}</FieldDescription>
			)}
			{isInvalid && (
				<div id={errorId}>
					{error ? <FieldError>{error}</FieldError> : <FormFieldError />}
				</div>
			)}
			{children}
		</Field>
	);
}
