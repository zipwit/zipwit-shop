/**
 * The search index, declared once. The FT.CREATE schema, the query builder and
 * `pnpm search:check` all read from here, so a field can't drift between them.
 *
 * `colors` and `sizes` are comma-separated strings indexed as TAG fields
 * with an explicit separator, shared by the query and facet builders.
 */
const FIELDS = {
	q: { path: "$.searchText", type: "TEXT" },
	checkedAt: { path: "$.checkedAt", type: "NUMERIC" },
	updatedAt: { path: "$.updatedAt", type: "NUMERIC" },
	store: { path: "$.storeId", type: "TAG" },
	brand: { path: "$.brand", type: "TAG" },
	department: { path: "$.department", type: "TAG" },
	category: { path: "$.category", type: "TAG" },
	colors: { path: "$.colors", type: "TAG", separator: "," },
	sizes: { path: "$.sizes", type: "TAG", separator: "," },
	price: { path: "$.price", type: "NUMERIC" },
	dealPrice: { path: "$.deal.price", type: "NUMERIC" },
	discount: { path: "$.discount", type: "NUMERIC" },
	sortName: { path: "$.sort.name", type: "TAG", sortable: true },
	sortPrice: { path: "$.sort.price", type: "TAG", sortable: true },
	sortDealPrice: { path: "$.sort.dealPrice", type: "TAG", sortable: true },
	sortDiscount: { path: "$.sort.discount", type: "TAG", sortable: true },
} as const satisfies Record<
	string,
	{
		path: string;
		type: "TEXT" | "TAG" | "NUMERIC";
		separator?: string;
		sortable?: boolean;
	}
>;

type FieldName = keyof typeof FIELDS;

export type TagField = {
	[K in FieldName]: (typeof FIELDS)[K]["type"] extends "TAG" ? K : never;
}[FieldName];

/** The tail of `FT.CREATE ... SCHEMA`: path, alias, type (and separator) for every field. */
export const schemaArgs = () =>
	Object.entries(FIELDS).flatMap(([name, field]) => [
		field.path,
		"AS",
		name,
		field.type,
		...("separator" in field ? ["SEPARATOR", field.separator] : []),
		...("sortable" in field ? ["SORTABLE"] : []),
	]);
