import { useAuth } from "@better-auth-ui/react";

export function AuthCaptcha() {
	const { plugins } = useAuth();
	const captcha = plugins.find(
		(plugin) => plugin.captchaComponent,
	)?.captchaComponent;
	return captcha ? <div className="flex justify-center">{captcha}</div> : null;
}

export function AuthPluginButtons({ view }: { view: "signIn" | "signUp" }) {
	const { plugins } = useAuth();
	return plugins.flatMap((plugin) =>
		(plugin.authButtons ?? []).map((AuthButton, index) => (
			<AuthButton key={`${plugin.id}-${index.toString()}`} view={view} />
		)),
	);
}
