import { z } from "zod";

/** Blank values in `.env` (`KEY=`) count as unset. */
const optionalString = z
	.string()
	.optional()
	.transform((value) => value?.trim() || undefined);

const optionalUrl = optionalString.pipe(z.url().optional());

function isRedisSeedUrl(value: string) {
	const url = URL.parse(value);
	return (
		url !== null &&
		(url.protocol === "redis:" || url.protocol === "rediss:") &&
		Boolean(url.hostname) &&
		["", "/", "/0"].includes(url.pathname) &&
		!url.search &&
		!url.hash &&
		!url.username &&
		!url.password
	);
}

const redisClusterNodes = optionalString.pipe(
	z
		.string()
		.transform((value) => value.split(",").map((seed) => seed.trim()))
		.pipe(
			z.array(
				z
					.string()
					.refine(
						isRedisSeedUrl,
						"Use redis:// or rediss:// URLs with database 0; set credentials in REDIS_USERNAME and REDIS_PASSWORD.",
					),
			),
		)
		.optional(),
);

const envSchema = z
	.object({
		NODE_ENV: z.string().optional(),

		REDIS_HOST: z.string().min(1).default("localhost"),
		REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
		/** Comma-separated seed URLs. Unset keeps standalone Redis available for local tools. */
		REDIS_CLUSTER_NODES: redisClusterNodes,
		REDIS_USERNAME: optionalString,
		REDIS_PASSWORD: optionalString,
		REDIS_TLS: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),

		BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
		BETTER_AUTH_SECRET: z.string().min(32),
		CATALOG_ADMIN_USER_IDS: optionalString.transform(
			(value) =>
				value
					?.split(",")
					.map((id) => id.trim())
					.filter(Boolean) ?? [],
		),
		ZIPWIT_CONFIG_TOKEN: optionalString.pipe(z.string().min(32).optional()),

		GOOGLE_CLIENT_ID: optionalString,
		GOOGLE_CLIENT_SECRET: optionalString,
		FACEBOOK_CLIENT_ID: optionalString,
		FACEBOOK_CLIENT_SECRET: optionalString,

		RESEND_API_KEY: optionalString,
		EMAIL_FROM: z
			.string()
			.min(1)
			.default("Zipwit Shop <onboarding@resend.dev>"),

		/** Public origin used in the sitemap. Falls back to `BETTER_AUTH_URL`. */
		SITE_URL: optionalUrl,

		CHECKOUT_IBAN: optionalString,
		CHECKOUT_SERVICE_FEE_BPS: optionalString,
		TELEGRAM_BOT_TOKEN: optionalString,
		TELEGRAM_CHAT_ID: optionalString,
		OPS_ALERT_EMAIL: optionalString.pipe(z.email().optional()),
	})
	.refine(
		(e) => Boolean(e.GOOGLE_CLIENT_ID) === Boolean(e.GOOGLE_CLIENT_SECRET),
		{
			message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
			path: ["GOOGLE_CLIENT_ID"],
		},
	)
	.refine(
		(e) => Boolean(e.FACEBOOK_CLIENT_ID) === Boolean(e.FACEBOOK_CLIENT_SECRET),
		{
			message:
				"Set both FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET, or neither",
			path: ["FACEBOOK_CLIENT_ID"],
		},
	)
	.refine((e) => e.NODE_ENV !== "production" || e.RESEND_API_KEY, {
		message: "RESEND_API_KEY is required in production",
		path: ["RESEND_API_KEY"],
	})
	.transform((e) => ({ ...e, SITE_URL: e.SITE_URL ?? e.BETTER_AUTH_URL }));

/** Parses and validates an environment; exported so the rules can be tested. */
export const parseEnv = (source: Record<string, string | undefined>) =>
	envSchema.parse(source);

/** Validated server environment. Database settings live in `#/db/connection`. */
export const env = parseEnv(process.env);
