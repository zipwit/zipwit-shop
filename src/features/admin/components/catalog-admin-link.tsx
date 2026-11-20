import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DropdownMenuItem } from "#/components/ui/dropdown-menu";
import { useTranslation } from "#/i18n/translate";
import { catalogOperatorFn } from "../catalog-feeds.functions";

/** Resolve menu visibility only when the signed-in account menu is opened. */
export function CatalogAdminLink({ userId }: { userId: string }) {
	const t = useTranslation();
	const { data: allowed } = useQuery({
		queryKey: ["catalog-operator", userId],
		queryFn: ({ signal }) => catalogOperatorFn({ signal }),
		staleTime: 60_000,
		retry: false,
	});
	return allowed ? (
		<DropdownMenuItem render={<Link to="/admin" />}>
			{t("Catalog feeds")}
		</DropdownMenuItem>
	) : null;
}
