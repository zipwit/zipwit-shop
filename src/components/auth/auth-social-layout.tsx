import { useAuth } from "@better-auth-ui/react";
import type { ReactNode } from "react";
import { FieldSeparator } from "#/components/ui/field";
import { ProviderButtons, type SocialLayout } from "./provider-buttons";

export function AuthSocialLayout({
	children,
	view,
	socialLayout,
	socialPosition = "bottom",
}: {
	children: ReactNode;
	view: "signIn" | "signUp";
	socialLayout?: SocialLayout;
	socialPosition?: "top" | "bottom";
}) {
	const { emailAndPassword, socialProviders, localization } = useAuth();
	const providers = socialProviders?.length ? (
		<ProviderButtons socialLayout={socialLayout} view={view} />
	) : null;
	const separator =
		providers && emailAndPassword?.enabled ? (
			<FieldSeparator className="m-0 flex items-center text-xs *:data-[slot=field-separator-content]:bg-card">
				{localization.auth.or}
			</FieldSeparator>
		) : null;
	return (
		<div className="flex flex-col gap-6">
			{socialPosition === "top" && (
				<>
					{providers}
					{separator}
				</>
			)}
			{children}
			{socialPosition === "bottom" && (
				<>
					{separator}
					{providers}
				</>
			)}
		</div>
	);
}
