import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSocialLayout } from "./auth-social-layout";

const auth = vi.hoisted(() => ({
	emailAndPassword: { enabled: true },
	socialProviders: [{ id: "google" }],
	localization: { auth: { or: "or" } },
}));
vi.mock("@better-auth-ui/react", () => ({ useAuth: () => auth }));
vi.mock("./provider-buttons", () => ({
	ProviderButtons: () => <span>social providers</span>,
}));

beforeEach(() => {
	auth.emailAndPassword.enabled = true;
	auth.socialProviders = [{ id: "google" }];
});

function render(position: "top" | "bottom") {
	return renderToStaticMarkup(
		<AuthSocialLayout view="signIn" socialPosition={position}>
			<span>credentials</span>
		</AuthSocialLayout>,
	);
}

describe("auth social layout", () => {
	it.each(["top", "bottom"] as const)(
		"places social providers at the %s with one separator",
		(position) => {
			const html = render(position);
			expect(html.match(/data-slot="field-separator"/g)).toHaveLength(1);
			expect(
				html.indexOf("social providers") < html.indexOf("credentials"),
			).toBe(position === "top");
		},
	);

	it("omits the separator when either sign-in method is unavailable", () => {
		auth.emailAndPassword.enabled = false;
		expect(render("top")).not.toContain('data-slot="field-separator"');
		auth.socialProviders = [];
		expect(render("bottom")).not.toContain("social providers");
		expect(render("bottom")).toContain("credentials");
	});
});
