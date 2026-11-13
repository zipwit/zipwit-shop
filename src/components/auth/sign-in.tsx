import { AuthPrompts, useAuth } from "@better-auth-ui/react";
import { FieldGroup } from "#/components/ui/field";
import { AuthCard } from "./auth-card";
import { AuthFormLinks } from "./auth-form-links";
import { AuthCaptcha, AuthPluginButtons } from "./auth-plugin-content";
import { AuthSocialLayout } from "./auth-social-layout";
import type { SocialLayout } from "./provider-buttons";
import { ReauthenticationNotice } from "./reauthentication";
import { SignInFields } from "./sign-in-fields";
import { useSignInForm } from "./use-sign-in-form";

export type SignInProps = {
	className?: string;
	socialLayout?: SocialLayout;
	socialPosition?: "top" | "bottom";
};

export function SignIn({
	className,
	socialLayout,
	socialPosition = "bottom",
}: SignInProps) {
	const { emailAndPassword, localization } = useAuth();
	const state = useSignInForm();
	const { form, isPending, isSigningIn } = state;
	return (
		<AuthCard
			className={className}
			title={localization.auth.signIn}
			notice={
				<>
					<AuthPrompts view="signIn" />
					<ReauthenticationNotice />
				</>
			}
		>
			<AuthSocialLayout
				view="signIn"
				socialLayout={socialLayout}
				socialPosition={socialPosition}
			>
				{emailAndPassword?.enabled && (
					<form.AppForm>
						<form.FormRoot>
							<FieldGroup>
								<SignInFields state={state} />
								<AuthCaptcha />
								<div className="flex flex-col gap-3">
									<form.FormSubmitButton
										isPending={isSigningIn}
										disabled={isPending}
									>
										{localization.auth.signIn}
									</form.FormSubmitButton>
									<AuthPluginButtons view="signIn" />
								</div>
							</FieldGroup>
						</form.FormRoot>
					</form.AppForm>
				)}
			</AuthSocialLayout>
			<AuthFormLinks view="signIn" />
		</AuthCard>
	);
}
