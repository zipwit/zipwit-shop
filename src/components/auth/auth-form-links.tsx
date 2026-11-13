import { getAuthLinkURL } from "@better-auth-ui/core";
import { useAuth } from "@better-auth-ui/react";
import { FieldDescription } from "#/components/ui/field";

export function AuthFormLinks({ view }: { view: "signIn" | "signUp" }) {
	const {
		basePaths,
		emailAndPassword,
		localization,
		redirectTo,
		viewPaths,
		Link,
	} = useAuth();
	if (!emailAndPassword?.enabled) return null;
	const signingIn = view === "signIn";
	const target = signingIn ? viewPaths.auth.signUp : viewPaths.auth.signIn;
	return (
		<div className="mt-4 flex w-full flex-col items-center gap-3">
			{signingIn && emailAndPassword.forgotPassword && (
				<Link
					href={`${basePaths.auth}/${viewPaths.auth.forgotPassword}`}
					className="text-sm underline-offset-4 hover:underline"
				>
					{localization.auth.forgotPasswordLink}
				</Link>
			)}
			<FieldDescription className="text-center">
				{signingIn
					? localization.auth.needToCreateAnAccount
					: localization.auth.alreadyHaveAnAccount}{" "}
				<Link
					href={getAuthLinkURL(`${basePaths.auth}/${target}`, redirectTo)}
					className="underline underline-offset-4"
				>
					{signingIn ? localization.auth.signUp : localization.auth.signIn}
				</Link>
			</FieldDescription>
		</div>
	);
}
