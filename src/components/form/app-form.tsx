import { getFormFieldErrors } from "@better-auth-ui/core";
import { createFormHook } from "@tanstack/react-form";
import { type ComponentProps, type SubmitEvent, useRef } from "react";
import { Button } from "#/components/ui/button";
import { FieldError } from "#/components/ui/field";
import { Spinner } from "#/components/ui/spinner";
import { useMessages } from "#/i18n/messages";
import { fieldContext, formContext, useFormContext } from "./form-context";
import { clearFieldServerError, submitForm } from "./form-errors";
import { FormFieldError, FormTextField } from "./form-text-field";

function focusFirstInvalidControl(form: HTMLFormElement) {
	requestAnimationFrame(() => {
		form
			.querySelector<HTMLElement>(
				'[aria-invalid="true"]:not([disabled]), :invalid:not([disabled])',
			)
			?.focus();
	});
}

function FormServerError() {
	const form = useFormContext();

	return (
		<form.Subscribe selector={(state) => state.errorMap.onServer}>
			{(error) => {
				const formError =
					error && typeof error === "object" && "form" in error
						? error.form
						: error;
				const errors = getFormFieldErrors(formError ? [formError] : []);
				return errors.length > 0 ? <FieldError errors={errors} /> : null;
			}}
		</form.Subscribe>
	);
}

type FormRootProps = Omit<ComponentProps<"form">, "onSubmit"> & {
	onBeforeSubmit?: () => void;
	serverErrorMessage?: string;
};

function FormRoot({
	children,
	onBeforeSubmit,
	onInput,
	serverErrorMessage,
	...props
}: FormRootProps) {
	const form = useFormContext();
	const messages = useMessages();
	const submittingRef = useRef(false);

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submittingRef.current || form.state.isSubmitting) return;

		const formElement = event.currentTarget;
		onBeforeSubmit?.();
		submittingRef.current = true;
		try {
			const isValid = await submitForm(
				form,
				serverErrorMessage ?? messages.form.submitFailed,
			);
			if (!isValid) focusFirstInvalidControl(formElement);
		} finally {
			submittingRef.current = false;
		}
	}

	return (
		<form
			{...props}
			onInvalid={(event) => focusFirstInvalidControl(event.currentTarget)}
			onInput={(event) => {
				const target = event.target;
				const fieldName =
					target instanceof HTMLInputElement ||
					target instanceof HTMLSelectElement ||
					target instanceof HTMLTextAreaElement
						? target.name
						: "";
				clearFieldServerError(form, fieldName);
				onInput?.(event);
			}}
			onSubmit={submit}
		>
			{children}
		</form>
	);
}

function FormSubmitButton({
	children,
	disabled,
	isPending,
	...props
}: ComponentProps<typeof Button> & { isPending?: boolean }) {
	const form = useFormContext();

	return (
		<form.Subscribe
			selector={(state) => [state.isSubmitting, state.isValidating] as const}
		>
			{([isSubmitting, isValidating]) => (
				<Button
					{...props}
					aria-busy={isPending || isSubmitting || undefined}
					aria-disabled={
						disabled || isPending || isSubmitting || isValidating || undefined
					}
					disabled={disabled || isPending || isSubmitting || isValidating}
					type="submit"
				>
					{isPending || isSubmitting ? (
						<Spinner data-icon="inline-start" />
					) : null}
					{children}
				</Button>
			)}
		</form.Subscribe>
	);
}

/** Shared with `useAuthForm`, which adds the Better Auth additional-field component. */
export const fieldComponents = { FormFieldError, FormTextField };
export const formComponents = { FormRoot, FormServerError, FormSubmitButton };

/** The app's form hook: text fields, server errors and a submit button wired to TanStack Form. */
export const { useAppForm } = createFormHook({
	fieldComponents,
	fieldContext,
	formComponents,
	formContext,
});
