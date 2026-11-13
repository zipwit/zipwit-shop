import {
	validateEmailAddress,
	validateStringLength,
} from "@better-auth-ui/core";
import { useAuth } from "@better-auth-ui/react";
import { getAuthAdditionalFieldValidators } from "./auth-form";
import { PasswordStrengthMeter } from "./password-strength-meter";
import type { useSignUpForm } from "./use-sign-up-form";

type SignUpState = ReturnType<typeof useSignUpForm>;
export function SignUpFields({ state }: { state: SignUpState }) {
	const { emailAndPassword, localization } = useAuth();
	const {
		form,
		isPending,
		validatePassword,
		validateConfirmation,
		isCompromised,
		setIsCompromised,
	} = state;
	return (
		<>
			{emailAndPassword.name !== false && (
				<form.AppField
					name="name"
					validators={{
						onChange: ({ value }) =>
							validateStringLength(value, {
								requiredMessage: localization.auth.fieldRequired,
								trim: true,
							}),
					}}
				>
					{(field) => (
						<field.FormTextField
							label={localization.auth.name}
							type="text"
							autoComplete="name"
							placeholder={localization.auth.namePlaceholder}
							required
							disabled={isPending}
						/>
					)}
				</form.AppField>
			)}
			<form.AppField
				name="email"
				validators={{
					onChange: ({ value }) =>
						validateEmailAddress(value, {
							invalidMessage: localization.auth.invalidEmail,
							requiredMessage: localization.auth.fieldRequired,
						}),
				}}
			>
				{(field) => (
					<field.FormTextField
						label={localization.auth.email}
						type="email"
						autoComplete="email"
						placeholder={localization.auth.emailPlaceholder}
						required
						disabled={isPending}
					/>
				)}
			</form.AppField>
			<SignUpAdditionalFields state={state} above />
			<form.AppField
				name="password"
				validators={{
					onChange: ({ value }) => validatePassword(value),
				}}
			>
				{(field) => (
					<field.FormTextField
						label={localization.auth.password}
						type="password"
						autoComplete="new-password"
						placeholder={localization.auth.passwordPlaceholder}
						required
						disabled={isPending}
						minLength={emailAndPassword?.minPasswordLength}
						maxLength={emailAndPassword?.maxPasswordLength}
						error={isCompromised && localization.auth.passwordCompromised}
						onValueChange={() => setIsCompromised(false)}
					>
						<PasswordStrengthMeter password={field.state.value} />
					</field.FormTextField>
				)}
			</form.AppField>
			{emailAndPassword?.confirmPassword && (
				<form.AppField
					name="confirmPassword"
					validators={{
						onChangeListenTo: ["password"],
						onChange: ({ fieldApi, value }) =>
							validateConfirmation(
								value,
								fieldApi.form.getFieldValue("password"),
							),
					}}
				>
					{(field) => (
						<field.FormTextField
							label={localization.auth.confirmPassword}
							type="password"
							autoComplete="new-password"
							placeholder={localization.auth.confirmPasswordPlaceholder}
							required
							disabled={isPending}
							minLength={emailAndPassword?.minPasswordLength}
							maxLength={emailAndPassword?.maxPasswordLength}
						/>
					)}
				</form.AppField>
			)}
			<SignUpAdditionalFields state={state} above={false} />
		</>
	);
}
function SignUpAdditionalFields({
	state,
	above,
}: {
	state: SignUpState;
	above: boolean;
}) {
	const { localization } = useAuth();
	const { form, isPending, signUpFields } = state;
	return (
		<>
			{signUpFields.map(
				(configuredField) =>
					(configuredField.signUp === "above") === above && (
						<form.AppField
							key={configuredField.name}
							name={`additionalFields.${configuredField.name}`}
							validators={getAuthAdditionalFieldValidators(
								configuredField,
								localization.auth.fieldRequired,
							)}
						>
							{(field) => (
								<field.AuthFormAdditionalField
									field={configuredField}
									isPending={isPending}
									optionalLabel={localization.auth.optional}
								/>
							)}
						</form.AppField>
					),
			)}
		</>
	);
}
