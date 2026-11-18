import { describe, expect, it, vi } from "vitest";

vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));

const { parseEnv } = await import("#/server/env.server");

const base = { BETTER_AUTH_SECRET: "x".repeat(32) };

describe("parseEnv", () => {
	it("validates Cluster seeds without accepting non-Redis URLs, credentials or other databases", () => {
		expect(
			parseEnv({
				...base,
				REDIS_CLUSTER_NODES:
					"redis://one:6379, redis://two:6379,redis://three:6379",
			}).REDIS_CLUSTER_NODES,
		).toEqual(["redis://one:6379", "redis://two:6379", "redis://three:6379"]);
		for (const nodes of [
			"https://one:6379",
			"redis:///0",
			"invalid-seed",
			"redis://one:6379/1",
			"redis://one:6379,",
			"redis://user:password@one:6379",
		]) {
			expect(() => parseEnv({ ...base, REDIS_CLUSTER_NODES: nodes })).toThrow(
				/Use redis/,
			);
		}
		expect(
			parseEnv({ ...base, REDIS_CLUSTER_NODES: " " }).REDIS_CLUSTER_NODES,
		).toBeUndefined();
	});
	it("defaults Redis locally and accepts an explicit host and port", () => {
		expect(parseEnv(base)).toMatchObject({
			REDIS_HOST: "localhost",
			REDIS_PORT: 6379,
		});
		expect(
			parseEnv({ ...base, REDIS_HOST: "redis", REDIS_PORT: "6380" }),
		).toMatchObject({ REDIS_HOST: "redis", REDIS_PORT: 6380 });
		expect(() => parseEnv({ ...base, REDIS_PORT: "invalid" })).toThrow();
		for (const port of ["0", "-1", "65536", "6379.5"]) {
			expect(() => parseEnv({ ...base, REDIS_PORT: port })).toThrow();
		}
	});

	it("needs only the auth secret in development", () => {
		const env = parseEnv(base);
		expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
		expect(env.RESEND_API_KEY).toBeUndefined();
	});

	it("treats blank values as unset", () => {
		const env = parseEnv({
			...base,
			GOOGLE_CLIENT_ID: "  ",
			SITE_URL: "",
		});
		expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
		expect(env.SITE_URL).toBe(env.BETTER_AUTH_URL);
	});

	it("falls back to BETTER_AUTH_URL for SITE_URL", () => {
		const env = parseEnv({
			...base,
			BETTER_AUTH_URL: "https://zipwit.example",
		});
		expect(env.SITE_URL).toBe("https://zipwit.example");
		expect(
			parseEnv({
				...base,
				BETTER_AUTH_URL: "https://zipwit.example",
				SITE_URL: "https://www.zipwit.example",
			}).SITE_URL,
		).toBe("https://www.zipwit.example");
	});

	it("rejects half-configured social providers", () => {
		expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toThrow(
			/GOOGLE/,
		);
		expect(() => parseEnv({ ...base, FACEBOOK_CLIENT_SECRET: "s" })).toThrow(
			/FACEBOOK/,
		);
		expect(() =>
			parseEnv({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }),
		).not.toThrow();
	});

	it("requires an email key in production only", () => {
		expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(
			/RESEND_API_KEY/,
		);
		expect(() =>
			parseEnv({ ...base, NODE_ENV: "production", RESEND_API_KEY: "re_1" }),
		).not.toThrow();
	});

	it("rejects a short auth secret and a malformed URL", () => {
		expect(() => parseEnv({ BETTER_AUTH_SECRET: "short" })).toThrow();
		expect(() => parseEnv({ ...base, SITE_URL: "not a url" })).toThrow();
	});
});
