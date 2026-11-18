import type { CatalogDoc } from "./catalog-doc";
import type { CatalogScope, CatalogSort } from "./catalog-filters";
import { INDEX } from "./catalog-index.server";
import { sortOptions } from "./catalog-query";
import { ft } from "./redis-ft.server";

const CANDIDATE_BATCH_SIZE = 256;

export async function readCatalogPage(
	query: string,
	scope: CatalogScope,
	sort: CatalogSort,
	offset: number,
	limit: number,
) {
	if (sort !== "relevance") {
		return ft.search<CatalogDoc>(INDEX, query, {
			sort: sortOptions(sort, scope),
			offset,
			limit,
		});
	}
	const [{ total }, { docs }] = await Promise.all([
		ft.search<CatalogDoc>(INDEX, query, { offset: 0, limit: 0 }),
		ft.searchByRelevance<CatalogDoc>(INDEX, query, { offset, limit }),
	]);
	return { total, docs };
}

export async function* catalogCandidateBatches(
	query: string,
	scope: CatalogScope,
	sort: CatalogSort,
) {
	let offset = 0;
	while (true) {
		const limit = CANDIDATE_BATCH_SIZE;
		if (sort === "relevance") {
			const { docs, rows } = await ft.searchByRelevance<CatalogDoc>(
				INDEX,
				query,
				{
					offset,
					limit,
				},
			);
			yield docs;
			if (rows < limit) return;
			offset += rows;
		} else {
			const { docs, total } = await readCatalogPage(
				query,
				scope,
				sort,
				offset,
				limit,
			);
			yield docs;
			offset += docs.length;
			if (!docs.length || offset >= total) return;
		}
	}
}

/** Read older search projections from their source record to recover SKU identities. */
export async function readCatalogVariants(doc: CatalogDoc) {
	if (doc.variants?.every((variant) => variant.skuId)) return doc.variants;
	const [{ getCatalogProductById }, { catalogSummary }] = await Promise.all([
		import("#/features/catalog/catalog-read.server"),
		import("#/features/catalog/catalog-projection.server"),
	]);
	const record = await getCatalogProductById(doc.id);
	return record ? (catalogSummary(record)?.variants ?? []) : [];
}
