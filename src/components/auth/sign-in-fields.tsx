import { validateEmailAddress } from "@better-auth-ui/core";
import { useAuth } from "@better-auth-ui/react";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldLabel } from "#/components/ui/field";
import { usePasswordValidation } from "./use-password-validation";
import type { useSignInForm } from "./use-sign-in-form";

export function SignInFields({
	state,
}: {
	state: ReturnType<typeof useSignInForm>;
}) {
	const { form, isPending } = state;
	const { emailAndPassword, localization } = useAuth();
	const { validatePassword } = usePasswordValidation();
	return (
		<>
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
						autoComplete="current-password"
						placeholder={localization.auth.passwordPlaceholder}
						required
						disabled={isPending}
						minLength={emailAndPassword?.minPasswordLength}
						maxLength={emailAndPassword?.maxPasswordLength}
					/>
				)}
			</form.AppField>

			{emailAndPassword?.rememberMe && (
				<form.AppField name="rememberMe">
					{(field) => (
						<Field className="my-1">
							<div className="flex items-center gap-3">
								<Checkbox
									id="rememberMe"
									name={field.name}
									checked={field.state.value}
									disabled={isPending}
									onCheckedChange={(checked) =>
										field.handleChange(checked === true)
									}
								/>

								<FieldLabel
									htmlFor="rememberMe"
									className="cursor-pointer text-sm font-normal"
								>
									{localization.auth.rememberMe}
								</FieldLabel>
							</div>
						</Field>
					)}
				</form.AppField>
			)}
		</>
	);
}
