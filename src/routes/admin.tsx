import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { site } from "#/data/site";
import { adminPageFn } from "#/features/admin/catalog-feeds.functions";
import { FeedManager } from "#/features/admin/components/feed-manager";
import { translate } from "#/i18n/translate";

export const Route = createFileRoute("/admin")({
	loader: async ({ abortController }) => {
		const page = await adminPageFn({ signal: abortController.signal });
		if (page.access === "guest")
			throw redirect({
				to: "/auth/$path",
				params: { path: "sign-in" },
				search: { redirectTo: "/admin" },
			});
		if (page.access === "denied") throw notFound();
		return page.feeds;
	},
	headers: () => ({ "Cache-Control": "private, no-store" }),
	staleTime: 0,
	gcTime: 0,
	head: ({ match }) => ({
		meta: [
			{
				title: `${translate("Catalog feeds", {}, match.context.locale)} | ${site.name}`,
			},
			{ name: "robots", content: "noindex" },
		],
	}),
	component: () => <FeedManager feeds={Route.useLoaderData()} />,
});
