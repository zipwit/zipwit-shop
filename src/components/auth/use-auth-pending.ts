import { authMutationKeys } from "@better-auth-ui/core";
import { useIsMutating } from "@tanstack/react-query";

/** All credential forms share pending state with social sign-in mutations. */
export function useAuthPending() {
	const signIn = useIsMutating({ mutationKey: authMutationKeys.signIn.all });
	const signUp = useIsMutating({ mutationKey: authMutationKeys.signUp.all });
	return signIn + signUp > 0;
}
