/** Rebuild derived Search documents from the live Redis catalog. */
import { syncCatalogIndex } from "#/features/search/catalog-index.server";

try {
	console.log(`Indexed ${await syncCatalogIndex()} products.`);
	process.exit(0);
} catch (error) {
	console.error(error);
	process.exit(1);
}
