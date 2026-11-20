import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Container } from "#/components/layout/container";
import { PageHeader } from "#/components/layout/page-header";
import { site } from "#/data/site";
import { CatalogListing } from "#/features/catalog/components/catalog-listing";
import { loadCatalog } from "#/features/search/catalog.queries";
import {
	catalogFiltersSchema,
	DEFAULT_FILTERS,
} from "#/features/search/catalog-filters";
import { storeCode, storeIdSchema } from "#/features/stores/store";
import { translate, useTranslation } from "#/i18n/translate";
import { parseParam } from "#/lib/route-guards";

export const Route = createFileRoute("/stores/$storeId")({
	beforeLoad: ({ params, context }) => {
		const storeId = parseParam(storeIdSchema, params.storeId);
		return {
			scope: { storeId, mode: "listing" as const },
			title: translate(
				"Store {{code}}",
				{ code: storeCode(storeId) },
				context.locale,
			),
		};
	},
	validateSearch: catalogFiltersSchema,
	search: { middlewares: [stripSearchParams(DEFAULT_FILTERS)] },
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ context, deps }) =>
		loadCatalog(context.queryClient, context.scope, deps.search),
	head: ({ match }) => ({
		meta: [
			{ title: `${match.context.title} | ${site.name}` },
			{ name: "robots", content: "noindex" },
		],
	}),
	component: StorePage,
});

function StorePage() {
	const { scope, title } = Route.useRouteContext();
	const filters = Route.useSearch();
	const navigate = Route.useNavigate();
	const t = useTranslation();
	return (
		<Container className="py-10 md:py-14">
			<PageHeader
				title={title}
				eyebrow={t("Shop by store")}
				description={t(
					"Items from this store share one shipping charge and free-shipping threshold.",
				)}
			/>
			<CatalogListing
				key={scope.storeId}
				scope={scope}
				filters={filters}
				onFiltersChange={(update) =>
					navigate({ search: update, replace: true, resetScroll: false })
				}
				empty={
					<p className="py-10 text-muted-foreground">
						{t("No products are currently available from this store.")}
					</p>
				}
			/>
		</Container>
	);
}
