import { AuthPrompts, useAuth } from "@better-auth-ui/react";
import { FieldGroup } from "#/components/ui/field";
import { AuthCard } from "./auth-card";
import { AuthFormLinks } from "./auth-form-links";
import { AuthCaptcha, AuthPluginButtons } from "./auth-plugin-content";
import { AuthSocialLayout } from "./auth-social-layout";
import type { SocialLayout } from "./provider-buttons";
import { SignUpFields } from "./sign-up-fields";
import { useSignUpForm } from "./use-sign-up-form";

export type SignUpProps = {
	className?: string;
	socialLayout?: SocialLayout;
	socialPosition?: "top" | "bottom";
	/**
	 * Runs instead of the post-sign-up redirect, but only when the sign-up
	 * created an immediately usable session. Email verification still takes
	 * priority, and social sign-ups are unaffected.
	 */
	onSignUpSuccess?: () => void;
};

export function SignUp({
	className,
	socialLayout,
	socialPosition = "bottom",
	onSignUpSuccess,
}: SignUpProps) {
	const { emailAndPassword, localization } = useAuth();
	const state = useSignUpForm(onSignUpSuccess);
	const { form, isPending } = state;
	return (
		<AuthCard
			className={className}
			title={localization.auth.signUp}
			notice={<AuthPrompts view="signUp" />}
		>
			<AuthSocialLayout
				view="signUp"
				socialLayout={socialLayout}
				socialPosition={socialPosition}
			>
				{emailAndPassword?.enabled && (
					<form.AppForm>
						<form.FormRoot>
							<FieldGroup>
								<SignUpFields state={state} />
								<AuthCaptcha />
								<div className="flex flex-col gap-3">
									<form.FormSubmitButton disabled={isPending}>
										{localization.auth.signUp}
									</form.FormSubmitButton>
									<AuthPluginButtons view="signUp" />
								</div>
							</FieldGroup>
						</form.FormRoot>
					</form.AppForm>
				)}
			</AuthSocialLayout>
			<AuthFormLinks view="signUp" />
		</AuthCard>
	);
}
