import {
	getAdditionalFieldDefaultValues,
	getAdditionalFieldSubmitValues,
	getAuthCallbackURL,
	getAuthLinkURL,
	isPasswordCompromisedError,
} from "@better-auth-ui/core";
import {
	useAuth,
	useFetchOptions,
	useSignUpEmail,
} from "@better-auth-ui/react";
import { useMemo, useState } from "react";
import { useAuthForm } from "./auth-form";
import { VERIFY_EMAIL_STORAGE_KEY } from "./storage-keys";
import { useAuthPending } from "./use-auth-pending";
import { usePasswordValidation } from "./use-password-validation";
export function useSignUpForm(onSignUpSuccess?: () => void) {
	const {
		additionalFields,
		authClient,
		basePaths,
		baseURL,
		emailAndPassword,
		redirectTo,
		viewPaths,
		navigate,
	} = useAuth();

	const { fetchOptions, resetFetchOptions } = useFetchOptions();

	const { mutateAsync: signUpEmail } = useSignUpEmail(authClient, {
		onError: (error) => {
			// The haveIBeenPwned plugin rejects on the password itself,
			// so it belongs against the field rather than in a toast.
			if (isPasswordCompromisedError(error)) {
				setIsCompromised(true);
			}

			form.setFieldValue("password", "");
			form.setFieldValue("confirmPassword", "");
			resetFetchOptions();
		},
		onSuccess: (_data, { email }) => {
			if (emailAndPassword?.requireEmailVerification) {
				sessionStorage.setItem(VERIFY_EMAIL_STORAGE_KEY, email);
				navigate({
					to: getAuthLinkURL(
						`${basePaths.auth}/${viewPaths.auth.verifyEmail}`,
						redirectTo,
					),
				});
			} else if (onSignUpSuccess) {
				onSignUpSuccess();
			} else {
				navigate({ to: redirectTo });
			}
		},
	});

	const isPending = useAuthPending();

	const [isCompromised, setIsCompromised] = useState(false);
	const signUpFields = useMemo(
		() => additionalFields?.filter((field) => field.signUp) ?? [],
		[additionalFields],
	);
	const { validatePassword, validateConfirmation } = usePasswordValidation();
	const form = useAuthForm({
		defaultValues: {
			additionalFields: getAdditionalFieldDefaultValues(signUpFields),
			confirmPassword: "",
			email: "",
			name: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await signUpEmail({
					name: emailAndPassword?.name === false ? "" : value.name,
					email: value.email.trim(),
					password: value.password,
					...getAdditionalFieldSubmitValues(
						signUpFields,
						value.additionalFields,
					),
					callbackURL: getAuthCallbackURL(baseURL, redirectTo),
					fetchOptions,
				});
			} catch {
				// The mutation reports the error through its configured handler.
			}
		},
	});

	return {
		form,
		isPending,
		signUpFields,
		validatePassword,
		validateConfirmation,
		isCompromised,
		setIsCompromised,
	};
}
