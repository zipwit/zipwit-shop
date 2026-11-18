import { getAuthLinkURL } from "@better-auth-ui/core";
import {
	useAuth,
	useFetchOptions,
	useSignInEmail,
} from "@better-auth-ui/react";
import { useAppForm } from "#/components/form/app-form";
import { useAuthReturnTo } from "#/features/auth/auth-return-to";
import { VERIFY_EMAIL_STORAGE_KEY } from "./storage-keys";
import { useAuthPending } from "./use-auth-pending";

export function useSignInForm() {
	const { authClient, basePaths, emailAndPassword, viewPaths, navigate } =
		useAuth();
	const redirectTo = useAuthReturnTo();
	const isPending = useAuthPending();
	const { fetchOptions, resetFetchOptions } = useFetchOptions();
	const { mutateAsync: signInEmail, isPending: isSigningIn } = useSignInEmail(
		authClient,
		{
			onError: (error, { email }) => {
				form.setFieldValue("password", "");
				if (error.error?.code === "EMAIL_NOT_VERIFIED") {
					sessionStorage.setItem(VERIFY_EMAIL_STORAGE_KEY, email);
					navigate({
						to: getAuthLinkURL(
							`${basePaths.auth}/${viewPaths.auth.verifyEmail}`,
							redirectTo,
						),
					});
				}
				resetFetchOptions();
			},
			onSuccess: () => navigate({ to: redirectTo }),
		},
	);
	const form = useAppForm({
		defaultValues: { email: "", password: "", rememberMe: false },
		onSubmit: async ({ value }) =>
			await signInEmail({
				email: value.email.trim(),
				password: value.password,
				...(emailAndPassword?.rememberMe
					? { rememberMe: value.rememberMe }
					: {}),
				fetchOptions,
			}),
	});
	return { form, isPending, isSigningIn };
}
