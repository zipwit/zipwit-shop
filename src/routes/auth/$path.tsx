import { viewPaths } from "@better-auth-ui/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { Auth } from "#/components/auth/auth";
import { site } from "#/data/site";
import { AuthReturnTo, safeAuthReturnTo } from "#/features/auth/auth-return-to";
import { authViewTitle } from "#/features/auth/auth-view-title";

const validPaths = new Set<string>(Object.values(viewPaths.auth));

export const Route = createFileRoute("/auth/$path")({
	validateSearch: z
		.object({ redirectTo: z.string().optional().catch(undefined) })
		.loose(),
	beforeLoad: ({ params, search }) => {
		if (params.path === viewPaths.auth.resetLinkSent) {
			throw redirect({
				to: "/auth/$path",
				params: { path: viewPaths.auth.resetPassword },
				search,
			});
		}
		if (!validPaths.has(params.path)) throw redirect({ to: "/" });
	},
	head: ({ match }) => ({
		meta: [
			{
				title: `${authViewTitle(match.params.path, match.context.locale)} | ${site.name}`,
			},
			{ name: "robots", content: "noindex" },
		],
	}),
	component: AuthPage,
});

function AuthPage() {
	const { path } = Route.useParams();
	const { redirectTo } = Route.useSearch();
	return (
		<AuthReturnTo value={safeAuthReturnTo(redirectTo)}>
			<div className="flex justify-center px-5 py-12 sm:px-8 md:py-20">
				<Auth path={path} />
			</div>
		</AuthReturnTo>
	);
}
