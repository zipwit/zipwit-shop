import { useAuth } from "@better-auth-ui/react";
import { useFieldContext } from "#/components/form/form-context";
import { FormTextField } from "#/components/form/form-text-field";
import { PasswordStrengthMeter } from "./password-strength-meter";

type PasswordFieldState = { disabled?: boolean; isLoading?: boolean };

function passwordInputProps(
	settings: ReturnType<typeof useAuth>["emailAndPassword"],
) {
	return {
		type: "password",
		autoComplete: "new-password",
		required: true,
		minLength: settings?.minPasswordLength,
		maxLength: settings?.maxPasswordLength,
	};
}

export function NewPasswordField({
	label,
	placeholder,
	isCompromised,
	onEdit,
	...state
}: PasswordFieldState & {
	label: string;
	placeholder: string;
	isCompromised: boolean;
	onEdit: () => void;
}) {
	const field = useFieldContext<string>();
	const { emailAndPassword, localization } = useAuth();
	return (
		<FormTextField
			{...passwordInputProps(emailAndPassword)}
			{...state}
			label={label}
			placeholder={placeholder}
			error={isCompromised && localization.auth.passwordCompromised}
			onValueChange={onEdit}
		>
			<PasswordStrengthMeter password={field.state.value} />
		</FormTextField>
	);
}

export function ConfirmPasswordField(state: PasswordFieldState) {
	const { emailAndPassword, localization } = useAuth();
	return (
		<FormTextField
			{...passwordInputProps(emailAndPassword)}
			{...state}
			label={localization.auth.confirmPassword}
			placeholder={localization.auth.confirmPasswordPlaceholder}
		/>
	);
}
