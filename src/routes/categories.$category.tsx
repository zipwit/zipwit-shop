import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Container } from "#/components/layout/container";
import { PageHeader } from "#/components/layout/page-header";
import { categories, categorySchema } from "#/data/catalog";
import { site } from "#/data/site";
import { CatalogListing } from "#/features/catalog/components/catalog-listing";
import { CategoryLinks } from "#/features/catalog/components/category-links";
import { loadCatalog } from "#/features/search/catalog.queries";
import {
	catalogFiltersSchema,
	DEFAULT_FILTERS,
} from "#/features/search/catalog-filters";
import { translate, useTranslation } from "#/i18n/translate";
import { parseParam } from "#/lib/route-guards";

export const Route = createFileRoute("/categories/$category")({
	beforeLoad: ({ params, context }) => {
		const category = parseParam(categorySchema, params.category);
		return {
			scope: { category, mode: "listing" as const },
			title: translate(categories[category].label, {}, context.locale),
		};
	},
	validateSearch: catalogFiltersSchema,
	search: { middlewares: [stripSearchParams(DEFAULT_FILTERS)] },
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ context, deps }) =>
		loadCatalog(context.queryClient, context.scope, deps.search),
	head: ({ match }) => ({
		meta: [{ title: `${match.context.title} | ${site.name}` }],
	}),
	component: CategoryPage,
});

function CategoryPage() {
	const { scope, title } = Route.useRouteContext();
	const filters = Route.useSearch();
	const navigate = Route.useNavigate();
	const t = useTranslation();
	return (
		<Container className="py-8 md:py-12">
			<PageHeader
				title={title}
				eyebrow={t("Shop by category")}
				description={t("For men, women and kids.")}
			>
				<CategoryLinks />
			</PageHeader>
			<CatalogListing
				key={scope.category}
				scope={scope}
				filters={filters}
				onFiltersChange={(update) =>
					navigate({ search: update, replace: true, resetScroll: false })
				}
			/>
		</Container>
	);
}
