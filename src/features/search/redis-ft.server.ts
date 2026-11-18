import type { createClient, FtSearchOptions } from "redis";
import { getRedis, redisCommand } from "#/server/redis.server";

type SearchOptions = {
	sort?: FtSearchOptions["SORTBY"];
	offset: number;
	limit: number;
};

type AggregateOptions = NonNullable<
	Parameters<ReturnType<typeof createClient>["ft"]["aggregate"]>[2]
>;

/** Catalog Search operations and reply decoding. */
export const ft = {
	list: async () => (await getRedis()).ft._list(),

	create: async (index: string, prefix: string, schema: string[]) =>
		redisCommand([
			"FT.CREATE",
			index,
			"ON",
			"JSON",
			"PREFIX",
			"1",
			prefix,
			"SCHEMA",
			...schema,
		]),

	dropIndex: async (index: string) => (await getRedis()).ft.dropIndex(index),

	async search<T>(index: string, query: string, options: SearchOptions) {
		const { total, documents } = await (await getRedis()).ft.search(
			index,
			query,
			{
				RETURN: "$",
				SORTBY: options.sort,
				LIMIT: { from: options.offset, size: options.limit },
				DIALECT: 2,
			},
		);
		return { total, docs: documents.map(({ value }) => value as T) };
	},

	/**
	 * Sort equal text scores by the unique product key. The raw command supports
	 * loading the whole JSON document and keeping MAX outside Redis's field count.
	 */
	async searchByRelevance<T>(
		index: string,
		query: string,
		{ offset, limit }: SearchOptions,
	) {
		const reply = await redisCommand([
			"FT.AGGREGATE",
			index,
			query,
			"ADDSCORES",
			"LOAD",
			"3",
			"$",
			"AS",
			"document",
			"SORTBY",
			"4",
			"@__score",
			"DESC",
			"@sortName",
			"ASC",
			"MAX",
			String(offset + limit),
			"LIMIT",
			String(offset),
			String(limit),
			"DIALECT",
			"2",
		]);
		if (!Array.isArray(reply)) throw new Error("Invalid ranked search reply");
		const rows = reply.slice(1);
		const docs = rows.flatMap((row) => {
			if (!Array.isArray(row)) throw new Error("Invalid ranked search row");
			const index = row.indexOf("document");
			const value = index >= 0 ? row[index + 1] : undefined;
			return typeof value === "string" ? [JSON.parse(value) as T] : [];
		});
		return { docs, rows: rows.length };
	},

	async aggregate(index: string, query: string, options: AggregateOptions) {
		const { results } = await (await getRedis()).ft.aggregate(index, query, {
			...options,
			DIALECT: 2,
		});
		return results;
	},
};
