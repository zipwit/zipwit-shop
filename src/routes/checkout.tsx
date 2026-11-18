import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { site } from "#/data/site";
import { checkoutPageFn } from "#/features/checkout/checkout.functions";
import { checkoutQuery } from "#/features/checkout/checkout.queries";
import { CheckoutPage } from "#/features/checkout/components/checkout-page";
import { translate as t } from "#/i18n/translate";

export const Route = createFileRoute("/checkout")({
	validateSearch: z.object({ checkout: z.uuid().optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ id: search.checkout }),
	loader: async ({ deps, context, abortController }) => {
		const { checkout, ...page } = await checkoutPageFn({
			data: deps,
			signal: abortController.signal,
		});
		if (page.userId && checkout && !abortController.signal.aborted) {
			context.queryClient.setQueryData(
				checkoutQuery(page.userId, checkout.id).queryKey,
				checkout,
			);
		}
		return { ...page, checkoutId: checkout?.id };
	},
	staleTime: 0,
	head: ({ match }) => ({
		meta: [
			{ title: `${t("Checkout", {}, match.context.locale)} | ${site.name}` },
			{ name: "robots", content: "noindex" },
		],
	}),
	component: () => (
		<CheckoutPage
			data={Route.useLoaderData()}
			requestedId={Route.useSearch().checkout}
		/>
	),
});
