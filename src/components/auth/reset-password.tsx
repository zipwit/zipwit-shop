import {
	getAuthLinkURL,
	isPasswordCompromisedError,
} from "@better-auth-ui/core";
import { useAuth } from "@better-auth-ui/react";
import { useResetPasswordOtp } from "@better-auth-ui/react/plugins/email-otp";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAppForm } from "#/components/form/app-form";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { FieldDescription, FieldGroup } from "#/components/ui/field";
import { authClient } from "#/features/auth/auth-client";
import { useAuthReturnTo } from "#/features/auth/auth-return-to";
import { fill, useMessages } from "#/i18n/messages";
import { cn } from "#/lib/utils";
import { ConfirmPasswordField, NewPasswordField } from "./new-password-field";
import { ResendCodeButton } from "./resend-code-button";
import { RESET_PASSWORD_EMAIL_STORAGE_KEY } from "./storage-keys";
import { usePasswordValidation } from "./use-password-validation";
import { useStoredEmail } from "./use-stored-email";

export type ResetPasswordProps = {
	className?: string;
};

/** Confirms the emailed code and sets a new password. */
export function ResetPassword({ className }: ResetPasswordProps) {
	const {
		basePaths,
		emailAndPassword,
		localization,
		navigate,
		viewPaths,
		Link,
	} = useAuth();
	const redirectTo = useAuthReturnTo();
	const messages = useMessages();
	const { validatePassword, validateConfirmation } = usePasswordValidation();
	const signInURL = getAuthLinkURL(
		`${basePaths.auth}/${viewPaths.auth.signIn}`,
		redirectTo,
	);
	const forgotPasswordURL = getAuthLinkURL(
		`${basePaths.auth}/${viewPaths.auth.forgotPassword}`,
		redirectTo,
	);

	const { mutateAsync: resetPassword, isPending } = useResetPasswordOtp(
		authClient,
		{
			onError: (error) => {
				if (isPasswordCompromisedError(error)) {
					setIsCompromised(true);
				}
			},
			onSuccess: () => {
				sessionStorage.removeItem(RESET_PASSWORD_EMAIL_STORAGE_KEY);
				toast.success(localization.auth.passwordResetSuccess);
				navigate({ to: signInURL });
			},
		},
	);
	const [isCompromised, setIsCompromised] = useState(false);

	const email = useStoredEmail(RESET_PASSWORD_EMAIL_STORAGE_KEY);

	const form = useAppForm({
		defaultValues: { otp: "", confirmPassword: "", password: "" },
		onSubmit: async ({ value }) => {
			try {
				await resetPassword({
					email,
					otp: value.otp,
					password: value.password,
				});
			} catch (error) {
				if (!isPasswordCompromisedError(error)) throw error;
			}
		},
	});

	return (
		<Card className={cn("w-full max-w-sm", className)}>
			<CardHeader>
				<CardTitle className="text-xl font-semibold">
					{localization.auth.resetPassword}
				</CardTitle>
			</CardHeader>

			<CardContent>
				<form.AppForm>
					<form.FormRoot>
						<FieldGroup>
							<FieldDescription>
								{email
									? fill(messages.resetPassword.instructions, { email })
									: messages.resetPassword.noEmail}
							</FieldDescription>
							<form.AppField
								name="otp"
								validators={{
									onChange: z
										.string()
										.regex(/^\d{6}$/, messages.otp.invalidCode),
								}}
							>
								{(field) => (
									<field.FormTextField
										label={messages.resetPassword.codeLabel}
										inputMode="numeric"
										autoComplete="one-time-code"
										maxLength={6}
										required
										disabled={isPending || !email}
									/>
								)}
							</form.AppField>
							<form.AppField
								name="password"
								validators={{
									onChange: ({ value }) => validatePassword(value),
								}}
							>
								{() => (
									<NewPasswordField
										label={localization.auth.password}
										placeholder={localization.auth.newPasswordPlaceholder}
										disabled={isPending || !email}
										isCompromised={isCompromised}
										onEdit={() => setIsCompromised(false)}
									/>
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
									{() => (
										<ConfirmPasswordField disabled={isPending || !email} />
									)}
								</form.AppField>
							)}

							<div className="flex flex-col gap-3">
								<form.FormServerError />
								<form.FormSubmitButton disabled={isPending || !email}>
									{localization.auth.resetPassword}
								</form.FormSubmitButton>
							</div>
							{email && (
								<ResendCodeButton
									disabled={isPending}
									onResend={async () => {
										const { error } =
											await authClient.emailOtp.requestPasswordReset({ email });
										if (error) throw new Error(error.message);
									}}
								/>
							)}
							<Link
								href={forgotPasswordURL}
								className="text-sm underline underline-offset-4"
							>
								{messages.resetPassword.useAnotherEmail}
							</Link>
						</FieldGroup>
					</form.FormRoot>
				</form.AppForm>

				<div className="flex flex-col gap-3 items-center w-full mt-4">
					<FieldDescription className="text-center">
						{localization.auth.rememberYourPassword}{" "}
						<Link href={signInURL} className="underline underline-offset-4">
							{localization.auth.signIn}
						</Link>
					</FieldDescription>
				</div>
			</CardContent>
		</Card>
	);
}
