import { enabledSocialProviders } from "#/features/auth/social-providers.server";
import { env } from "#/server/env.server";

/** Settings the browser needs, resolved from the environment at runtime. */
export const getPublicConfig = () => ({
	siteUrl: env.SITE_URL,
	socialProviders: enabledSocialProviders,
});
