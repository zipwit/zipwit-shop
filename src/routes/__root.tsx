import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import { SiteLayout } from "#/components/layout/site-layout";
import { Providers } from "#/components/providers";
import { site } from "#/data/site";
import { publicConfigQuery } from "#/features/config/config.queries";
import { DEFAULT_LOCALE } from "#/i18n/locale";
import { getLocaleFn } from "#/i18n/locale.functions";
import { translate as t } from "#/i18n/translate";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	beforeLoad: async () => ({ locale: await getLocaleFn() }),
	loader: ({ context }) => context.queryClient.query(publicConfigQuery),
	head: ({ loaderData, match }) => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "theme-color", content: "#5b3df5" },
			{
				property: "og:image",
				content: loaderData
					? new URL("/images/zipwit-offers.webp", loaderData.siteUrl).href
					: undefined,
			},
			{ property: "og:image:width", content: "962" },
			{ property: "og:image:height", content: "448" },
			{ property: "og:image:alt", content: site.name },
			{ name: "twitter:card", content: "summary_large_image" },
			{
				name: "twitter:image",
				content: loaderData
					? new URL("/images/zipwit-offers.webp", loaderData.siteUrl).href
					: undefined,
			},
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: `${site.name} | ${t(site.tagline, {}, match.context.locale)}` },
			{
				name: "description",
				content: t(site.description, {}, match.context.locale),
			},
		],
		links: [
			{ rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32 48x48" },
			{ rel: "icon", type: "image/webp", href: "/images/zipwit-avatar.webp" },
			{ rel: "apple-touch-icon", href: "/apple-icon-180x180.png" },
			{ rel: "stylesheet", href: appCss },
		],
	}),
	component: RootLayout,
	shellComponent: RootDocument,
});

function RootLayout() {
	const { locale } = Route.useRouteContext();
	return (
		<Providers locale={locale}>
			<SiteLayout>
				<Outlet />
			</SiteLayout>
		</Providers>
	);
}

// Keep the document independent of loader data so root errors can render.
function RootDocument({ children }: { children: ReactNode }) {
	const { locale } = Route.useRouteContext();
	return (
		<html lang={locale ?? DEFAULT_LOCALE}>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{ position: "bottom-left" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
